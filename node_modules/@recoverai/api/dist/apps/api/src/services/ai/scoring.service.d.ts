export interface ScoringInput {
    payment: {
        amount: number;
        method: string;
        errorCode: string | null;
        failureReason: string | null;
    };
    customerHistory: {
        totalPayments: number;
        successfulPayments: number;
        failedPayments: number;
        averageAmount: number;
        previousRecoveries: number;
        customerAgeDays: number;
    };
}
/**
 * Computes a deterministic recoverability score (0–100).
 */
export declare function computeScore(input: ScoringInput): number;
//# sourceMappingURL=scoring.service.d.ts.map