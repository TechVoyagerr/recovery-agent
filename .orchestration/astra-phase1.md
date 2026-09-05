# TASK: Build the backend + AI agent core of "Razorpay Recovery Agent" (hackathon entry, Razorpay AI Builder Internship 2026, Track 3: AI Revenue Recovery)

You are the senior backend engineer. Work AUTONOMOUSLY in /Users/macbook/Documents/VSC/Razorpay. Do not ask questions; make sensible choices and document them. When finished, write a report to `.orchestration/astra-phase1-report.md` (format at bottom). Do NOT touch anything under `design/` or `.orchestration/` (except your report file). A designer is working in `design/` concurrently.

## Product
An autonomous AI agent that catches every failed/abandoned Razorpay payment and recovers it:
1. DETECT: Razorpay webhooks (payment.failed, order.paid, payment.captured, payment_link.paid, subscription.charged/halted) + a built-in simulator for demo.
2. DIAGNOSE: classify failure reason: INSUFFICIENT_FUNDS, BANK_DOWN, OTP_TIMEOUT, UPI_APP_ERROR, CARD_EXPIRED, CARD_DECLINED, NETWORK_DROP, CART_ABANDONED, LIMIT_EXCEEDED, USER_CANCELLED, UNKNOWN (map from Razorpay error_code/error_reason/error_source/error_step + method).
3. DECIDE: agent picks the best recovery strategy per case, e.g. insufficient funds → schedule retry near salary date (1st-3rd of month) + gentle WhatsApp nudge; bank down → retry in 15 min with alternate method suggestion; OTP timeout → immediate UPI intent Payment Link; card expired → Payment Link via WhatsApp asking for new method; cart abandoned → reminder in 30 min then 24h; limit exceeded → split/EMI suggestion; and "do nothing" when recovery probability is too low or customer opted out. Each decision has: strategy, channel (whatsapp|sms|email|none), scheduledAt, message text (personalised, Indian context, Hinglish when customer language=hi), confidence 0-1, expectedRecoveryProbability, and a plain-English REASONING string (shown in the UI — must read like a smart analyst wrote it).
4. ACT: create a Razorpay Payment Link (via `razorpay` npm SDK when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET present; otherwise a realistic mock link `https://rzp.io/l/mock_xxx`) and "send" the message (log a MessageEvent; a pluggable `Notifier` interface with a ConsoleNotifier default).
5. LEARN: track outcome per (reason, channel, timingBucket) with Beta-binomial counts the agent consults to rank strategies, exposed via API with derived insight sentences.
6. OUTCOME SIMULATION (demo): simulate customer responses with realistic probabilities per reason/channel/timing so a 1000-transaction run yields ~30-40% recovery overall, varying by reason (bank down high ~70%, card declined low ~12%, etc.). Deterministic with a seed.

## Stack (fixed)
- Next.js 15 (App Router) + TypeScript + Tailwind CSS in the repo root. Scaffold with `npx create-next-app@latest . --ts --tailwind --app --eslint --src-dir --import-alias "@/*" --use-npm --yes`; if it refuses on a non-empty dir, scaffold in a temp dir and move files in (keep existing `.env.local`, `design/`, `.orchestration/`).
- Prisma + SQLite (`prisma/dev.db`). Models: Merchant, Customer (name, phone, email, city, language, segment, optedOut), Transaction (amountPaise, currency, method upi|card|netbanking|wallet, status FAILED|RECOVERED|PENDING_RECOVERY|GIVEN_UP|PAID, failureReason, razorpayOrderId, razorpayPaymentId, errorCode, errorDescription, createdAt), RecoveryAttempt (transactionId, strategy, channel, scheduledAt, sentAt, paymentLinkId, paymentLinkUrl, message, reasoning, confidence, outcome PENDING|RECOVERED|FAILED|EXPIRED, recoveredAt, attemptNo), AgentEvent (type, title, detail JSON, transactionId?, createdAt), LearningStat (reason, channel, timingBucket, successes, failures).
- Agent brain: OpenRouter (OpenAI-compatible chat completions at https://openrouter.ai/api/v1 via the `openai` npm SDK with baseURL) reading OPENROUTER_API_KEY and OPENROUTER_MODEL from env. `.env.local` with these ALREADY EXISTS in the repo root — never print, log, commit, or move the key; ensure `.env*.local` is gitignored. The key has a LOW rate/credit limit, so: the deterministic rule engine is the PRIMARY decision maker; the LLM is used only to (a) polish the customer message and (b) enrich the reasoning paragraph, with max_tokens<=300, 10s timeout, in-memory+DB cache keyed by (reason, method, amountBucket, segment, language), and an env switch `AGENT_LLM=off` to disable. Bulk simulations must NOT call the LLM per transaction — rule engine only, with at most ~20 LLM calls per run for showcased transactions. Both paths share one `RecoveryDecision` type. The rule engine must be genuinely excellent; it is what most of the demo runs on.
- Razorpay: `razorpay` npm SDK; webhook signature verification with RAZORPAY_WEBHOOK_SECRET; everything degrades to mock mode without keys. Provide `.env.example`.
- Seed: `npm run seed` → 1 merchant ("Chai Point Demo Store"), ~200 customers (Indian names/cities/phones, mixed language en/hi). `npm run simulate -- --n 1000` also reachable via API.

## API contract (frontend builds against EXACTLY this; shared types in `src/lib/types.ts`)
- `GET /api/stats` → `{ totalFailed, totalAttempted, recovered, recoveryRate, revenueAtRiskPaise, revenueRecoveredPaise, avgRecoveryMinutes, activeRecoveries, byReason: [{reason, failed, recovered, revenueRecoveredPaise, rate}], byChannel: [{channel, attempts, recovered, rate}], timeline: [{bucket ISO hour, failed, recovered, revenueRecoveredPaise}] }`
- `GET /api/transactions?status=&reason=&channel=&limit=&cursor=` → `{ items: (Transaction & {customer, attempts: RecoveryAttempt[]})[], nextCursor }`
- `GET /api/transactions/[id]` → transaction + customer + attempts + related AgentEvents.
- `GET /api/agent/feed?limit=` → recent AgentEvents newest first.
- `GET /api/agent/events` → Server-Sent Events stream of new AgentEvents (live UI).
- `POST /api/simulate` body `{ n, seed?, speed?: 'instant'|'live' }` → `live` emits events over ~60s; returns `{ runId }`. `GET /api/simulate/[runId]` → progress.
- `POST /api/agent/run` → process pending → `{ processed }`.
- `POST /api/demo/fail` body `{ amountPaise, reason, method, customerId? }` → creates one failed txn, runs the agent immediately (LLM allowed here), returns transaction with attempt.
- `GET /api/learning` → `{ stats: LearningStat[], matrix: {reason, channel, rate, n}[], insights: string[] }`.
- `POST /api/webhooks/razorpay` → real webhook.
- `POST /api/reset` → wipe & reseed.
All money in paise integers; `formatINR` in `src/lib/format.ts`.

## Frontend
Only a minimal placeholder `src/app/page.tsx` listing endpoints with a button that POSTs /api/simulate. A designer will replace all UI; keep `src/app/**` (non-api) and `src/components/**` minimal.

## Quality bar
- `npm run build` passes with zero type errors; `npm run dev` works; `npm run seed && npm run simulate` produce a believable dataset. Verify the API endpoints with curl against a running dev server and paste sample outputs in the report.
- `README.md` (architecture in mermaid, run steps, env vars, how the agent decides). Vitest unit tests for classifier + rule engine.

## Report (`.orchestration/astra-phase1-report.md`)
What was built, file map, exact commands, deviations, known gaps, sample curl outputs, and 5 sample reasoning strings from the rule engine.
