"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = verifyWebhookSignature;
const razorpay_1 = __importDefault(require("razorpay"));
function verifyWebhookSignature(rawBody, signature, secret) {
    try {
        return razorpay_1.default.validateWebhookSignature(rawBody, signature, secret);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=webhooks.js.map