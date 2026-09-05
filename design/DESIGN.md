# Recovery Agent — Design System

**Product:** an autonomous AI agent that catches every failed or abandoned Razorpay payment and recovers it.
**Surface:** a merchant dashboard that should feel like it was shipped by the Razorpay Dashboard team — not a hackathon skin on top of it.

Design principle: **the agent's thinking is the product.** Every screen exposes what the agent saw, what it decided, why, and what it earned back. Numbers are money; money is set in tabular figures and never wobbles.

---

## 1. Palette

Dark-mode-first. Light mode is a first-class alternate, not an afterthought — every token has a value in both, and all components read semantic tokens, never raw hex.

### 1.1 Brand

| Token | Hex | Use |
| --- | --- | --- |
| `brand.navy` | `#0C2451` | Razorpay deep navy. Landing hero ground, light-mode headings, agent-chrome accents. |
| `brand.navy-deep` | `#081A3B` | Navy pressed / gradient stop. |
| `brand.blue` | `#2B84EA` | **Primary.** Buttons, active nav, focus ring, primary chart series. |
| `brand.blue-bright` | `#528FF0` | Hover, links, glow, gradient stop. |
| `brand.blue-soft` | `#8FBEF7` | Dark-mode text-on-navy, chart line highlights. |
| `brand.cyan` | `#25C2D9` | Agent/AI accent only (feed pulse, "reasoning" chips). Never for CTAs. |

`brand.blue → brand.cyan` at 135° is the single sanctioned gradient (agent identity). Use it at most once per viewport.

### 1.2 Status

| Token | Hex | Meaning in product |
| --- | --- | --- |
| `success` | `#12B76A` | Recovered, captured, link paid. |
| `success.soft` | `#0B4A2E` (dk) / `#D6F5E4` (lt) | Badge ground. |
| `warning` | `#F79009` | In progress, nudged, awaiting customer, quiet hours. |
| `warning.soft` | `#4A320B` / `#FDF0D5` | Badge ground. |
| `danger` | `#F04438` | Failed, lost, at risk, bank down. |
| `danger.soft` | `#4C1A17` / `#FDE3E1` | Badge ground. |
| `info` | `#528FF0` | Scheduled, queued, informational. |
| `violet` | `#8B7BF7` | Learning / insight cards, model-derived numbers. |

### 1.3 Neutrals — semantic surface tokens

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `bg` | `#070D1B` | `#F5F7FB` | Page ground. |
| `surface` | `#0D1526` | `#FFFFFF` | Cards, table, drawer. |
| `surface-2` | `#131E33` | `#F0F4FA` | Nested panels, table header, inputs, hover rows. |
| `surface-3` | `#1A2740` | `#E7EDF7` | Pressed, chips, skeletons. |
| `border` | `#1E2C48` | `#E2E8F2` | Hairlines, card edges. |
| `border-strong` | `#2C3D5E` | `#CBD5E6` | Inputs, dividers under emphasis. |
| `text` | `#E8EEF9` | `#0C2451` | Primary copy, numbers. |
| `text-muted` | `#93A3BE` | `#52607A` | Labels, secondary copy. |
| `text-subtle` | `#64748B` | `#8493AC` | Timestamps, units, placeholder. |

Rule: **maximum three surface levels visible at once.** Page → card → nested panel. A fourth level means the layout is wrong.

### 1.4 Data-viz series

Ordered, colour-blind-safe enough for 6 series and stable across themes:
`#2B84EA` · `#12B76A` · `#F79009` · `#8B7BF7` · `#25C2D9` · `#F04438`

Semantic locks that override series order: failed = `danger`, recovered = `success`, at-risk = `warning`.

---

## 2. Typography

**Inter** (Google Fonts, weights 400/500/600/700), `font-feature-settings: 'cv05','ss01','tnum'`.
System fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.

| Role | Size / line | Weight | Tracking |
| --- | --- | --- | --- |
| Display (landing hero) | 60–72 / 1.05 | 700 | `-0.03em` |
| H1 page title | 28 / 1.2 | 650 | `-0.02em` |
| H2 section | 20 / 1.3 | 600 | `-0.015em` |
| H3 card title | 15 / 1.4 | 600 | `-0.01em` |
| Body | 14 / 1.55 | 400 | `0` |
| Body-sm / table | 13 / 1.5 | 400 | `0` |
| Label | 12 / 1.4 | 500 | `0.01em` |
| Overline | 11 / 1.2 | 600 | `0.09em`, uppercase |
| KPI metric | 32–40 / 1 | 700 | `-0.02em`, `tabular-nums` |
| Mono (IDs, keys) | 12 / 1.5 | 500 | `ui-monospace, 'SF Mono', Menlo` |

Every currency, percentage, duration and count uses `tabular-nums` so live-updating numbers never reflow.
Currency format: `₹1,24,850` — Indian grouping (`en-IN`), no decimals above ₹1,000; lakh/crore short form (`₹8.4L`, `₹1.2Cr`) only in hero stats and axis labels.

---

## 3. Spacing, radius, elevation

**Spacing** — 4px base: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 80`.
Card padding 20 (desktop) / 16 (mobile). Grid gutter 20. Section rhythm 32. Sidebar 248px, collapses under 1024px. Content max-width 1440px.

**Radius** — `sm 6` (chips, inputs) · `md 10` (buttons, small cards) · `lg 14` (cards, drawer) · `xl 20` (hero panels, modal) · `full` (pills, avatars, toggles).

**Elevation** — dark mode leans on borders and inner light, not black shadow.

| Level | Dark | Light |
| --- | --- | --- |
| `flat` | `border` hairline only | `border` hairline only |
| `raised` (card) | `inset 0 1px 0 rgb(255 255 255 / .04)` + `0 1px 2px rgb(0 0 0 / .4)` | `0 1px 2px rgb(12 36 81 / .06)` |
| `overlay` (drawer/popover) | `0 16px 48px rgb(0 0 0 / .55)` | `0 16px 48px rgb(12 36 81 / .12)` |
| `modal` | `0 32px 80px rgb(0 0 0 / .65)` | `0 32px 80px rgb(12 36 81 / .18)` |
| `glow` (agent live) | `0 0 0 4px rgb(43 132 234 / .12)` | same |

---

## 4. Components

**Chrome** — AppShell · Sidebar (nav items, agent status footer) · Topbar (merchant switcher, environment pill, theme toggle, live indicator) · MobileNav (hamburger → slide-over) · PageHeader (title, subtitle, actions).

**Data display** — KpiCard (label, value, delta, sparkline, tone) · LiveMoneyCounter (ticking ₹ at-risk) · StatTile · Badge (status/reason/channel variants) · ConfidenceMeter (segmented bar + %) · Table (sticky header, sortable, expandable row) · Drawer (right slide-over, 520px) · Timeline (vertical, node + connector, per-step meta) · WhatsAppBubble / SmsBubble / EmailCard (channel-accurate message previews) · HeatmapMatrix (reason × channel recovery rate) · InsightCard (violet accent, evidence line, sample size) · EmptyState · Skeleton.

**Charts** — RecoveryTimelineChart (dual-line area, failed vs recovered per hour) · ReasonBarChart (horizontal, recovery rate per failure reason) · ChannelEffectivenessChart (grouped bars: sent / opened / recovered).

**Agent** — AgentFeed (virtualised stream) · AgentEventCard (stage chip, headline, reasoning paragraph, artefacts) · StagePipeline (DETECT → DIAGNOSE → DECIDE → ACT → LEARN with active state) · TriggerFailureModal (reason / amount / method / channel → live simulation) · ReasoningBlock (cyan left-rule, italic-free plain English).

**Forms** — Button (primary/secondary/ghost/danger, sm/md/lg) · IconButton · Select · Input · SegmentedControl · Toggle · RadioCard (autonomy levels) · Slider (max nudges) · TimeRangePicker (quiet hours) · FilterBar (chips + clear-all).

**Feedback** — Toast · Tooltip · InlineAlert · KeyStatusRow (Razorpay key id, masked secret, webhook health dot).

---

## 5. Motion

Duration `fast 120ms` · `base 180ms` · `slow 260ms` · `deliberate 420ms` (agent stage transitions).
Easing: `--ease-out: cubic-bezier(.16,1,.3,1)` for entrances, `cubic-bezier(.4,0,.2,1)` for exits, `linear` for counters and progress only.

Rules:
1. **Count-ups** on KPI mount: 900ms, ease-out, `tabular-nums`, never re-runs on tab return.
2. **Feed entrance**: new event slides in from `translateY(-8px)` + fades over `slow`, with a 600ms cyan left-rule pulse. Never animate more than one entering item at a time.
3. **Agent pipeline**: stages advance on `deliberate`; the active stage gets `glow` elevation and a 1.6s breathing ring.
4. **Drawer**: 260ms slide + backdrop fade; content stagger max 3 items × 40ms.
5. **Charts** animate once on first paint (700ms), never on filter change — filters re-render instantly so the number you're reading is the number you get.
6. **Hover** is `fast` and colour/border only. No layout-shifting hovers in tables.
7. `@media (prefers-reduced-motion: reduce)` disables all of the above: counters snap to final value, feed items appear, pipeline steps toggle.

**Accessibility** — focus ring `0 0 0 2px bg, 0 0 0 4px brand.blue` on every interactive element; all nav/table/filter controls are real `<button>`/`<a>`; drawer and modal trap focus and close on `Esc`; live feed is `aria-live="polite"`; colour is never the only status carrier (badge always carries a word).

---

## 6. Tailwind config snippet

```js
// tailwind.config.js  (CDN: tailwind.config = {...})
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // semantic — driven by CSS vars, so one component works in both themes
        bg:        'rgb(var(--bg) / <alpha-value>)',
        surface:   'rgb(var(--surface) / <alpha-value>)',
        surface2:  'rgb(var(--surface-2) / <alpha-value>)',
        surface3:  'rgb(var(--surface-3) / <alpha-value>)',
        line:      'rgb(var(--border) / <alpha-value>)',
        lineStrong:'rgb(var(--border-strong) / <alpha-value>)',
        ink:       'rgb(var(--text) / <alpha-value>)',
        muted:     'rgb(var(--text-muted) / <alpha-value>)',
        subtle:    'rgb(var(--text-subtle) / <alpha-value>)',
        // brand
        navy:   { DEFAULT: '#0C2451', deep: '#081A3B' },
        rzp:    { DEFAULT: '#2B84EA', bright: '#528FF0', soft: '#8FBEF7' },
        agent:  '#25C2D9',
        // status
        success: { DEFAULT: '#12B76A', soft: 'rgb(var(--success-soft) / <alpha-value>)' },
        warning: { DEFAULT: '#F79009', soft: 'rgb(var(--warning-soft) / <alpha-value>)' },
        danger:  { DEFAULT: '#F04438', soft: 'rgb(var(--danger-soft) / <alpha-value>)' },
        info:    '#528FF0',
        violet:  '#8B7BF7',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                    mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'] },
      fontSize: {
        overline: ['11px', { lineHeight: '1.2', letterSpacing: '.09em', fontWeight: '600' }],
        label:    ['12px', { lineHeight: '1.4', letterSpacing: '.01em' }],
        bodysm:   ['13px', { lineHeight: '1.5' }],
        body:     ['14px', { lineHeight: '1.55' }],
        kpi:      ['34px', { lineHeight: '1', letterSpacing: '-.02em', fontWeight: '700' }],
        display:  ['64px', { lineHeight: '1.05', letterSpacing: '-.03em', fontWeight: '700' }],
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '20px' },
      boxShadow: {
        raised:  'inset 0 1px 0 rgb(255 255 255 / .04), 0 1px 2px rgb(0 0 0 / .4)',
        overlay: '0 16px 48px rgb(0 0 0 / .55)',
        modal:   '0 32px 80px rgb(0 0 0 / .65)',
        glow:    '0 0 0 4px rgb(43 132 234 / .12)',
        focus:   '0 0 0 2px rgb(var(--bg)), 0 0 0 4px #2B84EA',
      },
      transitionTimingFunction: { out: 'cubic-bezier(.16,1,.3,1)' },
      transitionDuration: { fast: '120ms', base: '180ms', slow: '260ms', deliberate: '420ms' },
      keyframes: {
        feedIn:   { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'none' } },
        breathe:  { '0%,100%': { boxShadow: '0 0 0 0 rgb(37 194 217 / .35)' },
                    '50%':     { boxShadow: '0 0 0 8px rgb(37 194 217 / 0)' } },
        shimmer:  { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        feedIn: 'feedIn .26s cubic-bezier(.16,1,.3,1) both',
        breathe: 'breathe 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
};
```

```css
/* token layer — :root is dark (dark-first); .light re-declares */
:root {
  --bg: 7 13 27;         --surface: 13 21 38;   --surface-2: 19 30 51;  --surface-3: 26 39 64;
  --border: 30 44 72;    --border-strong: 44 61 94;
  --text: 232 238 249;   --text-muted: 147 163 190; --text-subtle: 100 116 139;
  --success-soft: 11 74 46; --warning-soft: 74 50 11; --danger-soft: 76 26 23;
}
.light {
  --bg: 245 247 251;     --surface: 255 255 255; --surface-2: 240 244 250; --surface-3: 231 237 247;
  --border: 226 232 242; --border-strong: 203 213 230;
  --text: 12 36 81;      --text-muted: 82 96 122;  --text-subtle: 132 147 172;
  --success-soft: 214 245 228; --warning-soft: 253 240 213; --danger-soft: 253 227 225;
}
```

---

## 7. Voice

Numbers first, then the reason. The agent speaks in complete plain-English sentences with a causal clause and a number in it — "Sent a UPI intent link on WhatsApp within 90s **because** OTP timeouts recover 71% when retried immediately." Never "AI-powered", never "leveraging". Failure reasons are shown in human words (`OTP timed out`) with the raw enum available in mono type for engineers.
