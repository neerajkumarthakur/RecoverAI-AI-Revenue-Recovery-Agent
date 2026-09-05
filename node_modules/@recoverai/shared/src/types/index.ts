export enum RecoveryCaseStatus {
  OPEN = 'OPEN',
  ANALYZING = 'ANALYZING',
  ACTION_PENDING = 'ACTION_PENDING',
  ACTIONED = 'ACTIONED',
  RECOVERED = 'RECOVERED',
  EXPIRED = 'EXPIRED',
  ESCALATED = 'ESCALATED',
}

export enum ActionType {
  RETRY = 'RETRY',
  PAYMENT_LINK = 'PAYMENT_LINK',
  REMINDER = 'REMINDER',
  ESCALATE = 'ESCALATE',
  NO_ACTION = 'NO_ACTION',
}

export enum ActionStatus {
  PROPOSED = 'PROPOSED',
  APPROVED = 'APPROVED',
  EXECUTED = 'EXECUTED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ActorType {
  AI = 'AI',
  SYSTEM = 'SYSTEM',
  MERCHANT = 'MERCHANT',
}

export enum FailureCategory {
  TEMPORARY_FAILURE = 'TEMPORARY_FAILURE',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  BANK_DECLINE = 'BANK_DECLINE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  FRAUD_SUSPECTED = 'FRAUD_SUSPECTED',
  CUSTOMER_CANCELLED = 'CUSTOMER_CANCELLED',
  TECHNICAL_ERROR = 'TECHNICAL_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface DiagnosisResult {
  failureCategory: FailureCategory;
  recoverabilityScore: number;
  confidence: number;
  recommendedAction: ActionType;
  reason: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PolicyCheckResult {
  allowed: boolean;
  blockedReason?: string;
}
