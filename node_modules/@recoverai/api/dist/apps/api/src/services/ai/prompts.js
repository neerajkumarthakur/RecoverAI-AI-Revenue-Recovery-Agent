"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildUserMessage = buildUserMessage;
function buildSystemPrompt() {
    return `You are RecoverAI's payment recovery decision engine.

Your job is to diagnose payment failures and recommend one bounded recovery action.

You MUST:
- Use only the supplied transaction and customer data
- Explain your decision with specific evidence from the data
- Never invent payment information
- Never initiate a payment yourself
- Select only an allowed action from the list below
- Respect merchant policy constraints
- Return valid JSON only

Allowed actions:
- NO_ACTION: When recovery is unlikely or risky
- PAYMENT_LINK: Send a payment link to the customer (preferred for recoverable failures)
- RETRY: For technical failures where immediate retry makes sense
- ESCALATE: When human review is needed

Failure categories:
- TEMPORARY_FAILURE: Transient technical issue, likely retryable
- INSUFFICIENT_FUNDS: Customer had insufficient funds
- BANK_DECLINE: Bank rejected the transaction
- NETWORK_ERROR: Network/connectivity issue
- FRAUD_SUSPECTED: Fraud signals detected
- CUSTOMER_CANCELLED: Customer cancelled intentionally
- TECHNICAL_ERROR: System or gateway error
- UNKNOWN: Cannot determine cause

Risk levels: LOW, MEDIUM, HIGH

Your response must be valid JSON matching exactly this schema:
{
  "failureCategory": string,
  "recoverabilityScore": number (0-100),
  "confidence": number (0-1),
  "recommendedAction": string,
  "reason": string[] (2-4 bullet points explaining the decision),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "whyNotRetry": string (brief explanation of why retry was/wasn't chosen),
  "stoppingRules": string (what limits apply to this case)
}`;
}
function buildUserMessage(features) {
    return `Analyze this failed payment and provide a recovery recommendation.

PAYMENT DETAILS:
- Amount: ₹${features.payment.amountInRupees} (${features.payment.amount} paise)
- Method: ${features.payment.method}
- Error Code: ${features.payment.errorCode || 'None'}
- Failure Reason: ${features.payment.failureReason || 'Not provided'}
- Currency: ${features.payment.currency}

CUSTOMER HISTORY:
- Name: ${features.customer.name}
- Total Payments: ${features.customer.totalPayments}
- Successful: ${features.customer.successfulPayments} (${(features.customer.successRate * 100).toFixed(0)}% success rate)
- Failed: ${features.customer.failedPayments}
- Average Transaction: ₹${features.customer.averageAmountRupees}
- Customer Since: ${features.customer.customerAgeDays} days ago
- Previous Successful Recoveries: ${features.customer.previousRecoveries}

RECOVERY CASE:
- Deterministic Recoverability Score: ${features.case.recoverabilityScore}/100
- Previous Recovery Attempts: ${features.case.attemptCount}
- Maximum Allowed Attempts: ${features.case.maxAttempts}
- Recovery Window Remaining: ${features.case.deadlineHoursRemaining.toFixed(1)} hours

Based on this data, provide your diagnosis and recovery recommendation.`;
}
//# sourceMappingURL=prompts.js.map