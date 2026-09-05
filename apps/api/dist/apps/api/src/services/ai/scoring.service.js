"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeScore = computeScore;
function customerHistoryScore(input) {
    const { totalPayments, successfulPayments } = input.customerHistory;
    const score = (successfulPayments / Math.max(totalPayments, 1)) * 30;
    return Math.min(score, 30);
}
function transactionNormality(input) {
    const { averageAmount } = input.customerHistory;
    const { amount } = input.payment;
    if (averageAmount === 0)
        return 10; // neutral — no history
    const deviation = Math.abs(amount - averageAmount) / averageAmount;
    if (deviation < 0.10)
        return 20;
    if (deviation < 0.25)
        return 15;
    if (deviation < 0.50)
        return 10;
    if (deviation < 1.00)
        return 5;
    return 0;
}
function failureTypeScore(input) {
    const { errorCode, failureReason } = input.payment;
    if (errorCode === 'SERVER_ERROR')
        return 20;
    if (errorCode === 'GATEWAY_ERROR')
        return 18;
    if (errorCode === 'BAD_REQUEST_ERROR') {
        const reason = (failureReason ?? '').toLowerCase();
        if (reason.includes('insufficient'))
            return 10;
        if (reason.includes('limit'))
            return 8;
        return 15;
    }
    return 10; // null / unknown
}
function paymentMethodScore(input) {
    switch (input.payment.method) {
        case 'card': return 10;
        case 'upi': return 8;
        case 'netbanking': return 7;
        case 'wallet': return 6;
        default: return 5;
    }
}
function historicalRecovery(input) {
    const { previousRecoveries, successfulPayments } = input.customerHistory;
    if (previousRecoveries >= 2)
        return 15;
    if (previousRecoveries === 1)
        return 10;
    if (previousRecoveries === 0 && successfulPayments >= 3)
        return 7;
    return 3;
}
/**
 * Computes a deterministic recoverability score (0–100).
 */
function computeScore(input) {
    const raw = customerHistoryScore(input) * 1 // already weighted (max 30)
        + transactionNormality(input) * 1 // already weighted (max 20)
        + failureTypeScore(input) * 1 // already weighted (max 25)
        + paymentMethodScore(input) * 1 // already weighted (max 10)
        + historicalRecovery(input) * 1; // already weighted (max 15)
    return Math.round(Math.min(Math.max(raw, 0), 100));
}
//# sourceMappingURL=scoring.service.js.map