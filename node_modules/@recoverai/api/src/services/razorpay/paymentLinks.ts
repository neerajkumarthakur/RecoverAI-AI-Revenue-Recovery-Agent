import { razorpay } from './client';

export interface CreatePaymentLinkParams {
  amount: number;       // in paise
  currency?: string;    // default 'INR'
  referenceId: string;  // recovery case id
  description: string;
  customer: {
    name: string;
    email: string;
    contact?: string;
  };
  expiryHours?: number; // default 72
}

export interface PaymentLinkResult {
  razorpayPaymentLinkId: string;
  shortUrl: string;
  amount: number;
  expiresAt: Date;
}

export async function createPaymentLink(
  params: CreatePaymentLinkParams
): Promise<PaymentLinkResult> {
  const {
    amount,
    currency = 'INR',
    referenceId,
    description,
    customer,
    expiryHours = 72,
  } = params;

  const expireBy = Math.floor(Date.now() / 1000) + expiryHours * 3600;

  const result = await (razorpay.paymentLink as any).create({
    amount,
    currency,
    reference_id: referenceId,
    description,
    customer,
    reminder_enable: true,
    upi_link: true,
    expire_by: expireBy,
  });

  return {
    razorpayPaymentLinkId: result.id,
    shortUrl: result.short_url,
    amount: result.amount,
    expiresAt: new Date(result.expire_by * 1000),
  };
}
