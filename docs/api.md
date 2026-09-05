# RecoverAI — API Reference

**Base URL (dev):** `http://localhost:3001`
**Base URL (prod):** `https://your-api.onrender.com`

## Authentication

All `/api/v1/*` endpoints require a Bearer token:

```
Authorization: Bearer <DEMO_API_KEY>
```

The value of `DEMO_API_KEY` is set in your `.env` file. The login page stores it in `localStorage` and the Axios client injects it on every request.

The webhook endpoint (`POST /api/v1/webhooks/razorpay`) does **not** use Bearer auth — it is authenticated via Razorpay's HMAC-SHA256 signature header instead.

---

## Health Check

### `GET /health`

No authentication required.

**Response**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Dashboard

### `GET /api/v1/dashboard/summary`

Returns aggregate recovery metrics for the authenticated merchant.

**Response**
```json
{
  "data": {
    "revenueAtRisk": 48200000,
    "recoveredRevenue": 18360000,
    "recoveryRate": 0.401,
    "openCases": 40,
    "failedPayments": 200,
    "paymentLinksGenerated": 130,
    "successfulRecoveries": 80,
    "escalatedCases": 29
  }
}
```

> All amount fields are in **paise**. Divide by 100 for rupee display.

---

### `GET /api/v1/dashboard/recovery-trends`

Returns daily recovery data for the last 30 days. Used for the line chart.

**Response**
```json
{
  "data": [
    { "date": "2024-01-01", "attempted": 3, "recovered": 1 },
    { "date": "2024-01-02", "attempted": 5, "recovered": 3 },
    ...
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `date` | `string` | ISO date `YYYY-MM-DD` |
| `attempted` | `number` | Number of recovery actions attempted that day |
| `recovered` | `number` | Amount recovered (paise) |

---

### `GET /api/v1/dashboard/failure-breakdown`

Returns count of recovery cases grouped by failure category. Used for the pie chart.

**Response**
```json
{
  "data": [
    { "category": "INSUFFICIENT_FUNDS", "count": 72 },
    { "category": "CARD_DECLINED", "count": 45 },
    { "category": "NETWORK_ERROR", "count": 38 },
    { "category": "BANK_ERROR", "count": 25 },
    { "category": "UPI_FAILURE", "count": 12 },
    { "category": "FRAUD_BLOCK", "count": 8 }
  ]
}
```

---

## Recovery Cases

### `GET /api/v1/recovery-cases`

Returns a paginated list of recovery cases.

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `status` | `string` | Filter by status. Accepts comma-separated values: `OPEN,ACTION_PENDING,ACTIONED,RECOVERED,ESCALATED,EXPIRED,ANALYZING` |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 20, max: 100) |

**Example**
```
GET /api/v1/recovery-cases?status=OPEN,ACTION_PENDING&page=1&limit=20
```

**Response**
```json
{
  "data": [
    {
      "id": "clxxxxxx",
      "status": "ACTION_PENDING",
      "amountAtRisk": 250000,
      "recoverabilityScore": 78,
      "failureCategory": "INSUFFICIENT_FUNDS",
      "aiConfidence": 0.82,
      "attemptCount": 0,
      "deadline": "2024-01-18T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "customer": {
        "id": "clxxxxxx",
        "name": "Priya Sharma",
        "email": "priya@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 87,
    "totalPages": 5
  }
}
```

---

### `GET /api/v1/recovery-cases/:id`

Returns full detail for a single recovery case including payment, customer history, AI diagnosis, actions, and audit log.

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | Recovery case UUID |

**Response**
```json
{
  "data": {
    "id": "clxxxxxx",
    "status": "ACTION_PENDING",
    "amountAtRisk": 250000,
    "recoverabilityScore": 78,
    "failureCategory": "INSUFFICIENT_FUNDS",
    "aiReason": "High-value customer with strong payment history. Insufficient funds failure is transient — high probability of successful retry within 24 hours.",
    "aiConfidence": 0.82,
    "aiRecommendedAction": "PAYMENT_LINK",
    "aiEvidence": [
      "Customer has 8 successful payments in last 90 days",
      "Transaction amount is within normal range for this customer",
      "INSUFFICIENT_FUNDS failures recover at 68% with payment links"
    ],
    "attemptCount": 0,
    "deadline": "2024-01-18T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "payment": {
      "id": "clxxxxxx",
      "razorpayPaymentId": "pay_xxxxxxxxxx",
      "amount": 250000,
      "currency": "INR",
      "status": "failed",
      "errorCode": "BAD_REQUEST_ERROR",
      "failureReason": "Your payment failed due to insufficient funds.",
      "method": "card",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "customer": {
      "id": "clxxxxxx",
      "name": "Priya Sharma",
      "email": "priya@example.com",
      "phone": "+919876543210",
      "recentPayments": [
        { "id": "clxxxxxx", "amount": 199900, "status": "captured", "createdAt": "2024-01-10T..." },
        { "id": "clxxxxxx", "amount": 250000, "status": "failed", "createdAt": "2024-01-15T..." }
      ]
    },
    "actions": [
      {
        "id": "clxxxxxx",
        "actionType": "PAYMENT_LINK",
        "status": "EXECUTED",
        "executedBy": "MERCHANT",
        "reason": "Approved by merchant",
        "createdAt": "2024-01-15T10:35:00.000Z"
      }
    ],
    "paymentLinks": [
      {
        "id": "clxxxxxx",
        "razorpayPaymentLinkId": "plink_xxxxxxxxxx",
        "shortUrl": "https://rzp.io/l/xxxxxxxx",
        "amount": 250000,
        "status": "created",
        "expiresAt": "2024-01-18T10:30:00.000Z"
      }
    ],
    "auditLog": [
      {
        "id": "clxxxxxx",
        "actorType": "SYSTEM",
        "action": "CASE_CREATED",
        "details": { "source": "webhook", "eventId": "evt_xxxxxxxxxx" },
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "clxxxxxx",
        "actorType": "AI",
        "action": "DIAGNOSIS_COMPLETED",
        "details": { "score": 78, "confidence": 0.82, "recommendedAction": "PAYMENT_LINK" },
        "createdAt": "2024-01-15T10:32:00.000Z"
      }
    ]
  }
}
```

---

### `POST /api/v1/recovery-cases/:id/analyze`

Triggers the AI diagnosis pipeline for a case. The case must be in `OPEN` status.

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | Recovery case UUID |

**Request body** — none

**Response** — the updated case object (same shape as `GET /recovery-cases/:id`)

```json
{
  "data": {
    "id": "clxxxxxx",
    "status": "ACTION_PENDING",
    "recoverabilityScore": 78,
    "failureCategory": "INSUFFICIENT_FUNDS",
    "aiConfidence": 0.82,
    "aiRecommendedAction": "PAYMENT_LINK",
    "aiReason": "...",
    "aiEvidence": ["..."],
    ...
  }
}
```

**Error responses**

| Status | Description |
|---|---|
| `400` | Case is not in OPEN status |
| `404` | Case not found |
| `500` | OpenAI API error |

---

### `POST /api/v1/recovery-cases/:id/approve`

Approves the AI-recommended action. Runs the policy engine gate; if approved, creates a Razorpay Payment Link.

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | Recovery case UUID |

**Request body** — none

**Response (success)**
```json
{
  "data": {
    "case": {
      "id": "clxxxxxx",
      "status": "ACTIONED",
      ...
    },
    "paymentLink": {
      "id": "clxxxxxx",
      "razorpayPaymentLinkId": "plink_xxxxxxxxxx",
      "shortUrl": "https://rzp.io/l/xxxxxxxx",
      "amount": 250000,
      "expiresAt": "2024-01-18T10:30:00.000Z"
    }
  }
}
```

**Error responses**

| Status | Description |
|---|---|
| `404` | Case not found |
| `422` | Policy engine blocked the action — response body includes `blockedReason` |
| `500` | Razorpay API error |

**Policy-blocked response (422)**
```json
{
  "error": "Action blocked by policy engine",
  "blockedReason": "Maximum attempt count (3) exceeded for this case"
}
```

---

### `POST /api/v1/recovery-cases/:id/reject`

Rejects the case, transitioning it to `ESCALATED` status.

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | Recovery case UUID |

**Request body**
```json
{
  "reason": "Customer already contacted — handling manually"
}
```

| Field | Required | Description |
|---|---|---|
| `reason` | No | Free-text rejection reason stored in the audit log |

**Response** — the updated case object with `status: "ESCALATED"`

---

## Payments

### `GET /api/v1/payments`

Returns a list of payments.

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `status` | `string` | Filter by Razorpay status: `captured`, `failed`, `refunded` |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 20) |

**Response**
```json
{
  "data": [
    {
      "id": "clxxxxxx",
      "razorpayPaymentId": "pay_xxxxxxxxxx",
      "amount": 250000,
      "currency": "INR",
      "status": "failed",
      "method": "card",
      "errorCode": "BAD_REQUEST_ERROR",
      "failureReason": "Your payment failed due to insufficient funds.",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "customer": {
        "name": "Priya Sharma",
        "email": "priya@example.com"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 200, "totalPages": 10 }
}
```

---

### `GET /api/v1/payments/:id`

Returns a single payment with its associated recovery case (if any).

**Response**
```json
{
  "data": {
    "id": "clxxxxxx",
    "razorpayPaymentId": "pay_xxxxxxxxxx",
    "amount": 250000,
    "currency": "INR",
    "status": "failed",
    "method": "card",
    "errorCode": "BAD_REQUEST_ERROR",
    "failureReason": "Your payment failed due to insufficient funds.",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "order": { "id": "clxxxxxx", "amount": 250000 },
    "customer": { "id": "clxxxxxx", "name": "Priya Sharma", "email": "priya@example.com" },
    "recoveryCase": {
      "id": "clxxxxxx",
      "status": "RECOVERED",
      "recoverabilityScore": 78
    }
  }
}
```

---

## AI

### `POST /api/v1/ai/diagnose-payment`

Diagnoses a payment directly by Razorpay payment ID (alternative to the case-based flow).

**Request body**
```json
{
  "paymentId": "pay_xxxxxxxxxx"
}
```

| Field | Required | Description |
|---|---|---|
| `paymentId` | Yes | Razorpay payment ID |

**Response**
```json
{
  "data": {
    "paymentId": "pay_xxxxxxxxxx",
    "failureCategory": "INSUFFICIENT_FUNDS",
    "recoverabilityScore": 78,
    "confidence": 0.82,
    "recommendedAction": "PAYMENT_LINK",
    "reason": "High-value customer with strong history. Transient failure. High recovery probability.",
    "riskLevel": "LOW",
    "evidence": [
      "8 successful payments in last 90 days",
      "Amount within normal range"
    ],
    "stoppingRules": "Maximum 3 recovery attempts. Stop if payment link expires without payment."
  }
}
```

---

## Webhooks

### `POST /api/v1/webhooks/razorpay`

Receives Razorpay webhook events. **No Bearer auth** — authenticated via HMAC-SHA256 signature.

**Headers required by Razorpay**

| Header | Description |
|---|---|
| `x-razorpay-signature` | HMAC-SHA256 of raw request body with `RAZORPAY_WEBHOOK_SECRET` |
| `x-razorpay-event-id` | Unique event ID used for deduplication |

**Supported event types**

| Event | Effect |
|---|---|
| `payment.failed` | Creates a `RecoveryCase` with `status: OPEN` |
| `payment.captured` | Updates payment status; marks linked recovery case as `RECOVERED` if present |
| `payment_link.paid` | Marks recovery case as `RECOVERED`; updates recovered revenue |
| `payment_link.expired` | Marks recovery case as `EXPIRED` |
| `payment_link.cancelled` | Marks recovery case as `EXPIRED` |

**Response**

Always returns `200 OK` after successful signature verification, regardless of processing outcome. This prevents Razorpay retry storms.

Returns `400 Bad Request` only if the signature is invalid.

---

## Error Response Format

All error responses use a consistent shape:

```json
{
  "error": "Human-readable error message",
  "details": "Optional additional context"
}
```

| HTTP Status | Meaning |
|---|---|
| `400` | Bad request — invalid input or invalid webhook signature |
| `401` | Missing or invalid Authorization header |
| `404` | Resource not found |
| `422` | Unprocessable — policy engine blocked the action |
| `500` | Internal server error |

---

## Amount Encoding

All monetary values in the API are in **paise** (smallest Indian currency unit):

- `₹1 = 100 paise`
- `₹2,500 = 250000 paise`

Frontend display: divide by 100 and format with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
