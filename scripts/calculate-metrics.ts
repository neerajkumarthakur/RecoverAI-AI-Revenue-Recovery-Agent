import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../packages/database/src/client';

const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

async function main() {
  const merchantId = (
    await prisma.merchant.findUnique({ where: { email: 'demo@recoverai.com' } })
  )?.id;

  if (!merchantId) {
    console.error('❌ Merchant not found. Run seed.ts first.');
    process.exit(1);
  }

  const totalPayments = await prisma.payment.count({ where: { merchantId } });
  const failedPayments = await prisma.payment.count({ where: { merchantId, status: 'failed' } });

  // Revenue at risk = sum of all failed payment amounts
  const revenueAtRiskResult = await prisma.payment.aggregate({
    where: { merchantId, status: 'failed' },
    _sum: { amount: true },
  });
  const revenueAtRisk = revenueAtRiskResult._sum.amount ?? 0;

  // Eligible revenue = sum of failed payments where recovery case score >= 50
  const eligibleCases = await prisma.recoveryCase.findMany({
    where: { merchantId, recoverabilityScore: { gte: 50 } },
    select: { amountAtRisk: true },
  });
  const eligibleRevenue = eligibleCases.reduce((sum, c) => sum + c.amountAtRisk, 0);

  // Recovered revenue
  const recoveredResult = await prisma.recoveryCase.aggregate({
    where: { merchantId, status: 'RECOVERED' },
    _sum: { amountAtRisk: true },
  });
  const recoveredRevenue = recoveredResult._sum.amountAtRisk ?? 0;

  // Recovery rate = recovered / total failed
  const recoveryRate = failedPayments > 0 ? (recoveredRevenue / revenueAtRisk) * 100 : 0;

  // Avg recovery time (minutes) = avg of (recoveredAt - createdAt) for RECOVERED cases
  const recoveredCases = await prisma.recoveryCase.findMany({
    where: { merchantId, status: 'RECOVERED', recoveredAt: { not: null } },
    select: { createdAt: true, recoveredAt: true },
  });
  const avgRecoveryMinutes =
    recoveredCases.length > 0
      ? recoveredCases.reduce((sum, c) => {
          const diffMs = (c.recoveredAt as Date).getTime() - c.createdAt.getTime();
          return sum + diffMs / 60000;
        }, 0) / recoveredCases.length
      : 0;

  // Action success rate = RECOVERED / (total with recovery actions)
  const totalActioned = await prisma.recoveryCase.count({
    where: { merchantId, status: { in: ['RECOVERED', 'ACTIONED', 'ACTION_PENDING'] } },
  });
  const actionSuccessRate = totalActioned > 0 ? (recoveredCases.length / totalActioned) * 100 : 0;

  // Escalation rate = ESCALATED / total failed
  const escalatedCount = await prisma.recoveryCase.count({
    where: { merchantId, status: 'ESCALATED' },
  });
  const escalationRate = failedPayments > 0 ? (escalatedCount / failedPayments) * 100 : 0;

  const openCount = await prisma.recoveryCase.count({
    where: { merchantId, status: 'OPEN' },
  });

  console.log('\n=== RecoverAI Batch Metrics ===');
  console.log(`Total Payments:              ${totalPayments}`);
  console.log(`Failed Payments:             ${failedPayments}`);
  console.log(`Revenue At Risk (total failed): ${inr(revenueAtRisk)}`);
  console.log(`Eligible Revenue (score >= 50): ${inr(eligibleRevenue)}`);
  console.log(`Recovered Revenue:           ${inr(recoveredRevenue)}`);
  console.log(`Recovery Rate:               ${recoveryRate.toFixed(1)}%`);
  console.log(`Avg Recovery Time:           ${Math.round(avgRecoveryMinutes)} min`);
  console.log(`Action Success Rate:         ${actionSuccessRate.toFixed(1)}%`);
  console.log(`Escalation Rate:             ${escalationRate.toFixed(1)}%`);
  console.log(`Open Cases:                  ${openCount}`);
  console.log(`Escalated Cases:             ${escalatedCount}`);
  console.log('===================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Metrics failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
