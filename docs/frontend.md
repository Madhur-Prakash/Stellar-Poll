# Frontend — Components, Hooks & State

**Directory:** `frontend/src/`  
**Framework:** Next.js 16 App Router  
**Language:** TypeScript 5  
**Styling:** Tailwind CSS v4

> **Related:** [Architecture](architecture.md) · [API Reference](api-reference.md) · [Transaction Flow](transaction-flow.md) · [Design System](design-system.md) · [Smart Contract](smart-contract.md)

---

## Application Structure

```
src/
├── app/
│   ├── layout.tsx          — Root layout, fonts, metadata
│   ├── page.tsx            — Main page, state orchestration
│   └── globals.css         — Global styles, CSS variables
│
├── components/
│   ├── WalletPanel.tsx     — Wallet connect UI + balance
│   ├── PollCard.tsx        — Poll question + vote bars
│   ├── VoteForm.tsx        — Voting UI + transaction status
│   └── ActivityFeed.tsx    — Live vote feed
│
├── hooks/
│   ├── useWalletKit.ts     — Wallet state management
│   └── useContractEvents.ts — Poll data polling
│
└── lib/
    ├── contract.ts         — Soroban RPC functions
    ├── stellar.ts          — Horizon API functions
    └── walletkit.ts        — StellarWalletsKit singleton
```

---

## `app/layout.tsx`

Root layout component wrapping all pages.

```typescript
export const metadata: Metadata = {
  title: "StellarPoll – On-Chain Voting on Stellar Testnet",
  description: "Cast your vote on-chain via a Soroban smart contract",
};
```

Uses Geist font family (sans-serif + monospace) loaded from `next/font/google`. Sets `dark` color scheme via `<html>` attributes. The Tailwind global theme is dark: `--background: #09090b` (zinc-950), `--foreground: #fafafa`.

---

## `app/page.tsx` — State Orchestration

The main page is the top-level state owner. It:

1. Calls `useWalletKit()` — gets `address`
2. Calls `useContractEvents()` — gets `pollData`, `loading`, `error`, `refresh`, `lastUpdated`
3. Manages derived state: `alreadyVoted`, `voterChoice`, `feed`
4. Passes state down to child components as props
5. Passes callbacks (`onVoteSuccess`, `onVoteCast`) down to `VoteForm`

### State shape in `page.tsx`

```typescript
const { address } = useWalletKit();
const { pollData, loading, error, refresh, lastUpdated } = useContractEvents();

const [alreadyVoted, setAlreadyVoted] = useState(false);
const [voterChoice, setVoterChoice] = useState<number | null>(null);
const [feed, setFeed] = useState<FeedItem[]>([]);
```

### `checkVoteStatus()`

Runs whenever `address` or `pollData` changes. Fetches voter status from contract:

```typescript
const [voted, choice] = await Promise.all([
  hasVoted(address),
  getVoterChoice(address),
]);
```

Both calls are simulations (no wallet needed) and run in parallel.

### `handleVoteSuccess()`

Called by `VoteForm` after a confirmed vote transaction. Triggers `refresh()` (immediate poll data fetch) and `checkVoteStatus()` (update voter state).

### `handleVoteCast(option, txHash)`

Called by `VoteForm` when a vote is submitted. Constructs a `FeedItem` and prepends it to the feed, capped at 20 items:

```typescript
setFeed((prev) => [newItem, ...prev.slice(0, 19)]);
```

### Layout

- **Header:** Sticky with backdrop blur, contains logo + `WalletPanel`
- **Contract banner:** Shows deployed contract ID linked to Stellar.Expert
- **Warning:** If no `CONTRACT_ID` env var is set
- **Loading state:** Spinner while initial poll data loads
- **Error state:** Red box if poll fetch fails
- **Content grid:** `lg:grid-cols-3` — 2/3 width for poll+form, 1/3 for feed+stats

---

## Components

### `WalletPanel.tsx`

Displays wallet connection state and provides connect/disconnect controls.

**Props:** None — consumes `useWalletKit()` internally.

**State consumed from hook:**
- `address` — connected wallet address
- `balance` — XLM balance string
- `connecting` — loading state during connection
- `error` — typed wallet error

**UI states:**

| State | Display |
|---|---|
| Not connected | "Connect Wallet" button |
| Connecting | Spinner + "Connecting…" |
| Connected | Truncated address + XLM balance + "Disconnect" |
| Error: NOT_FOUND | Amber banner: "Freighter not found. [Install →]" |
| Error: REJECTED | Red banner: rejection message |
| Error: GENERIC | Red banner: error message |

**Address truncation:** First 6 + last 6 characters (`GA3X7K...JKLM7P`) via `truncateAddress()` from `stellar.ts`.

**Auto-dismiss:** `clearError()` is called when user clicks the X on any error banner.

---

### `PollCard.tsx`

Renders the poll question, vote bars with percentages, and vote counts.

**Props:**
```typescript
interface Props {
  pollData: PollData;
  voterChoice: number | null;
  loading: boolean;
  lastUpdated: Date | null;
}
```

**Vote bar colors:**

```typescript
const COLORS = ["indigo", "violet", "cyan", "emerald", "amber", "rose", "sky", "orange"];
```

Each option gets a deterministic color from this palette based on its index.

**Percentage calculation:**
```typescript
const pct = pollData.total > 0
  ? Math.round((votes[i] / pollData.total) * 100)
  : 0;
```

**User's vote highlight:** If `voterChoice === i`, the option row shows a "Your vote" indicator.

**Refresh indicator:** When `loading` is true (background refresh), shows a pulsing dot. When `lastUpdated` is set, shows relative timestamp.

---

### `VoteForm.tsx`

The most complex component. Manages the full vote submission UX.

**Props:**
```typescript
interface Props {
  options: string[];
  alreadyVoted: boolean;
  voterChoice: number | null;
  onVoteSuccess: () => void;
  onVoteCast?: (option: string, txHash: string) => void;
}
```

**Local state:**
```typescript
const [selected, setSelected] = useState<number | null>(null);  // selected option index
const [status, setStatus] = useState<TxStatus>("idle");          // tx pipeline stage
const [txHash, setTxHash] = useState<string | null>(null);      // confirmed tx hash
const [errorMsg, setErrorMsg] = useState<string | null>(null);  // error display
```

**`TxStatus` type:**
```typescript
type TxStatus = "idle" | "building" | "signing" | "submitting" | "confirming" | "success" | "failed";
```

**Vote flow (`handleVote`):**

→ Every stage annotated with code and error scenarios: [transaction-flow.md](transaction-flow.md)

```
1. Balance guard: balance < 0.1 XLM → setErrorMsg, return
2. setStatus("building") → buildVoteTransaction(address, selected)
3. setStatus("signing") → signTransaction(xdr) via Freighter
4. setStatus("submitting") → submitToRpc(signedXdr) → hash
5. setStatus("confirming") → waitForTransaction(hash) → SUCCESS/FAILED
6. setStatus("success") or setStatus("failed")
7. onVoteCast(option, hash) → feed update
8. onVoteSuccess() → refresh poll + voter status
```

**UI rendering:**
- If `alreadyVoted`: shows "Already voted" confirmation card (no form)
- If `!address`: shows "Connect your wallet to vote" prompt
- Otherwise: full vote form

**Button disabled conditions:**
- No option selected (`selected === null`)
- Transaction in flight (`isProcessing`)
- Vote already succeeded (`status === "success"`)

**Transaction status display:** A colored status box below the options. Blue/indigo for in-progress, green for success, red for failure. Shows spinner animation during in-flight states. Shows transaction hash as a Stellar.Expert link on submission.

---

### `ActivityFeed.tsx`

A session-scoped list of votes cast since the page was loaded.

**Props:**
```typescript
interface Props {
  items: FeedItem[];
}

interface FeedItem {
  id: string;
  voter: string;
  option: string;
  txHash: string;
  timestamp: Date;
}
```

**Display:**
- Voter address truncated to `GA1234...5678`
- Voted option name
- Timestamp (relative or absolute)
- Transaction hash as Stellar.Expert link

**Empty state:** "No votes yet in this session" message.

**Cap:** The parent component (`page.tsx`) caps the feed at 20 items — `ActivityFeed` itself does not truncate.

---

## Hooks

→ Hook return types and method signatures: [api-reference.md — Hooks](api-reference.md#srchooksusewalletkitts)

### `useWalletKit.ts`

Manages all wallet-related state and operations.

**State:**
```typescript
interface WalletState {
  address: string | null;
  balance: string | null;
  connecting: boolean;
  error: WalletError | null;
}
```

**WalletError union type:**
```typescript
type WalletError =
  | { type: "NOT_FOUND"; message: string }
  | { type: "REJECTED"; message: string }
  | { type: "INSUFFICIENT_BALANCE"; message: string }
  | { type: "GENERIC"; message: string };
```

**`classifyError(err)`** — maps raw error objects to the `WalletError` union. Inspects:
- `err.code === -1` → REJECTED
- `err.code === -3` or message contains "extension"/"not installed" → NOT_FOUND
- message contains "reject"/"denied" → REJECTED
- message contains "closed"/"cancel" → REJECTED
- anything else → GENERIC

**`connect()`:**
1. Sets `connecting: true`
2. Calls `initWalletKit()` (idempotent init)
3. Opens `StellarWalletsKit.authModal()` — shows wallet selection UI
4. On success: clears `stellar_poll_disconnected` flag from localStorage, fetches balance, sets `address`
5. On error: classifies and stores error

**`disconnect()`:**
1. Calls `StellarWalletsKit.disconnect()`
2. Sets `stellar_poll_disconnected = "1"` in localStorage
3. Resets all state to null

**`signTransaction(xdr)`:**
1. Calls `StellarWalletsKit.signTransaction(xdr, { networkPassphrase: Networks.TESTNET })`
2. Returns `result.signedTxXdr`
3. On REJECTED error: stores in hook state AND re-throws as `"REJECTED"` string for VoteForm to handle

**Auto-reconnect (useEffect on mount):**
```typescript
if (localStorage.getItem("stellar_poll_disconnected")) return;
StellarWalletsKit.getAddress()
  .then(({ address }) => { if (address) setState(...) })
  .catch(() => {});
```

If the user previously connected (no explicit disconnect), the kit can restore the session silently. The `stellar_poll_disconnected` flag prevents unwanted reconnection after explicit logout.

**`refreshBalance()`:** Re-fetches XLM balance for current address. Called after a vote succeeds (fees were deducted).

---

### `useContractEvents.ts`

Manages periodic polling of poll data from the Soroban contract.

**State:**
```typescript
{
  pollData: PollData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}
```

**Polling:**
```typescript
useEffect(() => {
  fetchPoll();
  const id = setInterval(fetchPoll, 8000);
  return () => clearInterval(id);
}, []);
```

On mount: immediate fetch, then every 8 seconds. Cleanup on unmount prevents memory leaks.

**`fetchPoll()`:** Calls `getPollData()` from `lib/contract.ts`. On success, updates `pollData` and `lastUpdated`. On failure, sets `error` string. `loading` is true only during the fetch.

**`refresh()`:** Exported function for imperative refresh. Used by `page.tsx` after a successful vote to get immediate updated counts without waiting for the next interval.

---

## Library Modules

### `lib/walletkit.ts`

```typescript
import { StellarWalletsKit, WalletNetwork, FREIGHTER_ID, FreighterModule } from "@creit.tech/stellar-wallets-kit";

export { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";

let kit: StellarWalletsKit | null = null;

export function initWalletKit(): void {
  if (kit) return;
  kit = new StellarWalletsKit({
    network: WalletNetwork.TESTNET,
    selectedWalletId: FREIGHTER_ID,
    modules: [new FreighterModule()],
  });
  (StellarWalletsKit as unknown as { _instance: StellarWalletsKit })._instance = kit;
}
```

The singleton pattern (`if (kit) return`) prevents multiple initializations. `initWalletKit()` is called at the top of `connect()` and in the auto-reconnect effect — both paths are safe to call multiple times.

### `lib/contract.ts`

See [api-reference.md — contract.ts](api-reference.md#srclibcontractts) for full function signatures. The on-chain functions this calls are documented in [smart-contract.md](smart-contract.md#function-reference).

**Key internal:** `simulateRead(method, args)` uses a well-known funded testnet account (`GAAZI4TCR3...`) as the simulated source. This account is not controlled by anyone — it's a public "throw-away" address that Soroban simulation requires for fee calculation. It is **not** used for actual transactions.

### `lib/stellar.ts`

Horizon API client. Used only for `getXLMBalance()` in the current app. The send/submit functions are implemented for extensibility but not called.

---

## TypeScript Path Aliases

`tsconfig.json` configures `@/*` to map to `src/*`:

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

All imports use `@/components/...`, `@/hooks/...`, `@/lib/...` — no relative path hell.

---

## Next.js Configuration

**`next.config.ts`:**
```typescript
const nextConfig: NextConfig = {
  experimental: { turbopack: true },
};
```

Turbopack (Next.js's Rust-based bundler) is enabled for faster development rebuilds.

**`"use client"` directives:** All components and hooks that use React hooks or browser APIs must have `"use client"` at the top. This is because Next.js App Router renders server components by default. `page.tsx`, all components, and both hooks are marked `"use client"`.

The `lib/` modules do not use React — they are plain TypeScript and run in both server and client contexts (but are effectively only called client-side since they depend on browser wallet APIs).
