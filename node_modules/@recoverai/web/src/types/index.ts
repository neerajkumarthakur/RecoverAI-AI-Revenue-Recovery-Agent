export type RecoveryCaseStatus =
  | 'OPEN'
  | 'ANALYZING'
  | 'ACTION_PENDING'
  | 'ACTIONED'
  | 'RECOVERED'
  | 'EXPIRED'
  | 'ESCALATED';

export type FailureCategory =
  | 'TEMPORARY_FAILURE'
  | 'INSUFFICIENT_FUNDS'
  | 'BANK_DECLINE'
  | 'NETWORK_ERROR'
  | 'FRAUD_SUSPECTED'
  | 'CUSTOMER_CANCELLED'
  | 'TECHNICAL_ERROR'
  | 'UNKNOWN';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface Payment {
  id: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  errorCode?: string;
  errorDescription?: string;
  failureReason?: string;
  createdAt: string;
}

export interface RecoveryCase {
  id: string;
  caseId: string;
  amountAtRisk: number;
  status: RecoveryCaseStatus;
  failureCategory?: FailureCategory;
  recoverabilityScore?: number;
  aiReason?: string[];
  aiConfidence?: number;
  recommendedAction?: string;
  attemptCount: number;
  maxAttempts: number;
  deadline: string;
  recoveredAt?: string;
  createdAt: string;
  customer: Customer;
  payment?: Payment;
  recoveryActions?: RecoveryAction[];
  paymentLinks?: PaymentLinkRecord[];
  auditLogs?: AuditLog[];
}

export interface RecoveryAction {
  id: string;
  actionType: string;
  status: string;
  reason?: string;
  executedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface PaymentLinkRecord {
  id: string;
  razorpayPaymentLinkId: string;
  shortUrl: string;
  amount: number;
  status: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorType: 'AI' | 'SYSTEM' | 'MERCHANT';
  action: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardSummary {
  revenueAtRisk: number;
  recoveredRevenue: number;
  recoveryRate: number;
  openCases: number;
  failedPayments: number;
  paymentLinksGenerated: number;
  successfulRecoveries: number;
  escalatedCases: number;
  analyzingCases: number;
  actionPendingCases: number;
  actionedCases: number;
}
