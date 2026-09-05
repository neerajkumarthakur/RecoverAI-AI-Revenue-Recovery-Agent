"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const recovery_controller_1 = require("../controllers/recovery.controller");
const payments_controller_1 = require("../controllers/payments.controller");
const ai_controller_1 = require("../controllers/ai.controller");
const router = (0, express_1.Router)();
// Apply auth to all routes below
router.use(auth_1.authMiddleware);
// Dashboard
router.get('/dashboard/summary', dashboard_controller_1.summaryHandler);
router.get('/dashboard/recovery-trends', dashboard_controller_1.trendsHandler);
router.get('/dashboard/failure-breakdown', dashboard_controller_1.breakdownHandler);
// Recovery cases
router.get('/recovery-cases', recovery_controller_1.listCasesHandler);
router.get('/recovery-cases/:id', recovery_controller_1.getCaseHandler);
router.post('/recovery-cases/:id/analyze', recovery_controller_1.analyzeCaseHandler);
router.post('/recovery-cases/:id/approve', recovery_controller_1.approveCaseHandler);
router.post('/recovery-cases/:id/reject', recovery_controller_1.rejectCaseHandler);
// Payments
router.get('/payments', payments_controller_1.listPaymentsHandler);
router.get('/payments/:id', payments_controller_1.getPaymentHandler);
// AI
router.post('/ai/diagnose-payment', ai_controller_1.diagnosePaymentHandler);
exports.default = router;
//# sourceMappingURL=index.js.map