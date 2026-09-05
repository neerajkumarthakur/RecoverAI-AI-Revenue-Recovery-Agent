"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePaymentFailed = handlePaymentFailed;
exports.handlePaymentCaptured = handlePaymentCaptured;
exports.handlePaymentLinkPaid = handlePaymentLinkPaid;
exports.handlePaymentLinkExpired = handlePaymentLinkExpired;
exports.handlePaymentLinkCancelled = handlePaymentLinkCancelled;
const database_1 = __importDefault(require("@recoverai/database"));
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toPaymentMethod(raw) {
    const map = {
        upi: 'upi',
        card: 'card',
        netbanking: 'netbanking',
        wallet: 'wallet',
        emi: 'emi',
    };
    return map[(raw ?? '').toLowerCase()] ?? 'other';
}
async function findOrCreateCustomer(merchantId, email, phone, name) {
    const existing = await database_1.default.customer.findFirst({
        where: { merchantId, email },
    });
    if (existing)
        return existing;
    return database_1.default.customer.create({
        data: {
            merchantId,
            email,
            phone: phone ?? null,
            name,
        },
    });
}
// ---------------------------------------------------------------------------
// handlePaymentFailed
// ---------------------------------------------------------------------------
async function handlePaymentFailed(payload, merchantId) {
    try {
        const entity = payload?.payload?.payment?.entity;
        if (!entity) {
            console.error('handlePaymentFailed: missing payment entity in payload');
            return;
        }
        const email = entity.email ?? 'unknown@unknown.com';
        const phone = entity.contact ?? undefined;
        const name = entity.notes?.name ?? 'Unknown';
        const customer = await findOrCreateCustomer(merchantId, email, phone, name);
        // Upsert Payment
        const payment = await database_1.default.payment.upsert({
            where: { razorpayPaymentId: entity.id },
            update: {
                amount: entity.amount,
                currency: entity.currency ?? 'INR',
                method: toPaymentMethod(entity.method),
                status: 'failed',
                errorCode: entity.error_code ?? null,
                errorDescription: entity.error_description ?? null,
                failureReason: entity.error_reason ?? null,
            },
            create: {
                merchantId,
                customerId: customer.id,
                razorpayPaymentId: entity.id,
                amount: entity.amount,
                currency: entity.currency ?? 'INR',
                method: toPaymentMethod(entity.method),
                status: 'failed',
                errorCode: entity.error_code ?? null,
                errorDescription: entity.error_description ?? null,
                failureReason: entity.error_reason ?? null,
            },
        });
        // Create RecoveryCase only if one doesn't already exist for this payment
        const existing = await database_1.default.recoveryCase.findUnique({
            where: { paymentId: payment.id },
        });
        if (existing) {
            console.log(`RecoveryCase already exists for paymentId=${payment.id}, skipping`);
            return;
        }
        const recoveryCase = await database_1.default.recoveryCase.create({
            data: {
                merchantId,
                customerId: customer.id,
                paymentId: payment.id,
                amountAtRisk: entity.amount,
                status: 'OPEN',
                deadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
                maxAttempts: 2,
                attemptCount: 0,
            },
        });
        await database_1.default.auditLog.create({
            data: {
                merchantId,
                recoveryCaseId: recoveryCase.id,
                actorType: 'SYSTEM',
                action: 'CASE_CREATED',
                reason: 'Payment failed webhook received',
            },
        });
    }
    catch (error) {
        console.error('handlePaymentFailed error:', error);
    }
}
// ---------------------------------------------------------------------------
// handlePaymentCaptured
// ---------------------------------------------------------------------------
async function handlePaymentCaptured(payload, merchantId) {
    try {
        const entity = payload?.payload?.payment?.entity;
        if (!entity) {
            console.error('handlePaymentCaptured: missing payment entity in payload');
            return;
        }
        const payment = await database_1.default.payment.update({
            where: { razorpayPaymentId: entity.id },
            data: { status: 'captured' },
        });
        const recoveryCase = await database_1.default.recoveryCase.findUnique({
            where: { paymentId: payment.id },
        });
        if (recoveryCase && recoveryCase.status === 'ACTIONED') {
            await database_1.default.recoveryCase.update({
                where: { id: recoveryCase.id },
                data: { status: 'RECOVERED', recoveredAt: new Date() },
            });
            await database_1.default.auditLog.create({
                data: {
                    merchantId,
                    recoveryCaseId: recoveryCase.id,
                    actorType: 'SYSTEM',
                    action: 'CASE_RECOVERED',
                    reason: 'Payment captured webhook received',
                },
            });
        }
    }
    catch (error) {
        console.error('handlePaymentCaptured error:', error);
    }
}
// ---------------------------------------------------------------------------
// handlePaymentLinkPaid
// ---------------------------------------------------------------------------
async function handlePaymentLinkPaid(payload, merchantId) {
    try {
        const entity = payload?.payload?.payment_link?.entity;
        if (!entity) {
            console.error('handlePaymentLinkPaid: missing payment_link entity in payload');
            return;
        }
        const paymentLink = await database_1.default.paymentLink.findUnique({
            where: { razorpayPaymentLinkId: entity.id },
        });
        if (!paymentLink) {
            console.error(`handlePaymentLinkPaid: PaymentLink not found for id=${entity.id}`);
            return;
        }
        await database_1.default.recoveryCase.update({
            where: { id: paymentLink.recoveryCaseId },
            data: { status: 'RECOVERED', recoveredAt: new Date() },
        });
        await database_1.default.paymentLink.update({
            where: { id: paymentLink.id },
            data: { status: 'paid' },
        });
        const latestAction = await database_1.default.recoveryAction.findFirst({
            where: { recoveryCaseId: paymentLink.recoveryCaseId },
            orderBy: { createdAt: 'desc' },
        });
        if (latestAction) {
            await database_1.default.recoveryAction.update({
                where: { id: latestAction.id },
                data: { status: 'SUCCESS', completedAt: new Date() },
            });
        }
        await database_1.default.auditLog.create({
            data: {
                merchantId,
                recoveryCaseId: paymentLink.recoveryCaseId,
                actorType: 'SYSTEM',
                action: 'CASE_RECOVERED',
                reason: 'Payment link paid via webhook',
            },
        });
    }
    catch (error) {
        console.error('handlePaymentLinkPaid error:', error);
    }
}
// ---------------------------------------------------------------------------
// handlePaymentLinkExpired
// ---------------------------------------------------------------------------
async function handlePaymentLinkExpired(payload, merchantId) {
    try {
        const entity = payload?.payload?.payment_link?.entity;
        if (!entity) {
            console.error('handlePaymentLinkExpired: missing payment_link entity in payload');
            return;
        }
        const paymentLink = await database_1.default.paymentLink.findUnique({
            where: { razorpayPaymentLinkId: entity.id },
        });
        if (!paymentLink) {
            console.error(`handlePaymentLinkExpired: PaymentLink not found for id=${entity.id}`);
            return;
        }
        await database_1.default.recoveryCase.update({
            where: { id: paymentLink.recoveryCaseId },
            data: { status: 'EXPIRED' },
        });
        await database_1.default.paymentLink.update({
            where: { id: paymentLink.id },
            data: { status: 'expired' },
        });
        await database_1.default.auditLog.create({
            data: {
                merchantId,
                recoveryCaseId: paymentLink.recoveryCaseId,
                actorType: 'SYSTEM',
                action: 'CASE_EXPIRED',
                reason: 'Payment link expired via webhook',
            },
        });
    }
    catch (error) {
        console.error('handlePaymentLinkExpired error:', error);
    }
}
// ---------------------------------------------------------------------------
// handlePaymentLinkCancelled
// ---------------------------------------------------------------------------
async function handlePaymentLinkCancelled(payload, merchantId) {
    try {
        const entity = payload?.payload?.payment_link?.entity;
        if (!entity) {
            console.error('handlePaymentLinkCancelled: missing payment_link entity in payload');
            return;
        }
        const paymentLink = await database_1.default.paymentLink.findUnique({
            where: { razorpayPaymentLinkId: entity.id },
        });
        if (!paymentLink) {
            console.error(`handlePaymentLinkCancelled: PaymentLink not found for id=${entity.id}`);
            return;
        }
        await database_1.default.recoveryCase.update({
            where: { id: paymentLink.recoveryCaseId },
            data: { status: 'EXPIRED' },
        });
        await database_1.default.paymentLink.update({
            where: { id: paymentLink.id },
            data: { status: 'cancelled' },
        });
        await database_1.default.auditLog.create({
            data: {
                merchantId,
                recoveryCaseId: paymentLink.recoveryCaseId,
                actorType: 'SYSTEM',
                action: 'CASE_EXPIRED',
                reason: 'Payment link cancelled via webhook',
            },
        });
    }
    catch (error) {
        console.error('handlePaymentLinkCancelled error:', error);
    }
}
//# sourceMappingURL=recovery.service.js.map