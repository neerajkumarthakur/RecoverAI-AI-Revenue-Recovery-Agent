import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../packages/database/src/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

function randAmount(): number {
  const bucket = randInt(0, 2);
  if (bucket === 0) return randInt(500, 1999) * 100;   // small
  if (bucket === 1) return randInt(2000, 9999) * 100;  // medium
  return randInt(10000, 25000) * 100;                  // large
}

function uid(prefix: string, index: number): string {
  return `${prefix}_demo${String(index).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Static data tables (plain strings — SQLite has no native enums)
// ---------------------------------------------------------------------------

const ERROR_TABLE: Array<{ errorCode: string; failureReason: string; failureCategory: string }> = [
  { errorCode: 'BAD_REQUEST_ERROR', failureReason: 'Payment failed due to insufficient funds', failureCategory: 'INSUFFICIENT_FUNDS' },
  { errorCode: 'BAD_REQUEST_ERROR', failureReason: 'UPI PIN is incorrect', failureCategory: 'BANK_DECLINE' },
  { errorCode: 'BAD_REQUEST_ERROR', failureReason: 'Transaction limit exceeded', failureCategory: 'TEMPORARY_FAILURE' },
  { errorCode: 'GATEWAY_ERROR', failureReason: 'Bank server is not responding', failureCategory: 'NETWORK_ERROR' },
  { errorCode: 'GATEWAY_ERROR', failureReason: 'Unable to connect to gateway', failureCategory: 'NETWORK_ERROR' },
  { errorCode: 'GATEWAY_ERROR', failureReason: 'Gateway timeout', failureCategory: 'NETWORK_ERROR' },
  { errorCode: 'SERVER_ERROR', failureReason: 'Technical error occurred', failureCategory: 'TECHNICAL_ERROR' },
  { errorCode: 'SERVER_ERROR', failureReason: 'Internal server error', failureCategory: 'TECHNICAL_ERROR' },
];

const METHODS: string[] = ['upi', 'card', 'netbanking', 'wallet'];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🚀 Generating demo data...');

  // Look up merchant + customers
  const merchant = await prisma.merchant.findUnique({ where: { email: 'demo@recoverai.com' } });
  if (!merchant) {
    console.error('❌ Merchant not found. Run seed.ts first.');
    process.exit(1);
  }

  const customers = await prisma.customer.findMany({ where: { merchantId: merchant.id } });
  if (customers.length < 50) {
    console.error(`❌ Expected 50 customers, found ${customers.length}. Run seed.ts first.`);
    process.exit(1);
  }

  // Guard: skip if already generated
  const existingPayments = await prisma.payment.count({ where: { merchantId: merchant.id } });
  if (existingPayments > 0) {
    console.log(`✅ Demo data already exists (${existingPayments} payments) — skipping.`);
    return;
  }

  const merchantId = merchant.id;

  // -------------------------------------------------------------------------
  // 700 captured payments (spread over past 90 days, all 50 customers)
  // -------------------------------------------------------------------------
  console.log('  Creating 700 captured payments...');
  for (let i = 0; i < 700; i++) {
    const customer = customers[i % 50];
    const createdAt = daysAgo(randInt(1, 90));
    await prisma.payment.create({
      data: {
        merchantId,
        customerId: customer.id,
        razorpayPaymentId: uid('pay', i),
        amount: randAmount(),
        method: METHODS[i % METHODS.length],
        status: 'captured',
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  // -------------------------------------------------------------------------
  // 100 refunded payments
  // -------------------------------------------------------------------------
  console.log('  Creating 100 refunded payments...');
  for (let i = 0; i < 100; i++) {
    const customer = customers[i % 50];
    const createdAt = daysAgo(randInt(1, 90));
    await prisma.payment.create({
      data: {
        merchantId,
        customerId: customer.id,
        razorpayPaymentId: uid('pay', 700 + i),
        amount: randAmount(),
        method: METHODS[i % METHODS.length],
        status: 'refunded',
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  // -------------------------------------------------------------------------
  // 200 failed payments + recovery cases
  // -------------------------------------------------------------------------
  console.log('  Creating 200 failed payments and recovery cases...');

  // Case distribution: 80 RECOVERED | 25 ACTIONED | 25 ACTION_PENDING | 30 ESCALATED | 40 OPEN
  type CaseBucket = 'RECOVERED' | 'ACTIONED' | 'ACTION_PENDING' | 'ESCALATED' | 'OPEN';
  const buckets: CaseBucket[] = [
    ...Array(80).fill('RECOVERED'),
    ...Array(25).fill('ACTIONED'),
    ...Array(25).fill('ACTION_PENDING'),
    ...Array(30).fill('ESCALATED'),
    ...Array(40).fill('OPEN'),
  ];

  let plinkCounter = 0;
  let auditCounter = 0;
  let actionCounter = 0;

  for (let i = 0; i < 200; i++) {
    const customer = customers[i % 50];
    const errorEntry = ERROR_TABLE[i % ERROR_TABLE.length];
    const bucket: CaseBucket = buckets[i];
    const amount = randAmount();

    // Payment timestamp: between 72h and 90 days ago
    const createdAt = daysAgo(randInt(1, 90));
    const deadline = minutesAfter(createdAt, 72 * 60);

    const payment = await prisma.payment.create({
      data: {
        merchantId,
        customerId: customer.id,
        razorpayPaymentId: uid('pay', 800 + i),
        amount,
        method: METHODS[i % METHODS.length],
        status: 'failed',
        errorCode: errorEntry.errorCode,
        errorDescription: errorEntry.failureReason,
        failureReason: errorEntry.failureReason,
        createdAt,
        updatedAt: createdAt,
      },
    });

    // ----- RECOVERED -------------------------------------------------------
    if (bucket === 'RECOVERED') {
      const score = randInt(70, 95);
      const confidence = parseFloat(randFloat(0.75, 0.95).toFixed(2));
      const recoveredAt = minutesAfter(createdAt, randInt(30, 180));

      const recoveryCase = await prisma.recoveryCase.create({
        data: {
          merchantId,
          customerId: customer.id,
          paymentId: payment.id,
          amountAtRisk: amount,
          status: 'RECOVERED',
          failureCategory: errorEntry.failureCategory,
          recoverabilityScore: score,
          aiConfidence: confidence,
          aiReason: JSON.stringify([
            `Customer has ${randInt(3, 20)} successful historical payments`,
            'Amount is within historical range',
            'Only isolated failure observed',
          ]),
          recommendedAction: 'PAYMENT_LINK',
          attemptCount: 1,
          deadline,
          recoveredAt,
          createdAt,
          updatedAt: recoveredAt,
        },
      });

      const execAt = minutesAfter(createdAt, 5);
      const completeAt = minutesAfter(createdAt, randInt(30, 180));

      await prisma.recoveryAction.create({
        data: {
          recoveryCaseId: recoveryCase.id,
          actionType: 'PAYMENT_LINK',
          status: 'SUCCESS',
          executedAt: execAt,
          completedAt: completeAt,
          createdAt,
          updatedAt: completeAt,
        },
      });
      actionCounter++;

      const suffix = uid('', plinkCounter++).replace('_demo', '');
      await prisma.paymentLink.create({
        data: {
          recoveryCaseId: recoveryCase.id,
          razorpayPaymentLinkId: `plink${suffix}`,
          shortUrl: `https://rzp.io/l/${suffix.replace('0', 'r').substring(0, 8)}`,
          amount,
          status: 'paid',
          expiresAt: minutesAfter(createdAt, 72 * 60),
          createdAt,
          updatedAt: recoveredAt,
        },
      });

      const auditEntries = [
        { action: 'CASE_CREATED', actorType: 'SYSTEM', createdAt },
        { action: 'CASE_ANALYZED', actorType: 'AI', createdAt: minutesAfter(createdAt, 1) },
        { action: 'ACTION_APPROVED', actorType: 'AI', createdAt: minutesAfter(createdAt, 2) },
        { action: 'ACTION_EXECUTED', actorType: 'SYSTEM', createdAt: execAt },
        { action: 'CASE_RECOVERED', actorType: 'SYSTEM', createdAt: recoveredAt },
      ];
      for (const entry of auditEntries) {
        await prisma.auditLog.create({
          data: { merchantId, recoveryCaseId: recoveryCase.id, ...entry },
        });
        auditCounter++;
      }

    // ----- ACTIONED --------------------------------------------------------
    } else if (bucket === 'ACTIONED') {
      const score = randInt(50, 69);
      const confidence = parseFloat(randFloat(0.60, 0.74).toFixed(2));

      const recoveryCase = await prisma.recoveryCase.create({
        data: {
          merchantId,
          customerId: customer.id,
          paymentId: payment.id,
          amountAtRisk: amount,
          status: 'ACTIONED',
          failureCategory: errorEntry.failureCategory,
          recoverabilityScore: score,
          aiConfidence: confidence,
          aiReason: JSON.stringify([
            `Customer has ${randInt(1, 10)} successful historical payments`,
            'Amount is moderate',
            'Failure may be transient',
          ]),
          recommendedAction: 'PAYMENT_LINK',
          attemptCount: 1,
          deadline,
          createdAt,
          updatedAt: createdAt,
        },
      });

      await prisma.recoveryAction.create({
        data: {
          recoveryCaseId: recoveryCase.id,
          actionType: 'PAYMENT_LINK',
          status: 'EXECUTED',
          executedAt: minutesAfter(createdAt, 5),
          createdAt,
          updatedAt: minutesAfter(createdAt, 5),
        },
      });
      actionCounter++;

      const auditEntries = [
        { action: 'CASE_CREATED', actorType: 'SYSTEM', createdAt },
        { action: 'CASE_ANALYZED', actorType: 'AI', createdAt: minutesAfter(createdAt, 1) },
        { action: 'ACTION_APPROVED', actorType: 'AI', createdAt: minutesAfter(createdAt, 2) },
      ];
      for (const entry of auditEntries) {
        await prisma.auditLog.create({
          data: { merchantId, recoveryCaseId: recoveryCase.id, ...entry },
        });
        auditCounter++;
      }

    // ----- ACTION_PENDING --------------------------------------------------
    } else if (bucket === 'ACTION_PENDING') {
      const score = randInt(50, 69);
      const confidence = parseFloat(randFloat(0.60, 0.74).toFixed(2));

      const recoveryCase = await prisma.recoveryCase.create({
        data: {
          merchantId,
          customerId: customer.id,
          paymentId: payment.id,
          amountAtRisk: amount,
          status: 'ACTION_PENDING',
          failureCategory: errorEntry.failureCategory,
          recoverabilityScore: score,
          aiConfidence: confidence,
          aiReason: JSON.stringify([
            `Customer has ${randInt(1, 10)} successful historical payments`,
            'Amount is moderate',
            'Awaiting merchant approval',
          ]),
          recommendedAction: 'PAYMENT_LINK',
          attemptCount: 0,
          deadline,
          createdAt,
          updatedAt: createdAt,
        },
      });

      await prisma.recoveryAction.create({
        data: {
          recoveryCaseId: recoveryCase.id,
          actionType: 'PAYMENT_LINK',
          status: 'APPROVED',
          createdAt,
          updatedAt: createdAt,
        },
      });
      actionCounter++;

      const auditEntries = [
        { action: 'CASE_CREATED', actorType: 'SYSTEM', createdAt },
        { action: 'CASE_ANALYZED', actorType: 'AI', createdAt: minutesAfter(createdAt, 1) },
        { action: 'ACTION_APPROVED', actorType: 'AI', createdAt: minutesAfter(createdAt, 2) },
      ];
      for (const entry of auditEntries) {
        await prisma.auditLog.create({
          data: { merchantId, recoveryCaseId: recoveryCase.id, ...entry },
        });
        auditCounter++;
      }

    // ----- ESCALATED -------------------------------------------------------
    } else if (bucket === 'ESCALATED') {
      const score = randInt(20, 49);
      const confidence = parseFloat(randFloat(0.30, 0.59).toFixed(2));

      const recoveryCase = await prisma.recoveryCase.create({
        data: {
          merchantId,
          customerId: customer.id,
          paymentId: payment.id,
          amountAtRisk: amount,
          status: 'ESCALATED',
          failureCategory: errorEntry.failureCategory,
          recoverabilityScore: score,
          aiConfidence: confidence,
          aiReason: JSON.stringify(['Low recoverability score', 'Multiple failure signals detected']),
          recommendedAction: 'NO_ACTION',
          attemptCount: 0,
          deadline,
          createdAt,
          updatedAt: createdAt,
        },
      });

      const auditEntries = [
        { action: 'CASE_CREATED', actorType: 'SYSTEM', createdAt },
        {
          action: 'CASE_ESCALATED',
          actorType: 'AI',
          reason: 'Score below escalation threshold; requires manual review',
          createdAt: minutesAfter(createdAt, 1),
        },
      ];
      for (const entry of auditEntries) {
        await prisma.auditLog.create({
          data: { merchantId, recoveryCaseId: recoveryCase.id, ...entry },
        });
        auditCounter++;
      }

    // ----- OPEN ------------------------------------------------------------
    } else {
      const recoveryCase = await prisma.recoveryCase.create({
        data: {
          merchantId,
          customerId: customer.id,
          paymentId: payment.id,
          amountAtRisk: amount,
          status: 'OPEN',
          attemptCount: 0,
          deadline,
          createdAt,
          updatedAt: createdAt,
        },
      });

      await prisma.auditLog.create({
        data: { merchantId, recoveryCaseId: recoveryCase.id, action: 'CASE_CREATED', actorType: 'SYSTEM', createdAt },
      });
      auditCounter++;
    }
  }

  console.log(`✅ 200 failed payments + recovery cases created`);
  console.log(`   Recovery actions: ${actionCounter}`);
  console.log(`   Audit log entries: ${auditCounter}`);
  console.log('🎉 Demo data generation complete.');
}

main()
  .catch((e) => {
    console.error('❌ Generation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
