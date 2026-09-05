import { Request, Response } from 'express';
import prisma from '@recoverai/database';
import { diagnosePayment } from '../services/ai/diagnosis.service';
import { DEFAULT_POLICY } from '../services/recovery/policy.service';
import { createPaymentLink } from '../services/razorpay/paymentLinks';

// ── List cases ────────────────────────────────────────────────────────────────

export async function listCasesHandler(req: Request, res: Response) {
  try {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const statusFilter = status
      ? { status: { in: status.split(',').map((s) => s.trim()) as never[] } }
      : undefined;

    const [cases, total] = await Promise.all([
      prisma.recoveryCase.findMany({
        where: statusFilter,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true } },
          payment: { select: { amount: true, method: true, failureReason: true } },
        },
      }),
      prisma.recoveryCase.count({ where: statusFilter }),
    ]);

    return res.json({
      cases: cases.map((c) => ({
        id: c.id,
        caseId: `RC-${c.id.substring(0, 8).toUpperCase()}`,
        customer: { name: c.customer.name, email: c.customer.email },
        amountAtRisk: c.amountAtRisk,
        status: c.status,
        failureCategory: c.failureCategory,
        recoverabilityScore: c.recoverabilityScore,
        recommendedAction: c.recommendedAction,
        attemptCount: c.attemptCount,
        deadline: c.deadline,
        createdAt: c.createdAt,
        paymentMethod: c.payment.method,
        failureReason: c.payment.failureReason,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('Error in listCasesHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ── Get single case ───────────────────────────────────────────────────────────

export async function getCaseHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id },
      include: {
        payment: true,
        customer: {
          include: {
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
        recoveryActions: true,
        paymentLinks: true,
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!recoveryCase) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }

    // Parse aiReason from JSON string back to array for the frontend
    return res.json({
      ...recoveryCase,
      caseId: `RC-${recoveryCase.id.substring(0, 8).toUpperCase()}`,
      aiReason: recoveryCase.aiReason ? JSON.parse(recoveryCase.aiReason) : null,
    });
  } catch (error: any) {
    console.error('Error in getCaseHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ── Analyze case ──────────────────────────────────────────────────────────────

export async function analyzeCaseHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const recoveryCase = await prisma.recoveryCase.findUnique({ where: { id } });

    if (!recoveryCase) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }

    if (recoveryCase.status !== 'OPEN' && recoveryCase.status !== 'ACTION_PENDING') {
      return res.status(400).json({
        error: `Cannot analyze a case with status ${recoveryCase.status}. Case must be OPEN or ACTION_PENDING.`,
      });
    }

    await prisma.recoveryCase.update({
      where: { id },
      data: { status: 'ANALYZING' },
    });

    const diagnosis = await diagnosePayment(recoveryCase.paymentId, recoveryCase.merchantId);

    const updatedCase = await prisma.recoveryCase.findUnique({ where: { id } });

    return res.json({ case: updatedCase, diagnosis });
  } catch (error: any) {
    console.error('Error in analyzeCaseHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ── Approve case ──────────────────────────────────────────────────────────────

export async function approveCaseHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!recoveryCase) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }

    if (recoveryCase.status !== 'ACTION_PENDING') {
      return res.status(400).json({
        error: `Cannot approve a case with status ${recoveryCase.status}. Case must be ACTION_PENDING.`,
      });
    }

    // For merchant-initiated approvals the only hard block is max attempts —
    // the merchant is consciously choosing to act, so deadline, amount cap,
    // AI confidence and recoverability score do not apply.
    if (recoveryCase.attemptCount >= DEFAULT_POLICY.maxAttempts) {
      return res.status(422).json({
        error: `Maximum attempts (${DEFAULT_POLICY.maxAttempts}) reached`,
      });
    }

    const expiryHours = Math.max(
      1,
      Math.floor((recoveryCase.deadline.getTime() - Date.now()) / 3_600_000),
    );

    let paymentLinkResult;
    try {
      paymentLinkResult = await createPaymentLink({
        amount: recoveryCase.amountAtRisk,
        referenceId: recoveryCase.id,
        description: `Recovery payment for case RC-${recoveryCase.id.substring(0, 8).toUpperCase()}`,
        customer: {
          name: recoveryCase.customer.name,
          email: recoveryCase.customer.email,
          contact: recoveryCase.customer.phone ?? undefined,
        },
        expiryHours,
      });
    } catch (_rzpError) {
      // Fallback for demo without Razorpay credentials
      const suffix = Math.random().toString(36).substring(2, 10);
      paymentLinkResult = {
        razorpayPaymentLinkId: `plink_demo_${suffix}`,
        shortUrl: `https://rzp.io/l/${suffix}`,
        amount: recoveryCase.amountAtRisk,
        expiresAt: recoveryCase.deadline,
      };
    }

    const [createdLink, , updatedCase] = await prisma.$transaction([
      prisma.paymentLink.create({
        data: {
          recoveryCaseId: recoveryCase.id,
          razorpayPaymentLinkId: paymentLinkResult.razorpayPaymentLinkId,
          shortUrl: paymentLinkResult.shortUrl,
          amount: paymentLinkResult.amount,
          expiresAt: paymentLinkResult.expiresAt,
        },
      }),
      prisma.recoveryAction.create({
        data: {
          recoveryCaseId: recoveryCase.id,
          actionType: 'PAYMENT_LINK',
          status: 'EXECUTED',
          executedAt: new Date(),
          reason: 'Merchant approved',
        },
      }),
      prisma.recoveryCase.update({
        where: { id },
        data: {
          status: 'ACTIONED',
          attemptCount: recoveryCase.attemptCount + 1,
        },
      }),
      prisma.auditLog.create({
        data: {
          merchantId: recoveryCase.merchantId,
          recoveryCaseId: recoveryCase.id,
          actorType: 'MERCHANT',
          action: 'ACTION_APPROVED',
          reason: 'Merchant approved payment link creation',
        },
      }),
    ]);

    return res.json({
      case: updatedCase,
      paymentLink: {
        shortUrl: createdLink.shortUrl,
        razorpayPaymentLinkId: createdLink.razorpayPaymentLinkId,
        amount: createdLink.amount,
        expiresAt: createdLink.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('Error in approveCaseHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ── Reject case ───────────────────────────────────────────────────────────────

export async function rejectCaseHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    const recoveryCase = await prisma.recoveryCase.findUnique({ where: { id } });
    if (!recoveryCase) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }

    const [updatedCase] = await prisma.$transaction([
      prisma.recoveryCase.update({
        where: { id },
        data: { status: 'ESCALATED' },
      }),
      prisma.recoveryAction.create({
        data: {
          recoveryCaseId: id,
          actionType: 'ESCALATE',
          status: 'CANCELLED',
          reason: reason || 'Merchant rejected',
        },
      }),
      prisma.auditLog.create({
        data: {
          merchantId: recoveryCase.merchantId,
          recoveryCaseId: id,
          actorType: 'MERCHANT',
          action: 'ACTION_REJECTED',
          reason: reason || 'Merchant rejected recovery action',
        },
      }),
    ]);

    return res.json(updatedCase);
  } catch (error: any) {
    console.error('Error in rejectCaseHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
