import { Request, Response } from 'express';
import { diagnosePayment } from '../services/ai/diagnosis.service';

export async function diagnosePaymentHandler(req: Request, res: Response): Promise<void> {
  try {
    const { paymentId } = req.body as { paymentId?: string };
    if (!paymentId) {
      res.status(400).json({ error: 'paymentId is required' });
      return;
    }

    const merchantId = (req.headers['x-merchant-id'] as string) || '';
    const result = await diagnosePayment(paymentId, merchantId);
    res.json(result);
  } catch (error: unknown) {
    console.error('[AI Controller] Diagnosis error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}
