# Prototype → React component map

Every visual block in `dashboard.html` and `landing.html`, and the React component it becomes.
Conventions: components live in `components/`, hooks in `hooks/`, formatting helpers in `lib/format.ts` (`inr`, `inrShort`, `agoLabel`). Currency is always an integer in rupees. `—` in the endpoint column means the component is presentational and takes props from its parent.

Shared domain types (`lib/types.ts`):

```ts
type FailureReason = 'INSUFFICIENT_FUNDS'|'BANK_DOWN'|'OTP_TIMEOUT'|'UPI_APP_ERROR'|'CARD_EXPIRED'
                   |'CARD_DECLINED'|'NETWORK_DROP'|'CART_ABANDONED'|'LIMIT_EXCEEDED'|'USER_CANCELLED';
type Channel = 'whatsapp' | 'sms' | 'email';
type RecoveryStatus = 'recovered' | 'in_progress' | 'nudged' | 'scheduled' | 'lost';
type AgentStage = 'DETECT' | 'DIAGNOSE' | 'DECIDE' | 'ACT' | 'LEARN';
```

---

## App shell

| Component | Props | Endpoint |
| --- | --- | --- |
| `AppShell` | `{ children }` | — |
| `Sidebar` | `{ active: ViewKey; agentStatus: AgentStatus; unreadFeed: number }` | `/api/stats` (agent status block) |
| `Topbar` | `{ merchant: Merchant; env: 'test'\|'live'; webhooksToday: number; onTriggerFailure(): void }` | `/api/stats` |
| `ThemeToggle` | `{}` — writes `ra-theme` to `localStorage`, toggles `.light` on `<html>` | — |
| `MobileNavDrawer` | `{ open, onClose, active }` | — |
| `PageHeader` | `{ title: string; subtitle?: string; actions?: ReactNode }` | — |

## Overview (`/`)

| Component | Props | Endpoint |
| --- | --- | --- |
| `KpiRow` | `{ stats: Stats }` | `GET /api/stats` |
| `KpiCard` | `{ label; value: number\|string; format: 'inr'\|'pct'\|'duration'\|'count'; delta?: { value: string; tone: 'up'\|'down' }; progress?: number; countUp?: boolean }` | — |
| `LiveMoneyBand` | `{ atRiskSeed: number; recoveredSeed: number; tickMs?: number }` — the ticking ₹ counter | `GET /api/stats`, then client-side interval |
| `RecoveryTimelineChart` | `{ points: { hour: string; failed: number; recovered: number }[] }` | `GET /api/stats?series=timeline` |
| `ReasonBarChart` | `{ rows: { reason: FailureReason; rate: number }[] }` | `GET /api/learning` |
| `ChannelEffectivenessChart` | `{ rows: { channel: Channel; sent: number; opened: number; recovered: number }[] }` | `GET /api/learning` |
| `TopRecoveriesList` | `{ items: Transaction[] }` | `GET /api/transactions?status=recovered&sort=amount&limit=5` |
| `DateRangeSegment` | `{ value: '24h'\|'7d'\|'30d'; onChange(v): void }` | drives the `range` query param on `/api/stats` |

## Live Agent Feed (`/feed`)

| Component | Props | Endpoint |
| --- | --- | --- |
| `AgentFeed` | `{ initial: AgentEvent[]; paused: boolean }` — subscribes via `useAgentStream` | `GET /api/agent/feed` (initial page), `GET /api/agent/events` (SSE) |
| `useAgentStream` (hook) | `(onEvent: (e: AgentEvent) => void, { paused })` — `EventSource` with reconnect/backoff | `GET /api/agent/events` (SSE) |
| `AgentEventCard` | `{ event: AgentEvent }` where `AgentEvent = { id; stage: AgentStage; title; reasoning?; meta?: string[]; link?: string; message?: string; channel?: Channel; at: string }` | — |
| `ReasoningBlock` | `{ text: string }` — cyan left-rule, plain-English decision reason | — |
| `StagePipeline` | `{ active: AgentStage \| null }` — DETECT → DIAGNOSE → DECIDE → ACT → LEARN | — |
| `AgentVitalsCard` | `{ vitals: { eventsProcessed; decisions; medianDecisionMs; avgConfidence; suppressed } }` | `GET /api/stats` |
| `FailureMixCard` | `{ rows: { reason: FailureReason; pct: number }[] }` | `GET /api/stats?series=failureMix` |
| `TriggerFailureModal` | `{ open; onClose; onFired(sim: SimResult): void }` — form: reason, amount, method, customer | `POST /api/demo/fail` (fires a synthetic `payment.failed`), or `POST /api/simulate` for the bulk demo run |
| `FeedPauseButton` | `{ paused; onToggle() }` — pauses rendering only, never the stream | — |

## Recoveries (`/recoveries`)

| Component | Props | Endpoint |
| --- | --- | --- |
| `RecoveriesTable` | `{ rows: Transaction[]; onSelect(id: string): void }` | `GET /api/transactions` |
| `RecoveryFilterBar` | `{ value: { q; status; reason; channel }; onChange(v): void; total; shown }` | drives query params on `/api/transactions` |
| `TransactionRow` | `{ tx: Transaction }` — keyboard-activatable (`Enter`/`Space`) | — |
| `TransactionDrawer` | `{ txId: string \| null; onClose() }` — focus-trapped, `Esc` to close | `GET /api/transactions/:id` |
| `DrawerStatGrid` | `{ amount; status; method }` | — |
| `AgentTimeline` | `{ steps: TimelineStep[] }` where `TimelineStep = { stage; title; at; body: ReactNode; tone }` | — |
| `ConfidenceMeter` | `{ value: number /* 0–1 */ }` — 10-segment bar + numeric | — |
| `WhatsAppBubble` | `{ text: string; sentAt: string; business: string }` | — |
| `SmsPreview` | `{ text; senderId; dltTemplateId }` | — |
| `EmailPreview` | `{ subject; from; body }` | — |
| `MessagePreview` | `{ channel: Channel; …channel-specific props }` — dispatches to the three above | — |
| `DrawerActions` | `{ onResend(); onStop() }` | `POST /api/transactions/:id/resend`, `POST /api/transactions/:id/stop` |
| `StatusBadge` / `ReasonBadge` / `ChannelBadge` | `{ value }` | — |

## Learning (`/learning`)

| Component | Props | Endpoint |
| --- | --- | --- |
| `LearningMatrix` | `{ cells: { reason: FailureReason; channel: Channel; rate: number; n: number }[]; bestPlay: Record<FailureReason, string> }` | `GET /api/learning` |
| `MatrixCell` | `{ rate: number; n: number; isBest: boolean }` — green alpha scales with rate | — |
| `InsightGrid` | `{ insights: Insight[] }` | `GET /api/learning` |
| `InsightCard` | `{ insight: { tag; title; body; sampleSize; confidence; adoptedAt; tone } }` | — |
| `TimingCurveChart` | `{ buckets: { label: string; rate: number }[] }` | `GET /api/learning?series=timing` |

## Settings (`/settings`)

| Component | Props | Endpoint |
| --- | --- | --- |
| `AutonomyRadioGroup` | `{ value: 'suggest'\|'approve'\|'auto'; onChange(v): void }` | `GET/PATCH /api/settings` |
| `ChannelToggleList` | `{ channels: { key: Channel\|'push'; enabled: boolean; connected: boolean; recoveryRate: number }[]; onToggle(key, on) }` | `GET/PATCH /api/settings` |
| `GuardrailsForm` | `{ quietHours: [string, string]; maxNudges: number; minAmount: number; windowHours: 24\|48\|72\|168 }` | `PATCH /api/settings` |
| `RazorpayConnectionCard` | `{ keyId: string; webhookPath: string; webhookHealth: 'ok'\|'failing'; linksCreated24h: number; subscriptions: 'beta'\|'off' }` | `GET /api/settings` (never returns the secret) |
| `SubscribedEventsList` | `{ events: string[] }` | `GET /api/settings` |
| `PauseAgentCard` | `{ onPause() }` | `POST /api/settings/pause` |

## Shared primitives

`Button` · `IconButton` · `Badge` · `Chip` · `Toggle` · `RadioCard` · `Slider` · `Select` · `Input` · `SegmentedControl` · `Card` · `Drawer` · `Modal` · `Toast` + `useToast` · `Tooltip` · `EmptyState` · `Skeleton` · `useCountUp(target, { duration, decimals, respectsReducedMotion })` · `useFocusTrap(ref, active)`.

## Landing page (`landing.html` → `app/(marketing)/page.tsx`)

| Component | Props | Endpoint |
| --- | --- | --- |
| `MarketingNav` | `{}` | — |
| `Hero` | `{ stats: { recovered; rate; medianDecisionMs } }` | `GET /api/stats` (falls back to static copy) |
| `AgentDemoCard` | `{ sample: AgentEvent[] }` — the static five-step story in the hero | — |
| `ProblemStats` | `{ items: { value; label; note }[] }` | — |
| `FailureReasonMarquee` | `{ reasons: FailureReason[] }` | — |
| `HowItWorksSteps` | `{ steps: { n; title; body; icon }[] }` | — |
| `LearnCallout` | `{ insights: Insight[] }` | `GET /api/learning` (top 3) |
| `DemoRunBand` | `{ failed; recovered; revenue; avgTime }` | `POST /api/simulate` result, cached |
| `ArchitectureStrip` | `{}` | — |
| `RazorpayApiGrid` | `{ apis: { name; body; endpoints }[] }` | — |
| `FaqAccordion` | `{ items: { q; a }[] }` — native `<details>`, no JS needed | — |
| `MarketingFooter` | `{}` | — |

## API surface referenced above

| Endpoint | Returns |
| --- | --- |
| `GET /api/stats` | KPI row, money-band seeds, agent vitals, timeline series, failure mix, webhook count |
| `GET /api/transactions` | Filtered/paged recovery rows (`q`, `status`, `reason`, `channel`) |
| `GET /api/transactions/:id` | One transaction plus its full agent timeline and message body |
| `GET /api/agent/feed` | Most recent N agent events (initial paint, and the SSE fallback) |
| `GET /api/agent/events` | SSE stream of `AgentEvent` |
| `POST /api/demo/fail` | Fires one synthetic `payment.failed` and streams the five stages back |
| `POST /api/simulate` | Runs the 1,000-transaction demo batch, returns the aggregate result |
| `GET /api/learning` | Reason × channel matrix, derived insights, channel effectiveness, timing buckets |
| `GET/PATCH /api/settings` | Autonomy level, channels, guardrails, Razorpay connection status |
