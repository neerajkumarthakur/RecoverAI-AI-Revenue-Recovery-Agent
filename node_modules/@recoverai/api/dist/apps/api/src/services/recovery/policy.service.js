"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POLICY = void 0;
exports.canExecuteAction = canExecuteAction;
function canExecuteAction(input, policy) {
    if (input.attemptCount >= policy.maxAttempts) {
        return {
            allowed: false,
            blockedReason: `Maximum attempts (${policy.maxAttempts}) reached`,
        };
    }
    if (input.amountAtRisk > policy.maxAutoRecoveryAmountPaise) {
        return {
            allowed: false,
            blockedReason: `Amount exceeds maximum auto-recovery limit of ₹${policy.maxAutoRecoveryAmountPaise / 100}`,
        };
    }
    if (input.aiConfidence < policy.minConfidence) {
        return {
            allowed: false,
            blockedReason: `AI confidence (${(input.aiConfidence * 100).toFixed(0)}%) below minimum threshold (${(policy.minConfidence * 100).toFixed(0)}%)`,
        };
    }
    if (new Date() > input.deadline) {
        return { allowed: false, blockedReason: 'Recovery window has expired' };
    }
    if (input.recoverabilityScore < 50) {
        return {
            allowed: false,
            blockedReason: `Recoverability score (${input.recoverabilityScore}) too low for automated recovery`,
        };
    }
    return { allowed: true };
}
exports.DEFAULT_POLICY = {
    maxAttempts: 2,
    maxAutoRecoveryAmountPaise: 1000000, // ₹10,000
    recoveryWindowHours: 72,
    minConfidence: 0.6,
};
//# sourceMappingURL=policy.service.js.map