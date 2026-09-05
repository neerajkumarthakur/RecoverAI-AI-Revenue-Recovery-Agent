"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCasesHandler = listCasesHandler;
exports.getCaseHandler = getCaseHandler;
exports.analyzeCaseHandler = analyzeCaseHandler;
exports.approveCaseHandler = approveCaseHandler;
exports.rejectCaseHandler = rejectCaseHandler;
const database_1 = __importDefault(require("@recoverai/database"));
const diagnosis_service_1 = require("../services/ai/diagnosis.service");
const policy_service_1 = require("../services/recovery/policy.service");
const paymentLinks_1 = require("../services/razorpay/paymentLinks");
// ── List cases ────────────────────────────────────────────────────────────────
async function listCasesHandler(req, res) {
    try {
        const { status, page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;
        const statusFilter = status
            ? { status: { in: status.split(',').map((s) => s.trim()) } }
            : undefined;
        const [cases, total] = await Promise.all([
            database_1.default.recoveryCase.findMany({
                where: statusFilter,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { name: true, email: true } },
                    payment: { select: { amount: true, method: true, failureReason: true } },
                },
            }),
            database_1.default.recoveryCase.count({ where: statusFilter }),
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
    }
    catch (error) {
        console.error('Error in listCasesHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
// ── Get single case ───────────────────────────────────────────────────────────
async function getCaseHandler(req, res) {
    try {
        const { id } = req.params;
        const recoveryCase = await database_1.default.recoveryCase.findUnique({
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
        return res.json(recoveryCase);
    }
    catch (error) {
        console.error('Error in getCaseHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
// ── Analyze case ──────────────────────────────────────────────────────────────
async function analyzeCaseHandler(req, res) {
    try {
        const { id } = req.params;
        const recoveryCase = await database_1.default.recoveryCase.findUnique({ where: { id } });
        if (!recoveryCase) {
            return res.status(404).json({ error: 'Recovery case not found' });
        }
        if (recoveryCase.status !== 'OPEN' && recoveryCase.status !== 'ACTION_PENDING') {
            return res.status(400).json({
                error: `Cannot analyze a case with status ${recoveryCase.status}. Case must be OPEN or ACTION_PENDING.`,
            });
        }
        await database_1.default.recoveryCase.update({
            where: { id },
            data: { status: 'ANALYZING' },
        });
        const diagnosis = await (0, diagnosis_service_1.diagnosePayment)(recoveryCase.paymentId, recoveryCase.merchantId);
        const updatedCase = await database_1.default.recoveryCase.findUnique({ where: { id } });
        return res.json({ case: updatedCase, diagnosis });
    }
    catch (error) {
        console.error('Error in analyzeCaseHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
// ── Approve case ──────────────────────────────────────────────────────────────
async function approveCaseHandler(req, res) {
    try {
        const { id } = req.params;
        const recoveryCase = await database_1.default.recoveryCase.findUnique({
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
        const policyResult = (0, policy_service_1.canExecuteAction)({
            attemptCount: recoveryCase.attemptCount,
            amountAtRisk: recoveryCase.amountAtRisk,
            deadline: recoveryCase.deadline,
            aiConfidence: recoveryCase.aiConfidence ?? 0,
            recoverabilityScore: recoveryCase.recoverabilityScore ?? 0,
        }, policy_service_1.DEFAULT_POLICY);
        if (!policyResult.allowed) {
            return res.status(422).json({ error: policyResult.blockedReason });
        }
        const expiryHours = Math.max(1, Math.floor((recoveryCase.deadline.getTime() - Date.now()) / 3600000));
        let paymentLinkResult;
        try {
            paymentLinkResult = await (0, paymentLinks_1.createPaymentLink)({
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
        }
        catch (_rzpError) {
            // Fallback for demo without Razorpay credentials
            const suffix = Math.random().toString(36).substring(2, 10);
            paymentLinkResult = {
                razorpayPaymentLinkId: `plink_demo_${suffix}`,
                shortUrl: `https://rzp.io/l/${suffix}`,
                amount: recoveryCase.amountAtRisk,
                expiresAt: recoveryCase.deadline,
            };
        }
        const [createdLink, , updatedCase] = await database_1.default.$transaction([
            database_1.default.paymentLink.create({
                data: {
                    recoveryCaseId: recoveryCase.id,
                    razorpayPaymentLinkId: paymentLinkResult.razorpayPaymentLinkId,
                    shortUrl: paymentLinkResult.shortUrl,
                    amount: paymentLinkResult.amount,
                    expiresAt: paymentLinkResult.expiresAt,
                },
            }),
            database_1.default.recoveryAction.create({
                data: {
                    recoveryCaseId: recoveryCase.id,
                    actionType: 'PAYMENT_LINK',
                    status: 'EXECUTED',
                    executedAt: new Date(),
                    reason: 'Merchant approved',
                },
            }),
            database_1.default.recoveryCase.update({
                where: { id },
                data: {
                    status: 'ACTIONED',
                    attemptCount: recoveryCase.attemptCount + 1,
                },
            }),
            database_1.default.auditLog.create({
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
    }
    catch (error) {
        console.error('Error in approveCaseHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
// ── Reject case ───────────────────────────────────────────────────────────────
async function rejectCaseHandler(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const recoveryCase = await database_1.default.recoveryCase.findUnique({ where: { id } });
        if (!recoveryCase) {
            return res.status(404).json({ error: 'Recovery case not found' });
        }
        const [updatedCase] = await database_1.default.$transaction([
            database_1.default.recoveryCase.update({
                where: { id },
                data: { status: 'ESCALATED' },
            }),
            database_1.default.recoveryAction.create({
                data: {
                    recoveryCaseId: id,
                    actionType: 'ESCALATE',
                    status: 'CANCELLED',
                    reason: reason || 'Merchant rejected',
                },
            }),
            database_1.default.auditLog.create({
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
    }
    catch (error) {
        console.error('Error in rejectCaseHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
//# sourceMappingURL=recovery.controller.js.map