export declare function buildSystemPrompt(): string;
export interface DiagnosisFeatures {
    payment: {
        amount: number;
        amountInRupees: number;
        currency: string;
        method: string;
        errorCode: string | null;
        failureReason: string | null;
    };
    customer: {
        name: string;
        totalPayments: number;
        successfulPayments: number;
        failedPayments: number;
        successRate: number;
        averageAmountRupees: number;
        customerAgeDays: number;
        previousRecoveries: number;
    };
    case: {
        recoverabilityScore: number;
        attemptCount: number;
        maxAttempts: number;
        deadlineHoursRemaining: number;
    };
}
export declare function buildUserMessage(features: DiagnosisFeatures): string;
//# sourceMappingURL=prompts.d.ts.map