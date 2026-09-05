"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPayment = fetchPayment;
const client_1 = require("./client");
async function fetchPayment(paymentId) {
    const payment = await client_1.razorpay.payments.fetch(paymentId);
    return payment;
}
//# sourceMappingURL=payments.js.map