# Architecture & Design Theory

## Overview

StellarPoll is a **serverless, client-only DApp** — there is no backend server, no database, and no centralized API. All state lives on the Stellar blockchain. The frontend reads from and writes to the Soroban smart contract directly from the browser.

This document covers the architectural decisions, layer responsibilities, and the design theory behind the system.

> **Related:** [Smart Contract](smart-contract.md) · [Frontend](frontend.md) · [Transaction Flow](transaction-flow.md) · [API Reference](api-reference.md) · [Design System](design-system.md)

---

## Design Philosophy

### 1. Trust Minimization

The core value proposition of a blockchain poll over a traditional web poll is **trustlessness**: no one — not even the app developer — can alter vote counts or cast votes on behalf of others. Every vote is:

- Signed by the voter's private key (held in Freighter, never accessible to the app)
- Verified on-chain by the contract's `require_auth()` call
- Immutably stored in Soroban's persistent ledger

The app enforces nothing — the contract does. The frontend is a thin interface layer.

### 2. Separation of Concerns

Three distinct layers with explicit boundaries:

```
┌──────────────────────────────────────────────────────────────┐
│  Presentation Layer                                          │
│  (React components — rendering only, no business logic)      │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  Application Layer                                           │
│  (Custom hooks — state management, side effects)             │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  Infrastructure Layer                                        │
│  (lib/ — raw blockchain I/O, wallet integration)             │
└──────────────────────────────────────────────────────────────┘
```

Components do not call `contract.ts` or `stellar.ts` directly. They consume hook state and call hook functions. Hooks orchestrate the infrastructure. Infrastructure functions are pure async functions with no React dependencies.

### 3. Read vs. Write Symmetry

Soroban distinguishes simulation (read) from execution (write):

| Operation | Mechanism | Wallet Required | Cost |
|---|---|---|---|
| Read poll data | `simulateTransaction()` | No | Free |
| Check voter status | `simulateTransaction()` | No | Free |
| Cast vote | Full signed transaction | Yes | ~0.00001 XLM |

The app exploits this by polling for poll state every 8 seconds without requiring a connected wallet. Only the vote submission requires wallet interaction.

### 4. Optimistic UI with On-Chain Confirmation

The vote transaction goes through a multi-stage pipeline that is reflected live in the UI:

```
idle → building → signing → submitting → confirming → success/failed
```

The user sees exactly where their transaction is in the pipeline. No black-box "loading" spinner.

---

## System Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                          Browser                                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     page.tsx (Home)                         │  │
│  │                State orchestration layer                    │  │
│  │                                                             │  │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐  ┌───────┐  │  │
│  │  │WalletPanel │  │  PollCard  │  │ VoteForm  │  │ Feed  │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  └───┬───┘  │  │
│  └────────┼───────────────┼───────────────┼─────────────┼──────┘  │
│           │               │               │             │          │
│  ┌────────▼───────┐ ┌─────▼──────────┐    │             │          │
│  │  useWalletKit  │ │useContractEvts │    │             │          │
│  │  (wallet state)│ │ (poll polling) │    │             │          │
│  └────────┬───────┘ └─────┬──────────┘    │             │          │
│           │               │               │             │          │
│  ┌────────▼───────────────▼───────────────▼─────────────▼──────┐  │
│  │                         lib/                                 │  │
│  │   walletkit.ts      contract.ts          stellar.ts          │  │
│  └─────────┬───────────────┬─────────────────────┬─────────────┘  │
└────────────┼───────────────┼─────────────────────┼────────────────┘
             │               │                     │
             ▼               ▼                     ▼
      ┌────────────┐  ┌──────────────┐    ┌──────────────┐
      │  Freighter │  │ Soroban RPC  │    │ Horizon API  │
      │ (Browser   │  │ (Testnet)    │    │ (Testnet)    │
      │  Extension)│  │              │    │              │
      └────────────┘  └──────┬───────┘    └──────────────┘
                             │
                      ┌──────▼────────┐
                      │ PollContract  │
                      │ (Rust WASM   │
                      │  on Stellar) │
                      └───────────────┘
```

---

## Layer Responsibilities

### Presentation Layer — `src/components/`

→ Component props, state, and rendering details: [frontend.md — Components](frontend.md#components)

Components are nearly stateless. Each component:
- Receives all data it needs via props
- Renders based on those props
- Calls callback props for user actions
- Does not call hooks directly (except `VoteForm`, which uses `useWalletKit` for sign/refresh)

**Components and their contracts:**

| Component | Receives | Emits |
|---|---|---|
| `WalletPanel` | (uses `useWalletKit` directly) | — |
| `PollCard` | `pollData`, `voterChoice`, `loading`, `lastUpdated` | — |
| `VoteForm` | `options`, `alreadyVoted`, `voterChoice` | `onVoteSuccess`, `onVoteCast` |
| `ActivityFeed` | `items: FeedItem[]` | — |

### Application Layer — `src/hooks/`

→ Hook internals and return values: [frontend.md — Hooks](frontend.md#hooks)

Hooks own all React state and side effects. They translate raw blockchain data into React-consumable state.

**`useWalletKit`** manages:
- Wallet connection lifecycle (idle → connecting → connected/error)
- Session persistence via `localStorage`
- Auto-reconnect on page reload
- Transaction signing via StellarWalletsKit
- Error classification (NOT_FOUND / REJECTED / INSUFFICIENT_BALANCE / GENERIC)
- XLM balance from Horizon API

**`useContractEvents`** manages:
- 8-second polling interval for poll state
- `getPollData()` call → `PollData` shape
- Loading / error state for poll fetch

### Infrastructure Layer — `src/lib/`

→ Full TypeScript signatures and usage: [api-reference.md](api-reference.md)

Pure async functions. No React. No global state. Just blockchain I/O.

**`contract.ts`** — Soroban RPC interface:
- `simulateRead()` — internal helper for read-only contract calls
- `getPollData()` — aggregates 3 parallel reads (question, options, votes)
- `hasVoted()` / `getVoterChoice()` — per-address simulation reads
- `buildVoteTransaction()` — unsigned XDR construction + `prepareTransaction()`
- `submitToRpc()` — signed XDR submission
- `waitForTransaction()` — polling confirmation loop

**`stellar.ts`** — Horizon API:
- `getXLMBalance()` — native balance lookup
- `isValidAddress()` / `truncateAddress()` — address utilities
- `buildSendXLMTransaction()` / `submitToHorizon()` — available for extension

**`walletkit.ts`** — StellarWalletsKit singleton initialization:
- `initWalletKit()` — creates the kit instance (lazy, idempotent)
- Exports `StellarWalletsKit` singleton and `Networks`

---

## Data Flow

### Read path (periodic, no wallet)

```
useContractEvents
  └─ setInterval(8000)
       └─ getPollData()
            ├─ simulateRead("get_question")
            ├─ simulateRead("get_options")
            └─ simulateRead("get_all_votes")
                 └─ each: SorobanRpc.Server.simulateTransaction()
                          → scValToNative(result.retval)
```

### Write path (on user action, requires wallet)

→ Every stage annotated with code: [transaction-flow.md](transaction-flow.md)

```
VoteForm.handleVote()
  ├─ buildVoteTransaction(address, selectedIndex)
  │     ├─ server.getAccount(voterAddress)   — fetch sequence number
  │     ├─ TransactionBuilder.build()        — construct unsigned TX
  │     └─ server.prepareTransaction(tx)     — add Soroban auth footprint
  │
  ├─ useWalletKit.signTransaction(xdr)
  │     └─ StellarWalletsKit.signTransaction() → Freighter popup
  │
  ├─ submitToRpc(signedXDR)
  │     └─ server.sendTransaction()          — broadcast to network
  │
  └─ waitForTransaction(hash)
        └─ poll server.getTransaction(hash) every 2s, up to 20 retries
```

---

## State Management

No global state library (no Redux, no Zustand). State is split into two React hook scopes:

### Wallet state (`useWalletKit`)

```
{ address, balance, connecting, error }
```

Lives at the hook level, shared throughout the app via the hook being called in `page.tsx` and passed down.

### Poll state (`useContractEvents`)

```
{ pollData, loading, error, lastUpdated }
```

Refreshed every 8 seconds. `refresh()` is called imperatively after a successful vote.

### Derived state (in `page.tsx`)

```
{ alreadyVoted, voterChoice }  — fetched from contract after poll load or vote
{ feed: FeedItem[] }           — session-only, appended on each successful vote
```

### Local component state (in `VoteForm`)

```
{ selected, status, txHash, errorMsg }
```

Tracks the in-flight transaction and UI display.

---

## Polling vs. Subscriptions

The current implementation uses interval polling for poll data rather than websocket event subscriptions. This is intentional:

- Soroban RPC has limited streaming support
- 8 seconds is fast enough for a voting scenario
- Polling is simpler, more predictable, and easier to debug
- The `refresh()` escape hatch lets the app do an immediate update after the user's own vote

For higher-frequency or production-critical scenarios, the `useContractEvents` hook can be refactored to use Stellar's streaming (Horizon EventSource) or a custom indexer.

---

## Security Considerations

→ Contract-level security model: [smart-contract.md — Security Model](smart-contract.md#security-model)

### Private keys never leave the browser extension
The app receives a signed XDR from Freighter — it never sees the user's private key. `signTransaction()` only passes an unsigned XDR and network passphrase to the extension.

### No centralized vote storage
Vote counts on the frontend are fetched directly from the contract via simulation. There is no server-side cache or database that could be tampered with.

### One-vote enforcement is on-chain
Even if someone bypassed the frontend (calling the RPC directly), the contract's `persistent()` storage check and `require_auth()` prevent double-voting. The UI restriction is UX, not security.

### XDR integrity
The `buildVoteTransaction()` result is a `prepareTransaction()` output — the Soroban RPC has already added the correct auth footprint. The user signs exactly what the contract requires.
