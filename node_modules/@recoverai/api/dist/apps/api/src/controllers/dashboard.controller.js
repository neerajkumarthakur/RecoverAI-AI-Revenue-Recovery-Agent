"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.summaryHandler = summaryHandler;
exports.trendsHandler = trendsHandler;
exports.breakdownHandler = breakdownHandler;
const database_1 = __importDefault(require("@recoverai/database"));
async function summaryHandler(_req, res) {
    try {
        const activeStatuses = ['OPEN', 'ANALYZING', 'ACTION_PENDING', 'ACTIONED', 'ESCALATED'];
        const [revenueAtRiskAgg, recoveredRevenueAgg, openCases, failedPayments, paymentLinksGenerated, successfulRecoveries, escalatedCases, analyzingCases, actionPendingCases, actionedCases,] = await Promise.all([
            database_1.default.recoveryCase.aggregate({
                _sum: { amountAtRisk: true },
                where: { status: { in: activeStatuses } },
            }),
            database_1.default.recoveryCase.aggregate({
                _sum: { amountAtRisk: true },
                where: { status: 'RECOVERED' },
            }),
            database_1.default.recoveryCase.count({ where: { status: 'OPEN' } }),
            database_1.default.payment.count({ where: { status: 'failed' } }),
            database_1.default.paymentLink.count(),
            database_1.default.recoveryCase.count({ where: { status: 'RECOVERED' } }),
            database_1.default.recoveryCase.count({ where: { status: 'ESCALATED' } }),
            database_1.default.recoveryCase.count({ where: { status: 'ANALYZING' } }),
            database_1.default.recoveryCase.count({ where: { status: 'ACTION_PENDING' } }),
            database_1.default.recoveryCase.count({ where: { status: 'ACTIONED' } }),
        ]);
        const revenueAtRisk = revenueAtRiskAgg._sum.amountAtRisk ?? 0;
        const recoveredRevenue = recoveredRevenueAgg._sum.amountAtRisk ?? 0;
        const total = revenueAtRisk + recoveredRevenue;
        const recoveryRate = total > 0 ? Math.round((recoveredRevenue / total) * 10000) / 100 : 0;
        return res.json({
            revenueAtRisk,
            recoveredRevenue,
            recoveryRate,
            openCases,
            failedPayments,
            paymentLinksGenerated,
            successfulRecoveries,
            escalatedCases,
            analyzingCases,
            actionPendingCases,
            actionedCases,
        });
    }
    catch (error) {
        console.error('Error in summaryHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
async function trendsHandler(_req, res) {
    try {
        const since = new Date();
        since.setDate(since.getDate() - 29);
        since.setHours(0, 0, 0, 0);
        const cases = await database_1.default.recoveryCase.findMany({
            where: {
                status: 'RECOVERED',
                recoveredAt: { gte: since },
            },
            select: { recoveredAt: true, amountAtRisk: true },
        });
        // Build a map of date string -> total amount
        const map = new Map();
        for (const c of cases) {
            if (!c.recoveredAt)
                continue;
            const key = c.recoveredAt.toISOString().slice(0, 10);
            map.set(key, (map.get(key) ?? 0) + c.amountAtRisk);
        }
        // Fill all 30 days (oldest first)
        const result = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            result.push({ date: key, amount: map.get(key) ?? 0 });
        }
        return res.json(result);
    }
    catch (error) {
        console.error('Error in trendsHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
async function breakdownHandler(_req, res) {
    try {
        const groups = await database_1.default.recoveryCase.groupBy({
            by: ['failureCategory'],
            _count: { id: true },
            where: { failureCategory: { not: null } },
        });
        const result = groups.map((g) => ({
            category: g.failureCategory,
            count: g._count.id,
        }));
        return res.json(result);
    }
    catch (error) {
        console.error('Error in breakdownHandler:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
//# sourceMappingURL=dashboard.controller.js.map