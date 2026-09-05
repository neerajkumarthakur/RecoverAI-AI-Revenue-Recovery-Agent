import OpenAI from 'openai';
import { buildSystemPrompt, buildUserMessage, DiagnosisFeatures } from './prompts';
import { computeScore, ScoringInput } from './scoring.service';
import prisma from '@recoverai/database';

// Lazy singleton — avoids crash at startup when OPENAI_API_KEY is not set
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  }
  return _openai;
}

export interface DiagnosisResult {
  failureCategory: string;
  recoverabilityScore: number; // deterministic score (authoritative)
  aiScore: number;             // what the AI suggested (for reference)
  confidence: number;
  recommendedAction: string;
  reason: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  whyNotRetry?: string;
  stoppingRules?: string;
}

interface AiResponse {
  failureCategory: string;
  recoverabilityScore: number;
  confidence: number;
  recommendedAction: string;
  reason: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  whyNotRetry?: string;
  stoppingRules?: string;
}

function validateAiResponse(raw: unknown): AiResponse {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('AI response is not an object');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj['failureCategory'] !== 'string') throw new Error('Missing failureCategory');
  if (typeof obj['recoverabilityScore'] !== 'number') throw new Error('Missing recoverabilityScore');
  if (typeof obj['confidence'] !== 'number') throw new Error('Missing confidence');
  if (typeof obj['recommendedAction'] !== 'string') throw new Error('Missing recommendedAction');
  if (!Array.isArray(obj['reason'])) throw new Error('Missing reason array');
  if (obj['riskLevel'] !== 'LOW' && obj['riskLevel'] !== 'MEDIUM' && obj['riskLevel'] !== 'HIGH') {
    throw new Error('Invalid riskLevel');
  }
  return obj as unknown as AiResponse;
}

function buildFallbackResult(score: number): DiagnosisResult {
  return {
    failureCategory: 'UNKNOWN',
    recoverabilityScore: score,
    aiScore: 0,
    confidence: 0,
    recommendedAction: score >= 50 ? 'PAYMENT_LINK' : 'NO_ACTION',
    reason: ['AI diagnosis unavailable; falling back to deterministic score'],
    riskLevel: score >= 70 ? 'LOW' : score >= 40 ? 'MEDIUM' : 'HIGH',
  };
}

/**
 * Runs the full AI diagnosis pipeline for a failed payment.
 *
 * Steps:
 *  1. Fetch payment + customer from DB
 *  2. Load customer payment history (last 20 payments)
 *  3. Compute deterministic recoverability score
 *  4. Call GPT-4o-mini for structured diagnosis
 *  5. Persist results to RecoveryCase + AuditLog
 *  6. Return DiagnosisResult
 */
export async function diagnosePayment(
  paymentId: string,
  merchantId: string,
): Promise<DiagnosisResult> {
  // ── 1. Fetch payment with its recovery case and customer ───────────────────
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      customer: true,
      recoveryCase: true,
    },
  });

  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  const recoveryCase = payment.recoveryCase;
  if (!recoveryCase) {
    throw new Error(`No recovery case found for payment ${paymentId}`);
  }

  // ── 2. Customer payment history (last 20 payments) ─────────────────────────
  const history = await prisma.payment.findMany({
    where: { customerId: payment.customerId },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { status: true, amount: true, createdAt: true, recoveryCase: { select: { status: true } } },
  });

  const totalPayments = history.length;
  const successfulPayments = history.filter(p => p.status === 'captured').length;
  const failedPayments = history.filter(p => p.status === 'failed').length;
  const averageAmount =
    totalPayments > 0
      ? Math.round(history.reduce((sum, p) => sum + p.amount, 0) / totalPayments)
      : 0;
  const previousRecoveries = history.filter(
    p => p.recoveryCase?.status === 'RECOVERED',
  ).length;

  const firstPayment = history[0];
  const customerAgeDays = firstPayment
    ? Math.floor((Date.now() - firstPayment.createdAt.getTime()) / 86_400_000)
    : 0;

  // ── 3. Deterministic score ─────────────────────────────────────────────────
  const scoringInput: ScoringInput = {
    payment: {
      amount: payment.amount,
      method: payment.method,
      errorCode: payment.errorCode,
      failureReason: payment.failureReason,
    },
    customerHistory: {
      totalPayments,
      successfulPayments,
      failedPayments,
      averageAmount,
      previousRecoveries,
      customerAgeDays,
    },
  };

  const recoverabilityScore = computeScore(scoringInput);

  // ── 4. Build feature set for LLM ──────────────────────────────────────────
  const deadlineHoursRemaining =
    (recoveryCase.deadline.getTime() - Date.now()) / 3_600_000;

  const features: DiagnosisFeatures = {
    payment: {
      amount: payment.amount,
      amountInRupees: payment.amount / 100,
      currency: payment.currency,
      method: payment.method,
      errorCode: payment.errorCode,
      failureReason: payment.failureReason,
    },
    customer: {
      name: payment.customer.name,
      totalPayments,
      successfulPayments,
      failedPayments,
      successRate: totalPayments > 0 ? successfulPayments / totalPayments : 0,
      averageAmountRupees: Math.round(averageAmount / 100),
      customerAgeDays,
      previousRecoveries,
    },
    case: {
      recoverabilityScore,
      attemptCount: recoveryCase.attemptCount,
      maxAttempts: recoveryCase.maxAttempts,
      deadlineHoursRemaining,
    },
  };

  // ── 5. GPT-4o-mini call ───────────────────────────────────────────────────
  let aiResponse: AiResponse;
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserMessage(features) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    aiResponse = validateAiResponse(JSON.parse(raw));
  } catch (err) {
    console.error('[DiagnosisService] OpenAI call failed:', err);
    const fallback = buildFallbackResult(recoverabilityScore);

    // Persist fallback to DB before returning
    await persistDiagnosis(recoveryCase.id, merchantId, fallback, recoverabilityScore);
    return fallback;
  }

  // ── 6. Build final result (deterministic score is authoritative) ──────────
  const result: DiagnosisResult = {
    failureCategory: aiResponse.failureCategory,
    recoverabilityScore,           // deterministic — overrides AI suggestion
    aiScore: aiResponse.recoverabilityScore,
    confidence: aiResponse.confidence,
    recommendedAction: aiResponse.recommendedAction,
    reason: aiResponse.reason,
    riskLevel: aiResponse.riskLevel,
    whyNotRetry: aiResponse.whyNotRetry,
    stoppingRules: aiResponse.stoppingRules,
  };

  // ── 7. Persist to DB ──────────────────────────────────────────────────────
  await persistDiagnosis(recoveryCase.id, merchantId, result, recoverabilityScore);

  return result;
}

async function persistDiagnosis(
  recoveryCaseId: string,
  merchantId: string,
  result: DiagnosisResult,
  recoverabilityScore: number,
): Promise<void> {
  const newStatus = recoverabilityScore >= 50 ? 'ACTION_PENDING' : 'ESCALATED';

  await prisma.$transaction([
    prisma.recoveryCase.update({
      where: { id: recoveryCaseId },
      data: {
        failureCategory: result.failureCategory,
        recoverabilityScore,
        aiConfidence: result.confidence,
        aiReason: JSON.stringify(result.reason),
        recommendedAction: result.recommendedAction,
        status: newStatus,
      },
    }),
    prisma.auditLog.create({
      data: {
        merchantId,
        recoveryCaseId,
        actorType: 'AI',
        action: 'CASE_ANALYZED',
        reason: result.recommendedAction,
        metadata: JSON.stringify({
          failureCategory: result.failureCategory,
          recoverabilityScore,
          aiScore: result.aiScore,
          confidence: result.confidence,
          riskLevel: result.riskLevel,
        }),
      },
    }),
  ]);
}
