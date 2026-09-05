import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { razorpayWebhookHandler } from './controllers/webhook.controller';
import apiRouter from './routes/index';

dotenv.config({ path: '../../.env' });

const app = express();

// Webhook route - MUST be before express.json() so the raw Buffer is preserved
app.post(
  '/api/v1/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  razorpayWebhookHandler
);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (auth protected)
app.use('/api/v1', apiRouter);

export default app;
