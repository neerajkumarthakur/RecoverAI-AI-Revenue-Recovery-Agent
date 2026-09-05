import { Request, Response } from 'express';
import { verifyWebhookSignature } from '../services/razorpay/webhooks';
import prisma from '@recoverai/database';
import {
  handlePaymentFailed,
  handlePaymentCaptured,
  handlePaymentLinkPaid,
  handlePaymentLinkExpired,
  handlePaymentLinkCancelled,
} from '../services/recovery/recovery.service';

export async function razorpayWebhookHandler(req: Request, res: Response) {
  const signature = req.headers['x-razorpay-signature'] as string;
  const eventId = req.headers['x-razorpay-event-id'] as string;
  const rawBody = req.body.toString(); // req.body is Buffer from express.raw()

  // 1. Verify signature
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 2. Parse payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const eventType: string = payload.event;

  // 3. Check for duplicate event
  if (eventId) {
    const existing = await prisma.webhookEvent.findUnique({
      where: { razorpayEventId: eventId },
    });
    if (existing) {
      return res.status(200).json({ status: 'already_processed' });
    }
  }

  // 4. Save webhook event (processed: false)
  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      razorpayEventId:
        eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      payload: JSON.stringify(payload),
      processed: false,
    },
  });

  // 5. Determine merchant — use the first merchant in DB (demo setup)
  const merchant = await prisma.merchant.findFirst();
  const merchantId = merchant?.id || '';

  // 6. Dispatch to handler
  try {
    switch (eventType) {
      case 'payment.failed':
        await handlePaymentFailed(payload, merchantId);
        break;
      case 'payment.captured':
        await handlePaymentCaptured(payload, merchantId);
        break;
      case 'payment_link.paid':
        await handlePaymentLinkPaid(payload, merchantId);
        break;
      case 'payment_link.expired':
        await handlePaymentLinkExpired(payload, merchantId);
        break;
      case 'payment_link.cancelled':
        await handlePaymentLinkCancelled(payload, merchantId);
        break;
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    // 7. Mark as processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true, processedAt: new Date() },
    });
  } catch (error) {
    console.error(`Error processing webhook ${eventType}:`, error);
    // Still return 200 to prevent Razorpay retry storms
  }

  return res.status(200).json({ status: 'ok' });
}
