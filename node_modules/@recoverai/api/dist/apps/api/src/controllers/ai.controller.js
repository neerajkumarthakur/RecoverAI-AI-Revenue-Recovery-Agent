"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosePaymentHandler = diagnosePaymentHandler;
const diagnosis_service_1 = require("../services/ai/diagnosis.service");
async function diagnosePaymentHandler(req, res) {
    try {
        const { paymentId } = req.body;
        if (!paymentId) {
            res.status(400).json({ error: 'paymentId is required' });
            return;
        }
        const merchantId = req.headers['x-merchant-id'] || '';
        const result = await (0, diagnosis_service_1.diagnosePayment)(paymentId, merchantId);
        res.json(result);
    }
    catch (error) {
        console.error('[AI Controller] Diagnosis error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        res.status(500).json({ error: message });
    }
}
//# sourceMappingURL=ai.controller.js.map