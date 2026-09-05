"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentLink = createPaymentLink;
const client_1 = require("./client");
async function createPaymentLink(params) {
    const { amount, currency = 'INR', referenceId, description, customer, expiryHours = 72, } = params;
    const expireBy = Math.floor(Date.now() / 1000) + expiryHours * 3600;
    const result = await client_1.razorpay.paymentLink.create({
        amount,
        currency,
        reference_id: referenceId,
        description,
        customer,
        reminder_enable: true,
        upi_link: true,
        expire_by: expireBy,
    });
    return {
        razorpayPaymentLinkId: result.id,
        shortUrl: result.short_url,
        amount: result.amount,
        expiresAt: new Date(result.expire_by * 1000),
    };
}
//# sourceMappingURL=paymentLinks.js.map