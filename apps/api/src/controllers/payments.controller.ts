import { Request, Response } from 'express';
import prisma from '@recoverai/database';

export async function listPaymentsHandler(req: Request, res: Response) {
  try {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const statusFilter = status ? { status: status as never } : undefined;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: statusFilter,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true } },
        },
      }),
      prisma.payment.count({ where: statusFilter }),
    ]);

    return res.json({
      payments,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('Error in listPaymentsHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function getPaymentHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        recoveryCase: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    return res.json(payment);
  } catch (error: any) {
    console.error('Error in getPaymentHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
