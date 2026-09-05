"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const webhook_controller_1 = require("./controllers/webhook.controller");
const index_1 = __importDefault(require("./routes/index"));
dotenv_1.default.config({ path: '../../.env' });
const app = (0, express_1.default)();
// Webhook route - MUST be before express.json() so the raw Buffer is preserved
app.post('/api/v1/webhooks/razorpay', express_1.default.raw({ type: 'application/json' }), webhook_controller_1.razorpayWebhookHandler);
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API routes (auth protected)
app.use('/api/v1', index_1.default);
exports.default = app;
//# sourceMappingURL=app.js.map