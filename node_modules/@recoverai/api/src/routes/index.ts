import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { summaryHandler, trendsHandler, breakdownHandler } from '../controllers/dashboard.controller';
import {
  listCasesHandler,
  getCaseHandler,
  analyzeCaseHandler,
  approveCaseHandler,
  rejectCaseHandler,
} from '../controllers/recovery.controller';
import { listPaymentsHandler, getPaymentHandler } from '../controllers/payments.controller';
import { diagnosePaymentHandler } from '../controllers/ai.controller';

const router = Router();

// Apply auth to all routes below
router.use(authMiddleware);

// Dashboard
router.get('/dashboard/summary', summaryHandler);
router.get('/dashboard/recovery-trends', trendsHandler);
router.get('/dashboard/failure-breakdown', breakdownHandler);

// Recovery cases
router.get('/recovery-cases', listCasesHandler);
router.get('/recovery-cases/:id', getCaseHandler);
router.post('/recovery-cases/:id/analyze', analyzeCaseHandler);
router.post('/recovery-cases/:id/approve', approveCaseHandler);
router.post('/recovery-cases/:id/reject', rejectCaseHandler);

// Payments
router.get('/payments', listPaymentsHandler);
router.get('/payments/:id', getPaymentHandler);

// AI
router.post('/ai/diagnose-payment', diagnosePaymentHandler);

export default router;
