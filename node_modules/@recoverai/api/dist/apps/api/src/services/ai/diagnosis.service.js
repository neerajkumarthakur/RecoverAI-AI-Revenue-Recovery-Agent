"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosePayment = diagnosePayment;
const openai_1 = __importDefault(require("openai"));
const prompts_1 = require("./prompts");
const scoring_service_1 = require("./scoring.service");
const database_1 = __importDefault(require("@recoverai/database"));
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
function validateAiResponse(raw) {
    if (typeof raw !== 'object' || raw === null) {
        throw new Error('AI response is not an object');
    }
    const obj = raw;
    if (typeof obj['failureCategory'] !== 'string')
        throw new Error('Missing failureCategory');
    if (typeof obj['recoverabilityScore'] !== 'number')
        throw new Error('Missing recoverabilityScore');
    if (typeof obj['confidence'] !== 'number')
        throw new Error('Missing confidence');
    if (typeof obj['recommendedAction'] !== 'string')
        throw new Error('Missing recommendedAction');
    if (!Array.isArray(obj['reason']))
        throw new Error('Missing reason array');
    if (obj['riskLevel'] !== 'LOW' && obj['riskLevel'] !== 'MEDIUM' && obj['riskLevel'] !== 'HIGH') {
        throw new Error('Invalid riskLevel');
    }
    return obj;
}
function buildFallbackResult(score) {
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
async function diagnosePayment(paymentId, merchantId) {
    // ── 1. Fetch payment with its recovery case and customer ───────────────────
    const payment = await database_1.default.payment.findUnique({
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
    const history = await database_1.default.payment.findMany({
        where: { customerId: payment.customerId },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: { status: true, amount: true, createdAt: true, recoveryCase: { select: { status: true } } },
    });
    const totalPayments = history.length;
    const successfulPayments = history.filter(p => p.status === 'captured').length;
    const failedPayments = history.filter(p => p.status === 'failed').length;
    const averageAmount = totalPayments > 0
        ? Math.round(history.reduce((sum, p) => sum + p.amount, 0) / totalPayments)
        : 0;
    const previousRecoveries = history.filter(p => p.recoveryCase?.status === 'RECOVERED').length;
    const firstPayment = history[0];
    const customerAgeDays = firstPayment
        ? Math.floor((Date.now() - firstPayment.createdAt.getTime()) / 86400000)
        : 0;
    // ── 3. Deterministic score ─────────────────────────────────────────────────
    const scoringInput = {
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
    const recoverabilityScore = (0, scoring_service_1.computeScore)(scoringInput);
    // ── 4. Build feature set for LLM ──────────────────────────────────────────
    const deadlineHoursRemaining = (recoveryCase.deadline.getTime() - Date.now()) / 3600000;
    const features = {
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
    let aiResponse;
    try {
        const completion = await getOpenAI.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 1000,
            messages: [
                { role: 'system', content: (0, prompts_1.buildSystemPrompt)() },
                { role: 'user', content: (0, prompts_1.buildUserMessage)(features) },
            ],
        });
        const raw = completion.choices[0]?.message?.content ?? '{}';
        aiResponse = validateAiResponse(JSON.parse(raw));
    }
    catch (err) {
        console.error('[DiagnosisService] OpenAI call failed:', err);
        const fallback = buildFallbackResult(recoverabilityScore);
        // Persist fallback to DB before returning
        await persistDiagnosis(recoveryCase.id, merchantId, fallback, recoverabilityScore);
        return fallback;
    }
    // ── 6. Build final result (deterministic score is authoritative) ──────────
    const result = {
        failureCategory: aiResponse.failureCategory,
        recoverabilityScore, // deterministic — overrides AI suggestion
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
async function persistDiagnosis(recoveryCaseId, merchantId, result, recoverabilityScore) {
    const newStatus = recoverabilityScore >= 50 ? 'ACTION_PENDING' : 'ESCALATED';
    await database_1.default.$transaction([
        database_1.default.recoveryCase.update({
            where: { id: recoveryCaseId },
            data: {
                failureCategory: result.failureCategory,
                recoverabilityScore,
                aiConfidence: result.confidence,
                aiReason: result.reason,
                recommendedAction: result.recommendedAction,
                status: newStatus,
            },
        }),
        database_1.default.auditLog.create({
            data: {
                merchantId,
                recoveryCaseId,
                actorType: 'AI',
                action: 'CASE_ANALYZED',
                reason: result.recommendedAction,
                metadata: {
                    failureCategory: result.failureCategory,
                    recoverabilityScore,
                    aiScore: result.aiScore,
                    confidence: result.confidence,
                    riskLevel: result.riskLevel,
                },
            },
        }),
    ]);
}
//# sourceMappingURL=diagnosis.service.js.map