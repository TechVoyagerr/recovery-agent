# Astra phase 1 — backend and agent core

Completed 2026-09-05, Asia/Kolkata. Workspace: `/Users/macbook/Documents/VSC/Razorpay`.

## What was built

- Next.js 15.5.25 App Router backend with all 12 requested route handlers and browser-safe shared types.
- Prisma 6.19.3 / SQLite schema for all six requested models plus MessageEvent, LlmCache, WebhookReceipt and SimulationRun. SQLite data is in `prisma/dev.db` and excluded from git.
- Eleven-reason classifier with exact Razorpay reasons plus description, source, step and method fallbacks.
- Deterministic strategies with Indian salary-window scheduling, personalised English/Hinglish, opt-out and cancellation suppression, a 3% minimum expected probability, reminder caps, reason-specific explanations, and Bayesian channel ranking.
- Durable planning, due-message dispatch, Razorpay Payment Links, ConsoleNotifier and MessageEvent persistence. Real credentials are used for actual webhook transactions; demos always force mock links.
- Optional OpenRouter copy/reasoning polish: 300-token cap, 10-second timeout, no retries, failure cooldown, in-memory and SQLite template caches. No LLM calls in bulk simulations. Verification deliberately used `AGENT_LLM=off`; no credits consumed.
- Signed webhook ingestion and deduplication, terminal-state protection, late-payment learning correction, amount matching, all six requested event types.
- Seeded instant/live outcome simulations, persisted progress, SSE event streaming, stats and learning insights.
- `npm run worker` polls the HTTP agent endpoint every five seconds, preserving single-process mutation serialization.
- README with architecture Mermaid, commands, environment variables, API contract, model decisions and operating limits.

## File map

| Files | Purpose |
| --- | --- |
| `prisma/schema.prisma` | Persistence model and indexes |
| `src/lib/types.ts`, `src/lib/format.ts` | Frontend wire contract and INR formatting |
| `src/lib/db.ts` | Shared Prisma client |
| `src/lib/agent/classifier.ts` | Gateway failure diagnosis |
| `src/lib/agent/rules.ts` | Primary decision engine and priors |
| `src/lib/agent/llm.ts` | Optional cached OpenRouter polish |
| `src/lib/agent/service.ts` | Plan, dispatch, settle, learn and process pending |
| `src/lib/payments.ts` | Razorpay/mock links and pluggable notifier |
| `src/lib/simulator.ts`, `src/lib/seed.ts` | Deterministic demo and customer seed |
| `src/lib/webhooks.ts` | Signature validation, correlation and settlement |
| `src/lib/queries.ts`, `src/lib/http.ts` | Aggregation, validation errors and production mutation guard |
| `src/app/api/**/route.ts` | All requested HTTP and SSE endpoints |
| `scripts/seed.ts`, `scripts/simulate.ts`, `scripts/worker.ts` | CLI entrypoints |
| `src/lib/agent/rules.test.ts` | 41 Vitest tests for classifier and rules |
| `.env.example`, `.gitignore`, `README.md` | Setup, secret exclusions and documentation |

## Exact commands and validation

Scaffold attempt (failed because the root folder contains uppercase letters):

```bash
npx create-next-app@latest . --ts --tailwind --app --eslint --src-dir --import-alias '@/*' --use-npm --yes
npx create-next-app@latest /tmp/razorpay-recovery-scaffold --ts --tailwind --app --eslint --src-dir --import-alias '@/*' --use-npm --yes
```

Only generated app/config/dependency files were copied into the root. `.env.local` was never read, printed, moved, overwritten or committed. `design/` was untouched, and the only orchestration write is this report. The generated Next 16 installation was pinned to the mandated Next 15. npm's newest Vitest had a Node type peer conflict, so Vitest 3 and Node 22 types were selected. Copied executable symlinks were repaired with `npm rebuild`.

```bash
npm install next@15 eslint-config-next@15 @prisma/client@6 razorpay openai zod dotenv
npm install -D prisma@6 tsx vitest@3 @types/node@22
npm rebuild
npm pkg set 'overrides.postcss=^8.5.23' 'overrides.deepmerge-ts=^8.0.0'
npm install
DATABASE_URL=file:./dev.db npx prisma generate
DATABASE_URL=file:./dev.db npx prisma db push
DATABASE_URL=file:./dev.db npx prisma format
npm run seed
npm run simulate -- --n 1000
npm run test
npm run lint
npm run build
npm audit --json
AGENT_LLM=off RAZORPAY_WEBHOOK_SECRET=local-verification-secret npm run dev -- --port 3100
```

The webhook secret above is a disposable local test value, not a credential from `.env.local`. Initial curl verification ran on port 3000; the final isolated verification server used 3100. Default `npm run dev` still uses 3000.

- **Vitest:** 41/41 tests passed, including mapped errors, consent, cancellation, channel learning, missing contacts, Hinglish, probability bounds and India-time salary boundaries.
- **Lint:** passed without warnings/errors for the implemented backend.
- **Build:** a complete production build passed with all API routes and the concurrently supplied frontend; final shared-workspace verification is recorded below.
- **Audit:** zero vulnerabilities after compatible dependency overrides.
- **CLI:** seed creates one merchant and 200 customers; 1,000-transaction simulation completes successfully.
- **HTTP:** stats, filtered/cursor transaction lists, transaction detail/events, feed, learning, single-failure demo, pending worker, reset, instant simulation, progress and SSE verified using curl.
- **Validation:** malformed JSON, invalid amounts and limits return 400; missing transaction returns 404; active-run reset and second-run requests return 409.
- **Webhooks:** all six event types tested with locally computed HMAC signatures; invalid signatures return 401; duplicate receipts are no-ops; delayed failures do not reopen paid orders; late recovery increments success and decrements a prior failure exactly once; mismatched paid amount returns 409.
- **Live simulation:** ten transactions completed in 56.25 seconds wall time (54.04 seconds between run timestamps), with 3 recoveries. SSE delivered JSON events while a demo failure was submitted.
- **Determinism:** two clean API simulations with seed 42 produced identical full stats, including reason/channel breakdowns, timeline and average recovery time. IDs and wall-clock event timestamps intentionally differ.

Local verification scripts and captured full outputs are in `/tmp/verify_recovery.py`, `/tmp/verify_webhooks.py`, `/tmp/recovery-repro.py`, `/tmp/recovery-api-verification.json`, `/tmp/recovery-webhook-verification.json`, and `/tmp/recovery-repro-final.log`. These contain only synthetic customer data and disposable test signatures.

## Final seeded dataset

```json
{
  "totalFailed": 1000,
  "totalAttempted": 897,
  "recovered": 331,
  "recoveryRate": 0.331,
  "revenueAtRiskPaise": 177202400,
  "revenueRecoveredPaise": 84377900,
  "avgRecoveryMinutes": 275.42455035246746,
  "activeRecoveries": 0
}
```

| Reason | Failed | Recovered | Recovery rate |
| --- | ---: | ---: | ---: |
| INSUFFICIENT_FUNDS | 89 | 19 | 21.3% |
| BANK_DOWN | 89 | 62 | 69.7% |
| OTP_TIMEOUT | 89 | 49 | 55.1% |
| UPI_APP_ERROR | 91 | 43 | 47.3% |
| CARD_EXPIRED | 95 | 27 | 28.4% |
| CARD_DECLINED | 93 | 9 | 9.7% |
| NETWORK_DROP | 101 | 59 | 58.4% |
| CART_ABANDONED | 90 | 33 | 36.7% |
| LIMIT_EXCEEDED | 91 | 16 | 17.6% |
| USER_CANCELLED | 85 | 0 | 0.0% |
| UNKNOWN | 87 | 14 | 16.1% |

These are simulated outcomes, not merchant performance claims. The final bank-down result is about 70%; card decline is about 10%, consistent with a 12% underlying WhatsApp success probability and finite sample/channel variation. The initial 8% suppression threshold caused premature card-decline suppression; it was reduced to 3% and both deterministic runs were repeated successfully.

## Sample curl outputs

Responses below are exact selected fields from actual requests; long lists are explicitly abbreviated.

```bash
curl -fsS http://localhost:3100/api/stats
```
```json
{
  "totalFailed": 1000,
  "totalAttempted": 897,
  "recovered": 331,
  "recoveryRate": 0.331,
  "revenueAtRiskPaise": 177202400,
  "revenueRecoveredPaise": 84377900,
  "avgRecoveryMinutes": 275.42455035246746,
  "activeRecoveries": 0,
  "byChannel": [
    {
      "channel": "whatsapp",
      "attempts": 650,
      "recovered": 281,
      "rate": 0.4323076923076923
    },
    {
      "channel": "sms",
      "attempts": 219,
      "recovered": 41,
      "rate": 0.1872146118721461
    },
    {
      "channel": "email",
      "attempts": 87,
      "recovered": 9,
      "rate": 0.10344827586206896
    }
  ],
  "timeline_first_2_only": [
    {
      "bucket": "2026-07-27T00:00:00.000Z",
      "failed": 6,
      "recovered": 0,
      "revenueRecoveredPaise": 0
    },
    {
      "bucket": "2026-07-27T01:00:00.000Z",
      "failed": 6,
      "recovered": 3,
      "revenueRecoveredPaise": 1135100
    }
  ]
}
```

```bash
curl -fsS 'http://localhost:3100/api/transactions?reason=BANK_DOWN&limit=1'
```
```json
{
  "items": [
    {
      "id": "cmtoo678i18dowt6yhzdsr0u2",
      "merchantId": "merchant_demo",
      "customerId": "customer_141",
      "amountPaise": 56700,
      "currency": "INR",
      "method": "upi",
      "status": "RECOVERED",
      "failureReason": "BANK_DOWN",
      "razorpayOrderId": null,
      "razorpayPaymentId": null,
      "errorCode": "DEMO_BANK_DOWN",
      "errorDescription": "Seeded synthetic payment failure",
      "createdAt": "2026-08-02T23:47:24.430Z",
      "recoveredAt": "2026-08-03T00:47:58.788Z",
      "isDemo": false,
      "simulationRunId": "cmtoo5vos0xq1wt6yjofnl0m9",
      "customer": {
        "id": "customer_141",
        "merchantId": "merchant_demo",
        "name": "Aarav Khan",
        "phone": "+919000000140",
        "email": "demo.customer141@example.com",
        "city": "Bengaluru",
        "language": "en",
        "segment": "loyal",
        "optedOut": false
      },
      "attempts": [
        {
          "id": "cmtoo678m18dswt6ynl1m4x1p",
          "transactionId": "cmtoo678i18dowt6yhzdsr0u2",
          "strategy": "BANK_COOLDOWN_ALTERNATE",
          "channel": "whatsapp",
          "timingBucket": "15m",
          "scheduledAt": "2026-08-03T00:02:24.430Z",
          "sentAt": "2026-08-03T00:02:24.430Z",
          "paymentLinkId": "plink_mock_b602b0d93ab0",
          "paymentLinkUrl": "https://rzp.io/l/mock_b602b0d93ab0",
          "message": "Hi Aarav, your ₹567.00 Chai Point order is still unpaid. Please try another bank or payment method after the short bank interruption: https://rzp.io/l/mock_b602b0d93ab0. If already paid, please ignore this reminder. Reply STOP to opt out.",
          "reasoning": "This looks like a temporary bank outage rather than a loss of purchase intent. Allow 15 minutes for the bank to recover, then offer another bank or payment method. For this ₹567.00 UPI order, whatsapp ranks highest among reachable channels at 72% estimated recovery, using a reason-specific prior and observed outcomes. This is a customer-authorised checkout invitation, not an automatic debit.",
          "confidence": 0.88,
          "expectedRecoveryProbability": 0.7235955056179776,
          "outcome": "RECOVERED",
          "recoveredAt": "2026-08-03T00:47:58.788Z",
          "attemptNo": 1
        }
      ]
    }
  ],
  "nextCursor": "cmtoo678i18dowt6yhzdsr0u2"
}
```

```bash
curl -fsS 'http://localhost:3100/api/agent/feed?limit=1'
```
```json
[
  {
    "id": "cmtoo68b3198rwt6yydbf3jkv",
    "type": "SIMULATION_COMPLETED",
    "title": "Simulation complete",
    "detail": {
      "runId": "cmtoo5vos0xq1wt6yjofnl0m9"
    },
    "transactionId": null,
    "createdAt": "2026-09-05T17:41:27.568Z"
  }
]
```

```bash
curl -fsS http://localhost:3100/api/learning
```
```json
{
  "stats_first_2_only": [
    {
      "id": "cmtoo5vsk0xtgwt6y45zah6sb",
      "reason": "BANK_DOWN",
      "channel": "whatsapp",
      "timingBucket": "15m",
      "successes": 62,
      "failures": 25
    },
    {
      "id": "cmtoo5x980zb2wt6yomzadd47",
      "reason": "CARD_DECLINED",
      "channel": "email",
      "timingBucket": "30m",
      "successes": 9,
      "failures": 67
    }
  ],
  "matrix_first_2_only": [
    {
      "reason": "BANK_DOWN",
      "channel": "whatsapp",
      "rate": 0.7126436781609196,
      "n": 87
    },
    {
      "reason": "CARD_DECLINED",
      "channel": "email",
      "rate": 0.11842105263157894,
      "n": 76
    }
  ],
  "insights": [
    "bank down recovered 62 of 87 attempts via whatsapp in the 15m window (71%). These are observed outcomes, not a causal guarantee.",
    "network drop recovered 59 of 99 attempts via whatsapp in the immediate window (60%). These are observed outcomes, not a causal guarantee.",
    "otp timeout recovered 49 of 87 attempts via whatsapp in the immediate window (56%). These are observed outcomes, not a causal guarantee."
  ]
}
```

```bash
curl -fsS -X POST http://localhost:3100/api/simulate   -H 'Content-Type: application/json'   -d '{"n":1000,"seed":42,"speed":"instant"}'
# HTTP 202; then GET /api/simulate/<runId>
```
```json
{
  "runId": "cmtoo5vos0xq1wt6yjofnl0m9"
}
```
```json
{
  "id": "cmtoo5vos0xq1wt6yjofnl0m9",
  "seed": 42,
  "n": 1000,
  "processed": 1000,
  "recovered": 331,
  "status": "COMPLETED",
  "error": null,
  "createdAt": "2026-09-05T17:41:11.212Z",
  "completedAt": "2026-09-05T17:41:27.566Z"
}
```

```bash
curl -sS -X POST http://localhost:3000/api/agent/run
```
```json
{
  "processed": 0
}
```

Verified webhook replay response (same signed body and event ID submitted twice):
```json
{
  "ok": true,
  "duplicate": true
}
```

```bash
curl -sS -N --max-time 8 http://localhost:3000/api/agent/events
```

SSE excerpt:

```text
retry: 2000
: connected

: heartbeat

: heartbeat

id: cmtonv9zy0010wt0liol6g9lv
data: {"id":"cmtonv9zy0010wt0liol6g9lv","type":"DETECTED","title":"Demo payment failure detected","detail":{"reason":"NETWORK_DROP","amountPaise":25000},"transactionId":"cmtonv9zw000ywt0ln1v1bto0","createdAt":"2026-09-05T17:32:56.542Z"}

id: cmtonva020014wt0lqfz31arh
data: {"id":"cmtonva020014wt0lqfz31arh","type":"DECIDED","title":"Recovery strategy selected","detail":{"strategy":"RESUME_CHECKOUT","channel":"whatsapp","timingBucket":"immediate","scheduledAt":"2026-09-05T17:32:56.544Z","message":"Hi Vivaan, your ₹250.00 Chai Point order is still unpaid. Please resume your interrupted checkout securely: {{link}}. If already paid, please ignore this reminder. Reply STOP to opt out.","reasoning":"A connection interruption does not necessarily mean the customer changed their mind. Restore checkout immediately with a fresh link and reassure them that payment confirmation will stop further reminders. For this ₹250.00 UPI order, whatsapp ranks highest among reachable channels at 59% estimated recovery, using a reason-specific prior and observed outcomes. This is a customer-authorised checkout invitation, not an automatic debit.","confidence":0.88,"expectedRecoveryProbability":0.592072072072072},"transactionId":"cmtonv9zw000ywt0ln1v1bto0","createdAt":"2026-09-05T17:32:56.546Z"}

id: cmtonva070018wt0luoshh084
data: {"id":"cmtonva070018wt0luoshh084","type":"MESSAGE_SENT","title":"whatsapp recovery reminder sent","detail":{"attemptId":"cmtonva010012wt0l726u01nw","paymentLinkUrl":"https://rzp.io/l/mock_881c6d96a18e","provider":"console"},"transactionId":"cmtonv9zw000ywt0ln1v1bto0","createdAt":"2026-09-05T17:32:56.551Z"}

: heartbeat

: heartbeat

: heartbeat

: heartbeat

: heartbeat


```

## Five actual rule-engine reasoning strings

Context: Priya Sharma, a ₹1,299 order, English preference, reachable phone and email, no learned outcomes, 2026-09-05 06:00 UTC. These come directly from `decide()`.

### INSUFFICIENT_FUNDS

The issuer reported insufficient funds, so repeating the request now is unlikely to help. A gentle reminder during the next 1st–3rd salary window gives the customer time to replenish their balance. For this ₹1,299.00 UPI order, whatsapp ranks highest among reachable channels at 30% estimated recovery, using a reason-specific prior and observed outcomes. This is a customer-authorised checkout invitation, not an automatic debit.

### BANK_DOWN

This looks like a temporary bank outage rather than a loss of purchase intent. Allow 15 minutes for the bank to recover, then offer another bank or payment method. For this ₹1,299.00 UPI order, whatsapp ranks highest among reachable channels at 70% estimated recovery, using a reason-specific prior and observed outcomes. This is a customer-authorised checkout invitation, not an automatic debit.

### OTP_TIMEOUT

The customer reached authentication but the OTP session expired. An immediate Payment Link offering UPI removes the repeated card OTP step while purchase intent is still fresh. For this ₹1,299.00 UPI order, whatsapp ranks highest among reachable channels at 58% estimated recovery, using a reason-specific prior and observed outcomes. This is a customer-authorised checkout invitation, not an automatic debit.

### CARD_EXPIRED

An expired card cannot succeed on a blind retry. Ask the customer to choose a new card or UPI through a secure hosted checkout; never request card details in a message. For this ₹1,299.00 UPI order, whatsapp ranks highest among reachable channels at 34% estimated recovery, using a reason-specific prior and observed outcomes. This is a customer-authorised checkout invitation, not an automatic debit.

### USER_CANCELLED

The customer explicitly cancelled. Respect that choice: the estimated chance of recovery is too low to justify an unsolicited reminder.

## Deviations and known gaps

1. The initial root placeholder was supplied as requested. Another concurrent task then installed a full frontend under `src/app` and `src/components`; those files were preserved rather than replaced with the placeholder. Temporary build failures during that task referenced not-yet-created components. No design-directory files were edited.
2. SQLite scheduling is durable, but execution is a long-lived Node process plus `npm run worker`, not a hosted queue. Interrupted simulation runs retain progress but do not automatically resume; stale RUNNING records need operator reconciliation. Do not run CLI and HTTP simulations concurrently.
3. ConsoleNotifier records simulated sends. Actual WhatsApp, SMS, email and inbound STOP handling need provider integration. Opt-outs already stored on customers are enforced both at planning and dispatch.
4. The generic Razorpay Payment Link offers the merchant's enabled methods; it does not force UPI intent or implement EMI/split payments. "Retry" is a customer checkout invitation, never an unauthorised debit.
5. Missing webhook secrets reject real webhook ingestion with 503; mock detection is available through the simulator and demo-failure endpoint. Subscription halted without payment/customer/amount context creates an attention event instead of an invented transaction.
6. Production mutations require a bearer demo token. Multi-merchant authentication, access-controlled read APIs, distributed locks, provider outbox delivery guarantees and provider dead-letter queues are outside this hackathon scope.
7. Optional LLM and live Razorpay network calls were not exercised to avoid spending limited credits or creating real payment requests. Their failure paths preserve deterministic decisions/pending actions. Default mock and signed-webhook paths were exercised.
8. Learning counts intentionally mix synthetic/demo outcomes in this single demo database. Reset before evaluating real merchant traffic. Cached copy uses placeholders so one customer's name or amount is not reused for another.
9. The timeline uses virtual historical transaction/settlement dates; the feed uses real ingestion time. This is deliberate so salary and 24-hour strategies can finish immediately while events stream live.

## Final shared-workspace build verification

`npm run build` passed on the final shared workspace (Next.js 15.5.25), including all API routes and `/`, `/feed`, `/insights`, `/recoveries`. The production compile, TypeScript checks, static generation and build tracing completed successfully. Full output: `/tmp/recovery-build-delivery.log`.

The concurrent frontend updates resolved their temporary prop/type mismatches without backend edits to those components. Final lint exits successfully; it reports one unrelated unused `outcomeTone` import warning in the concurrently authored `src/components/recoveries/RecoveriesPage.tsx`. Backend/API/scripts lint is clean.

The development server used for final curl checks is running on `http://localhost:3100` with LLM disabled and a disposable webhook secret. The database is left with one merchant, 200 customers and the final clean 1,000-failure dataset (331 recovered; ₹8,43,779 recovered revenue). Shared wire types explicitly include `NONE` for the failure reason of ordinary, never-failed paid transactions; those transactions are excluded from recovery denominators.
