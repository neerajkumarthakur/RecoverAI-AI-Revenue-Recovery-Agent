export interface CreatePaymentLinkParams {
    amount: number;
    currency?: string;
    referenceId: string;
    description: string;
    customer: {
        name: string;
        email: string;
        contact?: string;
    };
    expiryHours?: number;
}
export interface PaymentLinkResult {
    razorpayPaymentLinkId: string;
    shortUrl: string;
    amount: number;
    expiresAt: Date;
}
export declare function createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult>;
//# sourceMappingURL=paymentLinks.d.ts.map