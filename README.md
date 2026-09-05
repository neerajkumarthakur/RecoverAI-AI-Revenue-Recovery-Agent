# RecoverAI

> **AI Revenue Recovery Agent** — Razorpay AI Buildathon, Track 03

RecoverAI detects failed payments, uses **OpenAI GPT-4o-mini** to diagnose the root cause and score recoverability, runs the recommendation through a **deterministic policy engine**, and lets the merchant approve each recovery action with a single click. Every decision is recorded in an immutable audit trail. The final demo proves **measured money recovered across a seeded batch** with compliant escalation, stopping rules, and full transparency.

---

## Tech Stack

| Layer             | Technology                                             |
| ----------------- | ------------------------------------------------------ |
| **Frontend**      | React 18 + Vite + TypeScript + Tailwind CSS + Recharts |
| **Backend**       | Node.js + Express + TypeScript                         |
| **Database**      | PostgreSQL (Neon serverless) via Prisma ORM            |
| **AI**            | OpenAI GPT-4o-mini — structured JSON output            |
| **Payments**      | Razorpay Test Mode (Node SDK + Webhooks)               |
| **Monorepo**      | npm workspaces (`apps/*`, `packages/*`)                |
| **Deployment**    | Vercel (web) + Render/Railway (API) + Neon (DB)        |
| **Dev tunneling** | Cloudflare Tunnel (`cloudflared`)                      |

---

## Architecture

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

### Core Recovery Loop

```
payment.failed webhook / seeded data
        ↓
Create Recovery Case (OPEN)
        ↓
Feature extraction + deterministic score
        ↓
GPT-4o-mini diagnosis → recommended action + reason
        ↓
Policy engine gate (attempts, amount, confidence, window)
        ↓
Status → ACTION_PENDING  (merchant must click Approve)
        ↓
Execute action (Payment Link via Razorpay API)
        ↓
payment_link.paid webhook → RECOVERED
        ↓
Audit log + dashboard metrics update
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- A [Neon](https://neon.tech) PostgreSQL database (or any PostgreSQL instance)
- Razorpay Test Mode account
- OpenAI API key

### 1. Clone & Install

```bash
git clone https://github.com/your-org/recoverai.git
cd recoverai
npm install
```

### 2. Configure Environment

```bash
cp  .env
# Edit .env and fill in all required values (see table below)
```

### 3. Run Database Migrations

```bash
npm run db:migrate --workspace=packages/database
```

### 4. Seed the Database

```bash
npm run db:seed
```

This creates 1 demo merchant, 50 customers, and 1,000 payment records with a realistic distribution of failures, recovery cases, and audit logs. After seeding the dashboard shows live metrics.

### 5. Start Development Servers

```bash
npm run dev
```

- API → `http://localhost:3001`
- Web → `http://localhost:5173`
- Health check → `http://localhost:3001/health`

### 6. Log In

Open `http://localhost:5173/login` and enter the value of `DEMO_API_KEY` from your `.env` file.

---

## Environment Variables

All variables are required. Copy `.env.example` to `.env` and fill in each value.

| Variable                  | Description                                      | Example                                      |
| ------------------------- | ------------------------------------------------ | -------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL connection string (Neon or local)     | `postgresql://user:pass@host:5432/recoverai` |
| `RAZORPAY_KEY_ID`         | Razorpay Test Mode Key ID                        | `rzp_test_xxxxxxxxxx`                        |
| `RAZORPAY_KEY_SECRET`     | Razorpay Test Mode Key Secret                    | `xxxxxxxxxxxxxxxx`                           |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signing secret set in Razorpay dashboard | `xxxxxxxxxxxxxxxx`                           |
| `OPENAI_API_KEY`          | OpenAI API key                                   | `sk-xxxxxxxxxxxxxxxx`                        |
| `FRONTEND_URL`            | URL of the frontend (used for CORS)              | `http://localhost:5173`                      |
| `PORT`                    | Port the API listens on                          | `3001`                                       |
| `DEMO_API_KEY`            | Static Bearer token used by the frontend         | `recoverai`                                  |
| `NODE_ENV`                | Node environment                                 | `development`                                |

---

## Available Scripts

### Root (monorepo)

| Script                | Description                                        |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | Start API and web dev servers concurrently         |
| `npm run build`       | Production build for both API (tsc) and web (Vite) |
| `npm run db:migrate`  | Run Prisma migrations                              |
| `npm run db:generate` | Regenerate Prisma client after schema changes      |
| `npm run db:seed`     | Seed database with demo merchant + 1,000 payments  |

### apps/api

| Script          | Description                                 |
| --------------- | ------------------------------------------- |
| `npm run dev`   | Start API with ts-node-dev hot reload       |
| `npm run build` | Compile TypeScript to `dist/`               |
| `npm run start` | Start compiled server from `dist/server.js` |

### apps/web

| Script            | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start Vite dev server                |
| `npm run build`   | Production Vite build to `dist/`     |
| `npm run preview` | Preview the production build locally |

---

## Demo Walkthrough

**Step 1 — Login**
Open `http://localhost:5173/login`. Enter the `DEMO_API_KEY` value. You are redirected to the Dashboard.

**Step 2 — Dashboard**
The dashboard shows the seeded batch metrics: Revenue at Risk, Recovered Revenue, Recovery Rate, and Open Cases, plus a 30-day recovery trend chart and a failure category breakdown pie chart.

**Step 3 — Pick a Case**
Navigate to **Cases** (`/cases`). Filter by **Open** status. Click any case with a recoverability score ≥ 70 (shown in green).

**Step 4 — AI Analysis & Approve**
On the Case Detail page, click **Analyze**. The AI engine extracts features, scores the payment, and calls GPT-4o-mini for a structured diagnosis. The panel shows the failure category, confidence, recommended action, and the full "Why this action?" reasoning. Click **Approve** — a Payment Link is created in Razorpay Test Mode and the URL appears in a modal.

**Step 5 — Recovery Confirmed**
Open the Payment Link and complete the payment using Razorpay Test Mode card `4111 1111 1111 1111`. The `payment_link.paid` webhook fires, the case status moves to **RECOVERED**, and the dashboard revenue numbers update.

---

## API Documentation

See [`docs/api.md`](docs/api.md) for the full API reference. Summary:

| Method | Path                                  | Description                                    |
| ------ | ------------------------------------- | ---------------------------------------------- |
| `GET`  | `/health`                             | Health check — no auth required                |
| `GET`  | `/api/v1/dashboard/summary`           | Recovery summary metrics                       |
| `GET`  | `/api/v1/dashboard/recovery-trends`   | Daily recovery data (30 days)                  |
| `GET`  | `/api/v1/dashboard/failure-breakdown` | Cases by failure category                      |
| `GET`  | `/api/v1/recovery-cases`              | Paginated list with optional `status` filter   |
| `GET`  | `/api/v1/recovery-cases/:id`          | Full case detail with audit log                |
| `POST` | `/api/v1/recovery-cases/:id/analyze`  | Trigger AI diagnosis                           |
| `POST` | `/api/v1/recovery-cases/:id/approve`  | Approve recovery action (creates Payment Link) |
| `POST` | `/api/v1/recovery-cases/:id/reject`   | Reject case → ESCALATED                        |
| `GET`  | `/api/v1/payments`                    | List payments with optional `status` filter    |
| `GET`  | `/api/v1/payments/:id`                | Single payment detail                          |
| `POST` | `/api/v1/ai/diagnose-payment`         | Diagnose a payment by ID                       |
| `POST` | `/api/v1/webhooks/razorpay`           | Razorpay webhook receiver (no auth)            |

All `/api/v1/*` routes (except the webhook) require `Authorization: Bearer <DEMO_API_KEY>`.

---

## Webhook Testing with Cloudflared

To receive live Razorpay webhooks on your local machine:

```bash
# Install cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
cloudflared tunnel --url http://localhost:3001
```

Copy the generated `https://*.trycloudflare.com` URL. In the **Razorpay Dashboard → Settings → Webhooks**, add:

```
https://<your-tunnel>.trycloudflare.com/api/v1/webhooks/razorpay
```

Enable events: `payment.failed`, `payment.captured`, `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`.

Set the **webhook secret** to match `RAZORPAY_WEBHOOK_SECRET` in your `.env`.

---

## Project Structure

```
recoverai/
├── apps/
│   ├── api/                          # Express + TypeScript backend
│   │   ├── src/
│   │   │   ├── app.ts                # Express app (middleware, routes)
│   │   │   ├── server.ts             # HTTP server entry point
│   │   │   ├── controllers/          # Request handlers
│   │   │   │   ├── ai.controller.ts
│   │   │   │   ├── dashboard.controller.ts
│   │   │   │   ├── payments.controller.ts
│   │   │   │   ├── recovery.controller.ts
│   │   │   │   └── webhook.controller.ts
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts           # Bearer token auth
│   │   │   ├── routes/
│   │   │   │   └── index.ts          # Route registration
│   │   │   └── services/
│   │   │       ├── ai/               # Scoring, prompts, diagnosis
│   │   │       ├── razorpay/         # Client, payment links, webhooks
│   │   │       └── recovery/         # Policy engine, recovery service
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                          # React + Vite frontend
│       ├── src/
│       │   ├── components/           # UI components + layout
│       │   ├── pages/                # 7 pages
│       │   ├── router/               # React Router v6
│       │   ├── services/             # Axios API client
│       │   ├── types/                # Shared TypeScript types
│       │   └── utils/                # Format helpers
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   ├── database/                     # Prisma schema + client
│   │   ├── prisma/schema.prisma
│   │   └── src/client.ts
│   └── shared/                       # Shared enums + constants
│       └── src/
│           ├── types/index.ts
│           └── constants/index.ts
├── scripts/
│   ├── seed.ts                       # Create demo merchant + customers
│   ├── generate-demo-data.ts         # Generate 1,000 payments + cases
│   ├── calculate-metrics.ts          # Print batch recovery metrics
│   └── tsconfig.json
├── docs/
│   ├── architecture.md
│   ├── demo-script.md
│   └── api.md
├── .env.example
├── docker-compose.yml                # Optional local Postgres
├── package.json                      # Root workspaces config
└── README.md
```

---

## Key Design Decisions

| Decision            | Choice                         | Reason                                                 |
| ------------------- | ------------------------------ | ------------------------------------------------------ |
| AI controls money   | ❌ Never                       | LLM recommends; policy engine gates; merchant approves |
| Approval mode       | Always manual                  | Clearest human-in-the-loop demo for judges             |
| Score authority     | Deterministic scorer           | Reproducible metric — LLM cannot inflate the score     |
| Webhook body        | `express.raw()`                | Razorpay requires raw body for HMAC verification       |
| Event deduplication | `razorpayEventId` unique index | Razorpay can deliver the same event more than once     |
| Amount storage      | Paise (integer)                | Matches Razorpay's own representation                  |
| Auth                | Static demo API key            | No time wasted on OAuth; judges can test instantly     |

---

## Architecture & Security Notes

- The LLM **never executes** a financial action. GPT-4o-mini provides a recommendation; the policy engine decides if it is allowed; the merchant provides final approval.
- Webhook signature verification uses HMAC-SHA256 over the **raw request body** — `express.raw()` is applied only to the webhook route, before any JSON body-parser.
- `DEMO_API_KEY` is a static Bearer token — sufficient for a hackathon demo. Replace with proper JWT auth before any production use.
- All AI calls, policy decisions, and state transitions are recorded in the `AuditLog` table.
