# RecoverAI — Architecture

## System Overview

RecoverAI is a monorepo containing three layers:

1. **`apps/web`** — A React + Vite single-page app that gives the merchant a dashboard to see failed payments, review AI-generated recovery recommendations, and approve or reject each action.
2. **`apps/api`** — An Express + TypeScript REST API that orchestrates AI diagnosis, communicates with Razorpay and OpenAI, manages the recovery lifecycle state machine, and receives Razorpay webhooks.
3. **`packages/database`** — Prisma ORM schema + generated client, shared by the API. The PostgreSQL database is hosted on Neon (serverless).

A fourth shared package, **`packages/shared`**, exports TypeScript enums and policy constants used by both the API and (via type imports) the web app.

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web  (React + Vite + Tailwind)   → Vercel             │
│  7 pages: Login / Dashboard / Cases / CaseDetail /          │
│           AIActivity / Analytics / Settings                  │
└────────────────────────┬────────────────────────────────────┘
                         │  REST  (Axios + Bearer token)
┌────────────────────────▼────────────────────────────────────┐
│  apps/api  (Node + Express + TypeScript)   → Render         │
│                                                             │
│  Routes: /dashboard  /recovery-cases  /payments             │
│          /ai  /webhooks/razorpay                            │
│                                                             │
│  Services:                                                  │
│   ai/scoring.service      ai/diagnosis.service              │
│   ai/prompts              recovery/policy.service           │
│   recovery/recovery.service  recovery/action.service        │
│   razorpay/client         razorpay/paymentLinks             │
│   razorpay/webhooks       razorpay/payments                 │
└──────────┬─────────────────┬──────────────────┬────────────┘
           │                 │                  │
    ┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
    │  Neon       │  │  OpenAI      │  │  Razorpay    │
    │  PostgreSQL │  │  GPT-4o-mini │  │  Test Mode   │
    │  (Prisma)   │  │              │  │  + Webhooks  │
    └─────────────┘  └──────────────┘  └──────────────┘
```

---

## Component Responsibilities

### apps/api

| Module | Responsibility |
|---|---|
| `src/app.ts` | Express app setup: raw-body webhook route, CORS, JSON middleware, route mounting |
| `src/server.ts` | HTTP server entry point (`app.listen`) |
| `src/middleware/auth.ts` | Validates `Authorization: Bearer <DEMO_API_KEY>` on all `/api/v1/*` routes |
| `src/controllers/dashboard.controller.ts` | Aggregates summary metrics, trend data, and failure breakdown from the database |
| `src/controllers/recovery.controller.ts` | CRUD + lifecycle transitions for recovery cases (list, detail, analyze, approve, reject) |
| `src/controllers/payments.controller.ts` | Read-only payment listing and detail |
| `src/controllers/ai.controller.ts` | Thin controller wrapping the AI diagnosis service |
| `src/controllers/webhook.controller.ts` | Razorpay webhook receiver — verifies signature, deduplicates, dispatches to recovery service |
| `src/services/ai/scoring.service.ts` | Deterministic recoverability scorer (weighted feature formula, 0–100) |
| `src/services/ai/prompts.ts` | System prompt and user message builder for GPT-4o-mini |
| `src/services/ai/diagnosis.service.ts` | Orchestrates scoring → GPT call → structured output parse → DB update |
| `src/services/recovery/policy.service.ts` | Gate check: `canExecuteAction()` enforces attempt limits, amount caps, confidence threshold, deadline |
| `src/services/recovery/recovery.service.ts` | Webhook event handlers: `handlePaymentFailed`, `handlePaymentCaptured`, `handlePaymentLinkPaid`, etc. |
| `src/services/razorpay/client.ts` | Razorpay SDK singleton |
| `src/services/razorpay/paymentLinks.ts` | `createPaymentLink()` wrapper |
| `src/services/razorpay/payments.ts` | `fetchPayment()` wrapper |
| `src/services/razorpay/webhooks.ts` | `verifyWebhookSignature()` HMAC verification |

### apps/web

| Page | Description |
|---|---|
| `Login` | Stores the demo API key in `localStorage`; redirects to `/dashboard` |
| `Dashboard` | 4 summary cards + recovery trend line chart + failure category pie chart |
| `Cases` | Filterable, paginated table of recovery cases |
| `CaseDetail` | Full AI diagnosis panel, "Why this action?" reasoning, Approve / Reject flow |
| `AIActivity` | Polling timeline of recent AI events |
| `Analytics` | Batch performance metrics + bar charts by action type and failure category |
| `Settings` | Read-only display of current policy configuration |

### packages/database

Prisma schema defining 9 models. Exports a singleton `PrismaClient` consumed by the API.

### packages/shared

TypeScript enums (`RecoveryCaseStatus`, `ActionType`, `ActionStatus`, `ActorType`, `FailureCategory`) and policy constants (default max attempts, max auto-recovery amount, window hours, min confidence).

---

## Core Recovery Loop Flow

```
1. Payment fails on Razorpay
        │
        ▼
2. POST /api/v1/webhooks/razorpay  (event: payment.failed)
   • Signature verified (HMAC-SHA256 over raw body)
   • Event deduplicated by razorpayEventId
   • RecoveryCase created with status = OPEN
   • AuditLog entry written
        │
        ▼
3. Merchant opens Cases page → clicks Analyze
   POST /api/v1/recovery-cases/:id/analyze
        │
        ▼
4. AI Diagnosis Engine
   a. Fetch payment + customer history from DB
   b. Deterministic scoring (5-factor weighted formula)
   c. GPT-4o-mini call with structured JSON response_format
   d. Parse: failureCategory, recoverabilityScore, confidence,
            recommendedAction, reason, riskLevel, evidence
   e. Update RecoveryCase (status → ACTION_PENDING)
   f. Write AuditLog (actorType: AI)
        │
        ▼
5. Policy Engine checks
   • attemptCount < maxAttempts (default 3)
   • amountAtRisk ≤ maxAutoRecoveryAmount
   • aiConfidence ≥ minConfidence (default 0.65)
   • case not past deadline (createdAt + 72 h)
   → allowed: true  → show Approve button (green)
   → allowed: false → show Reject with reason
        │
        ▼ (merchant clicks Approve)
6. POST /api/v1/recovery-cases/:id/approve
   • createPaymentLink() via Razorpay API
   • PaymentLink row inserted
   • RecoveryAction row inserted (status: EXECUTED)
   • RecoveryCase status → ACTIONED
   • AuditLog entry (actorType: MERCHANT)
   • Response includes short_url → shown in modal
        │
        ▼ (customer pays)
7. POST /api/v1/webhooks/razorpay  (event: payment_link.paid)
   • RecoveryCase status → RECOVERED
   • recoveredRevenue updated
   • AuditLog entry
   • Dashboard metrics refresh on next poll
```

---

## AI Architecture

The AI engine is a **three-layer pipeline** that keeps the LLM in a reasoning role while a deterministic scorer is authoritative for the final numeric score.

### Layer 1 — Feature Extraction

Pulled directly from the database before any AI call:

- **Customer history** — total payments, success rate, average amount, days since first transaction
- **Transaction normality** — whether the amount is within ±2 standard deviations of the customer's median
- **Failure type** — error code classification (BAD_REQUEST, GATEWAY, SERVER, etc.)
- **Payment method** — card / UPI / netbanking / wallet (affects recoverability)
- **Historical recovery** — whether past failed payments from this customer were eventually recovered

### Layer 2 — Deterministic Scoring (`scoring.service.ts`)

```
recoverabilityScore =
    customer_history_score × 0.30
  + transaction_normality_score × 0.20
  + failure_type_score × 0.25
  + payment_method_score × 0.10
  + historical_recovery_score × 0.15
```

Result is an integer 0–100. This score is **authoritative** — it cannot be overridden by the LLM.

### Layer 3 — LLM Reasoning (`diagnosis.service.ts`)

GPT-4o-mini is called with:

- **System prompt** — defines the RecoverAI decision engine role, output schema, and evidence requirements
- **User message** — serialized feature bundle (scores, history, failure details)
- **`response_format: { type: "json_object" }`** — enforces structured output

Expected output schema:

```json
{
  "failureCategory": "INSUFFICIENT_FUNDS | CARD_DECLINED | NETWORK_ERROR | BANK_ERROR | UPI_FAILURE | FRAUD_BLOCK | EXPIRED_CARD | OTHER",
  "recoverabilityScore": 0,
  "confidence": 0.0,
  "recommendedAction": "NO_ACTION | PAYMENT_LINK | RETRY | ESCALATE",
  "reason": "Human-readable explanation",
  "riskLevel": "LOW | MEDIUM | HIGH",
  "evidence": ["bullet 1", "bullet 2"],
  "stoppingRules": "Why this should not be retried indefinitely"
}
```

The deterministic score from Layer 2 replaces `recoverabilityScore` in the final result.

---

## Policy Engine Design

`policy.service.ts` implements a `canExecuteAction()` gate that runs before any financial action:

| Check | Default | Fail behaviour |
|---|---|---|
| `attemptCount < maxAttempts` | max 3 attempts | Block — return 422 with reason |
| `amountAtRisk ≤ maxAmount` | ₹50,000 (5,000,000 paise) | Block — escalate to human |
| `aiConfidence ≥ minConfidence` | 0.65 | Block — insufficient signal |
| `now < deadline` | `createdAt + 72 h` | Block — recovery window expired |

The policy engine result — not the LLM recommendation alone — determines what action the merchant sees in the UI. If `allowed: false`, the Approve button is replaced with a reason-labelled escalation notice.

---

## Database Schema Overview

Nine Prisma models:

| Model | Key fields |
|---|---|
| `Merchant` | `id`, `email`, `name`, `apiKey`, `policyConfig` (JSON) |
| `Customer` | `id`, `merchantId`, `email`, `phone`, `name` |
| `Order` | `id`, `merchantId`, `customerId`, `amount`, `currency` |
| `Payment` | `id`, `orderId`, `razorpayPaymentId` (unique), `amount`, `status`, `errorCode`, `failureReason` |
| `RecoveryCase` | `id`, `paymentId`, `merchantId`, `status`, `recoverabilityScore`, `failureCategory`, `aiReason`, `aiConfidence`, `amountAtRisk`, `deadline`, `attemptCount` |
| `RecoveryAction` | `id`, `caseId`, `actionType`, `status`, `executedBy`, `reason` |
| `PaymentLink` | `id`, `caseId`, `razorpayPaymentLinkId` (unique), `shortUrl`, `amount`, `expiresAt`, `status` |
| `WebhookEvent` | `id`, `razorpayEventId` (unique), `eventType`, `payload` (JSON), `processed` |
| `AuditLog` | `id`, `caseId`, `actorType`, `action`, `details` (JSON), `createdAt` |

**Amounts are stored in paise** (integer) to match Razorpay's representation. All frontend display divides by 100 and formats as `₹X,XXX`.

`RecoveryCase.deadline` is computed on insert as `createdAt + 72 hours` — it is a stored column, not a view or computed property.

---

## Webhook Flow

```
Razorpay → POST /api/v1/webhooks/razorpay
                │
                ▼
        express.raw() captures Buffer
                │
                ▼
        verifyWebhookSignature(rawBody, x-razorpay-signature, WEBHOOK_SECRET)
        → 400 if invalid
                │
                ▼
        Lookup WebhookEvent by razorpayEventId
        → 200 (no-op) if already processed  ← deduplication
                │
                ▼
        Insert WebhookEvent (processed: false)
                │
                ▼
        Dispatch by event.event:
          payment.failed          → handlePaymentFailed()
          payment.captured        → handlePaymentCaptured()
          payment_link.paid       → handlePaymentLinkPaid()
          payment_link.expired    → handlePaymentLinkExpired()
          payment_link.cancelled  → handlePaymentLinkCancelled()
                │
                ▼
        Mark WebhookEvent processed: true
        Return 200  (always, unless signature invalid)
```

Non-200 responses cause Razorpay to retry delivery. The handler always returns 200 after the signature check to prevent retry storms even if the DB write fails.

---

## Security Considerations

### Authentication

The API uses a static `DEMO_API_KEY` Bearer token. This is intentional for a hackathon context — judges can authenticate without creating an account. **Do not use static API keys in production.** Replace with short-lived JWTs before any real deployment.

### Webhook Signature Verification

Every webhook is verified with `Razorpay.validateWebhookSignature(rawBody, signature, secret)` before any processing. The raw body (not the parsed JSON object) is required for correct HMAC computation. `express.raw()` is applied to the webhook route **before** `express.json()` is mounted on the app.

### No Secrets in the Frontend

The frontend stores only the demo API key (entered by the user at login). No Razorpay keys or OpenAI keys are exposed to the browser. All external API calls are made server-side.

### LLM Cannot Execute Actions

GPT-4o-mini output is advisory only. The policy engine must approve the action, and then the merchant must click Approve. There is no code path where an LLM output directly triggers a Razorpay API call.

### Immutable Audit Trail

Every state transition (created by AI, approved by merchant, or triggered by webhook) writes a row to `AuditLog` with `actorType` (`AI`, `MERCHANT`, or `SYSTEM`) and a JSON details payload. Rows are never updated or deleted.
