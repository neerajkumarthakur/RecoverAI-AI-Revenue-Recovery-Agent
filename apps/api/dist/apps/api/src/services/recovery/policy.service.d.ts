export interface PolicyConfig {
    maxAttempts: number;
    maxAutoRecoveryAmountPaise: number;
    recoveryWindowHours: number;
    minConfidence: number;
}
export interface PolicyCheckInput {
    attemptCount: number;
    amountAtRisk: number;
    deadline: Date;
    aiConfidence: number;
    recoverabilityScore: number;
}
export interface PolicyCheckResult {
    allowed: boolean;
    blockedReason?: string;
}
export declare function canExecuteAction(input: PolicyCheckInput, policy: PolicyConfig): PolicyCheckResult;
export declare const DEFAULT_POLICY: PolicyConfig;
//# sourceMappingURL=policy.service.d.ts.map