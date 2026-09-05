import { Request, Response } from 'express';
import prisma from '@recoverai/database';

export async function summaryHandler(_req: Request, res: Response) {
  try {
    const activeStatuses = ['OPEN', 'ANALYZING', 'ACTION_PENDING', 'ACTIONED', 'ESCALATED'];

    const [
      revenueAtRiskAgg,
      recoveredRevenueAgg,
      openCases,
      failedPayments,
      paymentLinksGenerated,
      successfulRecoveries,
      escalatedCases,
      analyzingCases,
      actionPendingCases,
      actionedCases,
    ] = await Promise.all([
      prisma.recoveryCase.aggregate({
        _sum: { amountAtRisk: true },
        where: { status: { in: activeStatuses as never[] } },
      }),
      prisma.recoveryCase.aggregate({
        _sum: { amountAtRisk: true },
        where: { status: 'RECOVERED' as never },
      }),
      prisma.recoveryCase.count({ where: { status: 'OPEN' as never } }),
      prisma.payment.count({ where: { status: 'failed' } }),
      prisma.paymentLink.count(),
      prisma.recoveryCase.count({ where: { status: 'RECOVERED' as never } }),
      prisma.recoveryCase.count({ where: { status: 'ESCALATED' as never } }),
      prisma.recoveryCase.count({ where: { status: 'ANALYZING' as never } }),
      prisma.recoveryCase.count({ where: { status: 'ACTION_PENDING' as never } }),
      prisma.recoveryCase.count({ where: { status: 'ACTIONED' as never } }),
    ]);

    const revenueAtRisk = revenueAtRiskAgg._sum.amountAtRisk ?? 0;
    const recoveredRevenue = recoveredRevenueAgg._sum.amountAtRisk ?? 0;
    const total = revenueAtRisk + recoveredRevenue;
    const recoveryRate =
      total > 0 ? Math.round((recoveredRevenue / total) * 10000) / 100 : 0;

    return res.json({
      revenueAtRisk,
      recoveredRevenue,
      recoveryRate,
      openCases,
      failedPayments,
      paymentLinksGenerated,
      successfulRecoveries,
      escalatedCases,
      analyzingCases,
      actionPendingCases,
      actionedCases,
    });
  } catch (error: any) {
    console.error('Error in summaryHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function trendsHandler(_req: Request, res: Response) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const cases = await prisma.recoveryCase.findMany({
      where: {
        status: 'RECOVERED' as never,
        recoveredAt: { gte: since },
      },
      select: { recoveredAt: true, amountAtRisk: true },
    });

    // Build a map of date string -> total amount
    const map = new Map<string, number>();
    for (const c of cases) {
      if (!c.recoveredAt) continue;
      const key = c.recoveredAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + c.amountAtRisk);
    }

    // Fill all 30 days (oldest first)
    const result: { date: string; amount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, amount: map.get(key) ?? 0 });
    }

    return res.json(result);
  } catch (error: any) {
    console.error('Error in trendsHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function breakdownHandler(_req: Request, res: Response) {
  try {
    const groups = await prisma.recoveryCase.groupBy({
      by: ['failureCategory'],
      _count: { id: true },
      where: { failureCategory: { not: null } },
    });

    const result = groups.map((g) => ({
      category: g.failureCategory,
      count: g._count.id,
    }));

    return res.json(result);
  } catch (error: any) {
    console.error('Error in breakdownHandler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
