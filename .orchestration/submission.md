1. Project name + one-line tagline

Recovery Agent
Turn every failed Razorpay payment into a timely, consent-aware recovery opportunity.

2. What does it solve?

Indian merchants lose revenue in the last mile: a customer intends to pay, but UPI app errors, OTP timeouts, bank downtime, expired cards, limits, or a dropped network stop the transaction. Indian merchants face roughly 20–30% payment failure rates across methods and bank conditions. Most merchants see a red FAILED status, then manually chase customers—or do nothing. That means lost orders, wasted acquisition spend, support tickets, and a poor customer experience, especially for small businesses without a recovery team.

Recovery Agent turns that dead end into an automated revenue workflow for Razorpay merchants. It catches failed and abandoned payments through webhooks, identifies the likely cause from Razorpay error signals and payment method, and chooses the next best action. A bank-down failure can receive a delayed retry; an OTP timeout can get an immediate UPI-friendly Payment Link; an insufficient-funds case can be timed near salary dates. Messages are personalised for Indian customers, including Hinglish when appropriate. Every action is consent-aware, measurable, and tied to a payment link and outcome, so merchants recover revenue instead of guessing.

3. How it works

The agent receives Razorpay webhooks for failed, paid, captured, and Payment Link events; the built-in simulator provides realistic demo traffic. It maps error code, error reason, source, step, payment method, and customer context to a specific failure reason such as BANK_DOWN, OTP_TIMEOUT, UPI_APP_ERROR, or CARD_EXPIRED. A deterministic rule engine then selects the best strategy, channel, timing, message, confidence, and expected recovery probability. It creates a Razorpay Payment Link, sends a personalised WhatsApp, SMS, or email nudge, and records every decision with plain-English reasoning. Paid links and failed attempts update learning statistics for each reason, channel, and timing bucket. The 1,000-transaction simulator makes the impact measurable, demonstrating roughly 30–40% overall recovery.

4. Why it wins / what’s different

- Autonomous agent with visible reasoning: every action includes the chosen strategy, confidence, expected recovery probability, and a plain-English explanation a merchant can inspect.
- Learns at the useful level: outcomes update performance for each reason × channel × timing combination, so the agent improves from actual merchant data instead of using one generic retry rule.
- Razorpay-native execution: it consumes Razorpay webhooks, uses the Razorpay SDK, and creates real Razorpay Payment Links that take the customer back to payment.
- Consent-aware recovery: it respects opt-outs, supports a deliberate “do nothing” decision, and never auto-debits a customer.
- Measurable hero number: a deterministic 1,000-transaction simulator demonstrates roughly 30–40% overall recovery and reports revenue at risk, revenue recovered, recovery rate, and channel performance.

5. Tech stack

Next.js 15 App Router, TypeScript, Tailwind CSS, Prisma, SQLite, Razorpay Node SDK and webhooks, deterministic rule engine, OpenRouter through the OpenAI-compatible SDK for message polish and reasoning enrichment, Server-Sent Events, and Vitest.

6. Razorpay products used

Razorpay Payments and payment webhooks, Razorpay Payment Links, Razorpay Node SDK, and Razorpay webhook signature verification.

7. 60-second pitch script

Every failed payment is a customer who was ready to buy. In India, UPI errors, OTP timeouts, bank downtime, card limits, and abandoned checkouts drive payment failures to roughly 20–30%, while merchants usually see only a red FAILED status. Recovery Agent is an autonomous revenue-recovery agent for Razorpay. It listens to payment webhooks, diagnoses why each payment failed, and chooses the next best action: retry after a bank outage, send a UPI-friendly Payment Link after an OTP timeout, or schedule a gentle reminder near salary dates when funds are low. It generates a personalised message, explains its reasoning in plain English, respects consent and opt-outs, and never auto-debits. Razorpay Payment Links close the loop; outcomes feed learning for every reason, channel, and timing window. Our deterministic agent runs the workflow reliably, with OpenRouter polishing messages. In a 1,000-transaction simulation, it demonstrates roughly 30–40% recovery and shows exactly how much revenue was saved.

8. Three-line demo walkthrough

1. Inject a failed UPI, OTP, or bank-down transaction and show the agent diagnosing the failure in the live feed.
2. Open the decision to reveal its reasoning, scheduled channel and timing, personalised message, and generated Razorpay Payment Link.
3. Mark the customer as paid and show the recovered revenue, recovery rate, and reason × channel × timing learning update.

9. Anticipated judge questions

Q: Is this actually an AI agent, or just a retry script?
A: The agent diagnoses the failure, chooses among recovery strategies, timing, channels, and “do nothing,” explains its decision, and learns from outcomes. Deterministic rules keep decisions reliable and auditable; OpenRouter is used to polish messages and enrich reasoning, not to hide the core logic.

Q: Why not retry every failed payment immediately?
A: Failure reasons need different interventions. Bank downtime calls for a delay, OTP timeout calls for an immediate UPI-friendly link, insufficient funds calls for salary-date timing, and low-probability cases should be left alone. Reason-specific recovery avoids wasted retries and customer fatigue.

Q: Can the agent charge customers without permission?
A: No. It never auto-debits. It sends a consent-aware nudge and a Razorpay Payment Link, respects opt-outs, and records a deliberate no-action decision when recovery is inappropriate.

Q: What makes this Razorpay-native?
A: It consumes Razorpay payment webhooks, maps Razorpay error fields, uses the Razorpay Node SDK, verifies webhook signatures, and creates Razorpay Payment Links to complete recovery.

Q: How do you prove that it creates value?
A: The simulator runs 1,000 deterministic transactions with reason-specific outcomes and demonstrates roughly 30–40% recovery. The product exposes revenue at risk, revenue recovered, recovery rate, average recovery time, channel results, and learning insights.
