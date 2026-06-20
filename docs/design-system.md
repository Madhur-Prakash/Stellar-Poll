# Design System & UI/UX

StellarPoll uses a deliberate, minimal dark design language. This document covers the visual decisions, color system, component patterns, and UX rationale.

> **Related:** [Frontend — component implementations](frontend.md) · [Architecture — design philosophy](architecture.md) · [Transaction Flow — UX pipeline](transaction-flow.md)

---

## Design Goals

1. **Focus on data** — The poll question and vote bars are the primary content. Everything else recedes.
2. **Status at a glance** — A user should understand the state of the system (connected/disconnected, voted/not voted, loading/ready) without reading text.
3. **Trust signals** — Every transaction is linked to a public blockchain explorer. Nothing is hidden.
4. **No clutter** — No marketing copy, no animations beyond functional feedback, no modals except the wallet.

---

## Color System

### Base Palette (Zinc)

The entire app uses zinc (cool gray) as the background and surface color family.

```
zinc-950  (#09090b)  — Page background
zinc-900  (#18181b)  — Card/panel background
zinc-800  (#27272a)  — Border, divider, scrollbar track
zinc-700  (#3f3f46)  — Hover border, inactive option border
zinc-500  (#71717a)  — Muted label text
zinc-400  (#a1a1aa)  — Secondary text
zinc-300  (#d4d4d8)  — Body text
zinc-100  (#f4f4f5)  — Primary text (near-white)
```

**Why zinc?** Zinc is cooler (slightly blue-tinted) than slate or gray, which makes it feel more "digital" and pairs well with the indigo accent. It's also Tailwind's most neutral dark-spectrum family.

### Accent Palette (Indigo)

Indigo is the primary brand/action color.

```
indigo-600  (#4f46e5)  — Primary button background
indigo-500  (#6366f1)  — Button hover
indigo-400  (#818cf8)  — Links, contract address text
indigo-300  (#a5b4fc)  — Highlighted values (network label)
indigo-900/40          — Selected option background (with opacity)
indigo-500/30          — Selected option border (with opacity)
indigo-900/20          — In-progress transaction background
```

Indigo communicates "active" and "selected" states throughout the UI.

### Semantic Colors

```
emerald-400   — "Voted ✓" status, success transaction
emerald-900/30 — Success transaction background
red-300       — Error text
red-900/30    — Error background
red-500/40    — Error border
amber-200     — Warning text (Freighter not found)
amber-900/20  — Warning background
amber-500/30  — Warning border
```

### Vote Bar Colors

Each poll option gets a distinct color to make the bar chart scannable:

```typescript
const COLORS = [
  "indigo",   // option 0
  "violet",   // option 1
  "cyan",     // option 2
  "emerald",  // option 3
  "amber",    // option 4
  "rose",     // option 5
  "sky",      // option 6
  "orange",   // option 7
];
```

These are applied as Tailwind `bg-{color}-500` classes for bar fills. They are visually distinct enough to differentiate even with color vision deficiencies when combined with percentage labels and vote counts.

---

## Typography

**Font family:** Geist (by Vercel, loaded via `next/font/google`)
- `GeistSans` — used for all body and UI text
- `GeistMono` — used for addresses, transaction hashes, contract IDs

**Why Geist?** It has excellent legibility at small sizes, distinct monospace variant, and a modern geometric style that pairs well with a dark tech aesthetic.

**Type scale in use:**

| Usage | Tailwind class | Size |
|---|---|---|
| App title | `text-xl font-bold` | 20px bold |
| Section headings | `text-sm font-semibold` | 14px semibold |
| Uppercase labels | `text-xs font-semibold uppercase tracking-widest` | 12px caps |
| Body text | `text-sm` | 14px |
| Small/secondary | `text-xs` | 12px |
| Mono addresses | `font-mono text-xs` | 12px monospace |

---

## Spacing & Layout

### Page container

```css
max-w-5xl mx-auto px-4 sm:px-6
```

Content is constrained to 1024px max-width, centered. Responsive horizontal padding (16px mobile, 24px desktop).

### Content grid

```css
grid grid-cols-1 lg:grid-cols-3 gap-6
```

On large screens: 2/3 width for `PollCard` + `VoteForm` (`lg:col-span-2`), 1/3 for the sidebar (feed + stats + faucet link).

On mobile: single column, full width.

### Card anatomy

All cards follow this pattern:
```
bg-zinc-900 border border-zinc-800 rounded-2xl p-5 (or p-6)
```

`rounded-2xl` (16px border radius) gives cards a modern, soft appearance while staying distinct from interactive buttons.

---

## Component Patterns

→ React implementations of these patterns: [frontend.md — Components](frontend.md#components)

### Cards

All information panels are `rounded-2xl` cards with:
- `bg-zinc-900` — slightly lighter than the page background
- `border border-zinc-800` — subtle border for definition
- `p-5` or `p-6` internal padding

### Buttons

**Primary action (Submit Vote):**
```css
bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed
py-3 rounded-xl text-white font-semibold text-sm transition-colors
```

Rounded `xl` (not full pill, not sharp) for a modern look. `transition-colors` for smooth hover state.

**Wallet panel buttons (Connect/Disconnect):**
```css
px-4 py-2 rounded-lg text-sm font-medium transition-colors
```
Connect: `bg-indigo-600 hover:bg-indigo-500 text-white`
Disconnect: `bg-zinc-800 hover:bg-zinc-700 text-zinc-300`

### Vote option buttons

Each option is a full-width button that toggles selection:

```css
// Unselected:
border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/50

// Selected:
border-indigo-500 bg-indigo-900/30 text-indigo-200
```

Custom radio-style indicator:
```
○ (unselected) → ● (selected)
```
Implemented as a `span` with conditional content, not a native `<input type="radio">`, to allow full styling control.

### Error/Warning Banners

Three visual variants:

| Severity | Background | Border | Text |
|---|---|---|---|
| Warning (amber) | `bg-amber-900/20` | `border-amber-500/30` | `text-amber-200` |
| Error (red) | `bg-red-900/30` | `border-red-500/40` | `text-red-200` |
| Info/Progress (indigo) | `bg-indigo-900/20` | `border-indigo-500/30` | `text-indigo-200` |
| Success (emerald) | `bg-emerald-900/30` | `border-emerald-500/40` | `text-emerald-200` |

All use `/20` or `/30` opacity backgrounds to keep them subtle — they communicate state without overwhelming the content.

### Loading States

**Initial poll load:** Centered spinner with zinc border + indigo top border (creates the spinning arc):
```css
border-2 border-indigo-500 border-t-transparent rounded-full animate-spin
```

**In-progress transaction:** Small inline spinner in the status box:
```css
w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0
```

Using `border-current` means the spinner color matches the surrounding text — no need for a separate color override.

**Background poll refresh:** A small pulsing dot appears on the PollCard header:
```css
w-2 h-2 bg-indigo-400 rounded-full animate-pulse
```

### Progress indicator (`Testnet` badge)

```css
bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full text-xs
```

A subdued pill badge next to the logo. Not a bright indicator — it should inform without distracting.

---

## Header Design

The header is sticky with backdrop blur:

```css
border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10
```

`bg-zinc-950/80` + `backdrop-blur-sm` creates the "frosted glass" effect — content scrolls behind a semi-transparent header, maintaining spatial context. The `z-10` ensures it floats above all page content.

---

## Vote Bars

Vote bars are `div` elements with dynamic width:

```html
<div
  style={{ width: `${pct}%` }}
  class="h-2 rounded-full transition-all duration-500 bg-indigo-500"
/>
```

`transition-all duration-500` provides a smooth animation when vote counts update. `h-2` (8px) is slim enough to read cleanly for 4+ options without taking too much vertical space.

The bar track is a full-width zinc background:
```css
bg-zinc-800 rounded-full overflow-hidden h-2
```

---

## UX Decisions

→ Technical implementation of the transaction pipeline: [transaction-flow.md](transaction-flow.md)

### Why no real-time WebSocket updates?

Poll voting is not a high-frequency event. 8-second polling is:
- Simple and predictable
- Doesn't require a WebSocket server
- Doesn't cause rate limiting issues on public RPCs
- Gives the user a clear mental model: "data refreshes periodically"

The `lastUpdated` timestamp in `PollCard` tells users exactly when the data was fetched.

### Why show the transaction hash immediately?

The tx hash is available as soon as the network accepts the transaction (before confirmation). Showing it immediately:
- Gives the user immediate proof that something happened on-chain
- Lets them check Stellar.Expert before the UI confirms
- Builds trust — nothing is hidden

### Why disable the form after voting?

The contract prevents double-voting on-chain. The UI restriction is redundant from a security perspective, but it:
- Prevents accidental double-submission
- Immediately signals "you're done here"
- Avoids a confusing "already voted" error from the contract

The "Already voted" card (`VoteForm.tsx:84`) appears instead of the form. It shows which option was chosen (`options[voterChoice]`), providing a clear receipt.

### Why show truncated addresses everywhere?

Stellar addresses are 56 characters. Showing the full address:
- Breaks mobile layouts
- Is unreadable — humans can't distinguish `GAAZI4TCR3TY5...` from `GAAZY4TCR3TY5...`
- Makes the feed visually noisy

Truncating to first 6 + last 6 characters (`GA3X7K...JKLM7P`) gives just enough unique information for users to recognize "their" address while keeping layouts clean.

### Why show the contract ID on the main page?

Transparency. Any user can see which contract is being used and verify it independently on Stellar.Expert. This is a fundamental trust feature for a DApp — the contract address is the source of truth, not the frontend.

### Why session-only activity feed?

The feed shows votes cast during the current page session. This design choice:
- Avoids needing a backend to store historical feed data
- Keeps the implementation simple (in-memory React state)
- Still provides meaningful social proof for active users
- Doesn't expose all historical voters' addresses permanently (mild privacy consideration)

For a production app, historical votes can be fetched from the contract's event stream or an indexer.

---

## Responsiveness

The app is tested at three breakpoints:

| Screen | Layout |
|---|---|
| Mobile (< 1024px) | Single column, full width |
| Tablet (768–1024px) | Single column with better spacing |
| Desktop (≥ 1024px) | 3-column grid (poll+form | feed+stats) |

The header uses `flex-wrap` to gracefully handle the wallet address wrapping to a second line on very narrow viewports.

---

## Accessibility Notes

- All interactive elements (buttons, links) have visible focus styles via Tailwind's `focus-visible` utilities
- Color is not the only signal — text labels accompany all status states
- Spinner animations use `prefers-reduced-motion` respecting Tailwind defaults
- Contrast ratios: zinc-300 on zinc-900 ≈ 7:1 (WCAG AAA)
- Transaction hash links open in `_blank` with `rel="noreferrer"` for security
