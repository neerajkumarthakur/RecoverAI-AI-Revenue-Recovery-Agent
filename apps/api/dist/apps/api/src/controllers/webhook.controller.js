"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhookHandler = razorpayWebhookHandler;
const webhooks_1 = require("../services/razorpay/webhooks");
const database_1 = __importDefault(require("@recoverai/database"));
const recovery_service_1 = require("../services/recovery/recovery.service");
async function razorpayWebhookHandler(req, res) {
    const signature = req.headers['x-razorpay-signature'];
    const eventId = req.headers['x-razorpay-event-id'];
    const rawBody = req.body.toString(); // req.body is Buffer from express.raw()
    // 1. Verify signature
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!(0, webhooks_1.verifyWebhookSignature)(rawBody, signature, secret)) {
        return res.status(400).json({ error: 'Invalid signature' });
    }
    // 2. Parse payload
    let payload;
    try {
        payload = JSON.parse(rawBody);
    }
    catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    const eventType = payload.event;
    // 3. Check for duplicate event
    if (eventId) {
        const existing = await database_1.default.webhookEvent.findUnique({
            where: { razorpayEventId: eventId },
        });
        if (existing) {
            return res.status(200).json({ status: 'already_processed' });
        }
    }
    // 4. Save webhook event (processed: false)
    const webhookEvent = await database_1.default.webhookEvent.create({
        data: {
            razorpayEventId: eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            eventType,
            payload,
            processed: false,
        },
    });
    // 5. Determine merchant — use the first merchant in DB (demo setup)
    const merchant = await database_1.default.merchant.findFirst();
    const merchantId = merchant?.id || '';
    // 6. Dispatch to handler
    try {
        switch (eventType) {
            case 'payment.failed':
                await (0, recovery_service_1.handlePaymentFailed)(payload, merchantId);
                break;
            case 'payment.captured':
                await (0, recovery_service_1.handlePaymentCaptured)(payload, merchantId);
                break;
            case 'payment_link.paid':
                await (0, recovery_service_1.handlePaymentLinkPaid)(payload, merchantId);
                break;
            case 'payment_link.expired':
                await (0, recovery_service_1.handlePaymentLinkExpired)(payload, merchantId);
                break;
            case 'payment_link.cancelled':
                await (0, recovery_service_1.handlePaymentLinkCancelled)(payload, merchantId);
                break;
            default:
                console.log(`Unhandled webhook event type: ${eventType}`);
        }
        // 7. Mark as processed
        await database_1.default.webhookEvent.update({
            where: { id: webhookEvent.id },
            data: { processed: true, processedAt: new Date() },
        });
    }
    catch (error) {
        console.error(`Error processing webhook ${eventType}:`, error);
        // Still return 200 to prevent Razorpay retry storms
    }
    return res.status(200).json({ status: 'ok' });
}
//# sourceMappingURL=webhook.controller.js.map