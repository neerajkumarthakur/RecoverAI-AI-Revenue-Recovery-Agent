export const POLICY_DEFAULTS = {
  maxAttempts: 2,
  maxAutoRecoveryAmountPaise: 1000000, // ₹10,000 in paise
  recoveryWindowHours: 72,
  minConfidence: 0.6,
} as const;

export const SCORE_THRESHOLDS = {
  HIGH: 70,
  MEDIUM: 50,
} as const;

export const RAZORPAY_ERROR_CODES = {
  BAD_REQUEST_ERROR: 'BAD_REQUEST_ERROR',
  GATEWAY_ERROR: 'GATEWAY_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;
