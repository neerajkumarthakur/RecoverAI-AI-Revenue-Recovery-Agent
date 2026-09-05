"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPaymentsHandler = listPaymentsHandler;
exports.getPaymentHandler = getPaymentHandler;
const database_1 = __importDefault(require("@recoverai/database"));
async function listPaymentsHandler(req, res) {
    try {
        const { status, page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;
        const statusFilter = status ? { status: status } : undefined;
        const [payments, total] = await Promise.all([
            database_1.default.payment.findMany({
                where: statusFilter,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { name: true, email: true } },
                },
            }),
            database_1.default.payment.count({ where: statusFilter }),
        ]);
        return res.json({
            payments,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Error in listPaymentsHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
async function getPaymentHandler(req, res) {
    try {
        const { id } = req.params;
        const payment = await database_1.default.payment.findUnique({
            where: { id },
            include: {
                customer: true,
                recoveryCase: true,
            },
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        return res.json(payment);
    }
    catch (error) {
        console.error('Error in getPaymentHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
//# sourceMappingURL=payments.controller.js.map