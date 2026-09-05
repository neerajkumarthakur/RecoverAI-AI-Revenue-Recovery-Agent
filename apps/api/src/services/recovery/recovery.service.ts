import prisma from '@recoverai/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPaymentMethod(raw: string | undefined): string {
  const allowed = ['upi', 'card', 'netbanking', 'wallet', 'emi'];
  const lower = (raw ?? '').toLowerCase();
  return allowed.includes(lower) ? lower : 'other';
}

async function findOrCreateCustomer(
  merchantId: string,
  email: string,
  phone: string | undefined,
  name: string
) {
  const existing = await prisma.customer.findFirst({
    where: { merchantId, email },
  });
  if (existing) return existing;

  return prisma.customer.create({
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

export async function handlePaymentFailed(
  payload: any,
  merchantId: string
): Promise<void> {
  try {
    const entity = payload?.payload?.payment?.entity;
    if (!entity) {
      console.error('handlePaymentFailed: missing payment entity in payload');
      return;
    }

    const email: string = entity.email ?? 'unknown@unknown.com';
    const phone: string | undefined = entity.contact ?? undefined;
    const name: string = entity.notes?.name ?? 'Unknown';

    const customer = await findOrCreateCustomer(merchantId, email, phone, name);

    // Upsert Payment
    const payment = await prisma.payment.upsert({
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
    const existing = await prisma.recoveryCase.findUnique({
      where: { paymentId: payment.id },
    });
    if (existing) {
      console.log(`RecoveryCase already exists for paymentId=${payment.id}, skipping`);
      return;
    }

    const recoveryCase = await prisma.recoveryCase.create({
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

    await prisma.auditLog.create({
      data: {
        merchantId,
        recoveryCaseId: recoveryCase.id,
        actorType: 'SYSTEM',
        action: 'CASE_CREATED',
        reason: 'Payment failed webhook received',
      },
    });
  } catch (error) {
    console.error('handlePaymentFailed error:', error);
  }
}

// ---------------------------------------------------------------------------
// handlePaymentCaptured
// ---------------------------------------------------------------------------

export async function handlePaymentCaptured(
  payload: any,
  merchantId: string
): Promise<void> {
  try {
    const entity = payload?.payload?.payment?.entity;
    if (!entity) {
      console.error('handlePaymentCaptured: missing payment entity in payload');
      return;
    }

    const payment = await prisma.payment.update({
      where: { razorpayPaymentId: entity.id },
      data: { status: 'captured' },
    });

    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { paymentId: payment.id },
    });

    if (recoveryCase && recoveryCase.status === 'ACTIONED') {
      await prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: { status: 'RECOVERED', recoveredAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          merchantId,
          recoveryCaseId: recoveryCase.id,
          actorType: 'SYSTEM',
          action: 'CASE_RECOVERED',
          reason: 'Payment captured webhook received',
        },
      });
    }
  } catch (error) {
    console.error('handlePaymentCaptured error:', error);
  }
}

// ---------------------------------------------------------------------------
// handlePaymentLinkPaid
// ---------------------------------------------------------------------------

export async function handlePaymentLinkPaid(
  payload: any,
  merchantId: string
): Promise<void> {
  try {
    const entity = payload?.payload?.payment_link?.entity;
    if (!entity) {
      console.error('handlePaymentLinkPaid: missing payment_link entity in payload');
      return;
    }

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { razorpayPaymentLinkId: entity.id },
    });
    if (!paymentLink) {
      console.error(`handlePaymentLinkPaid: PaymentLink not found for id=${entity.id}`);
      return;
    }

    await prisma.recoveryCase.update({
      where: { id: paymentLink.recoveryCaseId },
      data: { status: 'RECOVERED', recoveredAt: new Date() },
    });

    await prisma.paymentLink.update({
      where: { id: paymentLink.id },
      data: { status: 'paid' },
    });

    const latestAction = await prisma.recoveryAction.findFirst({
      where: { recoveryCaseId: paymentLink.recoveryCaseId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestAction) {
      await prisma.recoveryAction.update({
        where: { id: latestAction.id },
        data: { status: 'SUCCESS', completedAt: new Date() },
      });
    }

    await prisma.auditLog.create({
      data: {
        merchantId,
        recoveryCaseId: paymentLink.recoveryCaseId,
        actorType: 'SYSTEM',
        action: 'CASE_RECOVERED',
        reason: 'Payment link paid via webhook',
      },
    });
  } catch (error) {
    console.error('handlePaymentLinkPaid error:', error);
  }
}

// ---------------------------------------------------------------------------
// handlePaymentLinkExpired
// ---------------------------------------------------------------------------

export async function handlePaymentLinkExpired(
  payload: any,
  merchantId: string
): Promise<void> {
  try {
    const entity = payload?.payload?.payment_link?.entity;
    if (!entity) {
      console.error('handlePaymentLinkExpired: missing payment_link entity in payload');
      return;
    }

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { razorpayPaymentLinkId: entity.id },
    });
    if (!paymentLink) {
      console.error(`handlePaymentLinkExpired: PaymentLink not found for id=${entity.id}`);
      return;
    }

    await prisma.recoveryCase.update({
      where: { id: paymentLink.recoveryCaseId },
      data: { status: 'EXPIRED' },
    });

    await prisma.paymentLink.update({
      where: { id: paymentLink.id },
      data: { status: 'expired' },
    });

    await prisma.auditLog.create({
      data: {
        merchantId,
        recoveryCaseId: paymentLink.recoveryCaseId,
        actorType: 'SYSTEM',
        action: 'CASE_EXPIRED',
        reason: 'Payment link expired via webhook',
      },
    });
  } catch (error) {
    console.error('handlePaymentLinkExpired error:', error);
  }
}

// ---------------------------------------------------------------------------
// handlePaymentLinkCancelled
// ---------------------------------------------------------------------------

export async function handlePaymentLinkCancelled(
  payload: any,
  merchantId: string
): Promise<void> {
  try {
    const entity = payload?.payload?.payment_link?.entity;
    if (!entity) {
      console.error('handlePaymentLinkCancelled: missing payment_link entity in payload');
      return;
    }

    const paymentLink = await prisma.paymentLink.findUnique({
      where: { razorpayPaymentLinkId: entity.id },
    });
    if (!paymentLink) {
      console.error(`handlePaymentLinkCancelled: PaymentLink not found for id=${entity.id}`);
      return;
    }

    await prisma.recoveryCase.update({
      where: { id: paymentLink.recoveryCaseId },
      data: { status: 'EXPIRED' },
    });

    await prisma.paymentLink.update({
      where: { id: paymentLink.id },
      data: { status: 'cancelled' },
    });

    await prisma.auditLog.create({
      data: {
        merchantId,
        recoveryCaseId: paymentLink.recoveryCaseId,
        actorType: 'SYSTEM',
        action: 'CASE_EXPIRED',
        reason: 'Payment link cancelled via webhook',
      },
    });
  } catch (error) {
    console.error('handlePaymentLinkCancelled error:', error);
  }
}
