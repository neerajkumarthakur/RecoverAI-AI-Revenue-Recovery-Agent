import { razorpay } from './client';

export async function fetchPayment(paymentId: string) {
  const payment = await razorpay.payments.fetch(paymentId);
  return payment;
}
