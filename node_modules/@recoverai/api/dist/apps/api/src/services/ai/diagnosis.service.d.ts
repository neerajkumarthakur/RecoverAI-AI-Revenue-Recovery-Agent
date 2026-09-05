export interface DiagnosisResult {
    failureCategory: string;
    recoverabilityScore: number;
    aiScore: number;
    confidence: number;
    recommendedAction: string;
    reason: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    whyNotRetry?: string;
    stoppingRules?: string;
}
/**
 * Runs the full AI diagnosis pipeline for a failed payment.
 *
 * Steps:
 *  1. Fetch payment + customer from DB
 *  2. Load customer payment history (last 20 payments)
 *  3. Compute deterministic recoverability score
 *  4. Call GPT-4o-mini for structured diagnosis
 *  5. Persist results to RecoveryCase + AuditLog
 *  6. Return DiagnosisResult
 */
export declare function diagnosePayment(paymentId: string, merchantId: string): Promise<DiagnosisResult>;
//# sourceMappingURL=diagnosis.service.d.ts.map