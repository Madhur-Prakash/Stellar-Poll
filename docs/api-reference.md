# API Reference

All public functions and types exported from `src/lib/`, `src/hooks/`, and the smart contract.

> **Related:** [Smart Contract — Rust source](smart-contract.md) · [Frontend — how hooks are consumed](frontend.md) · [Transaction Flow — how write functions fit together](transaction-flow.md)

---

## `src/lib/contract.ts`

### Constants

```typescript
export const CONTRACT_ID: string
```
Loaded from `process.env.NEXT_PUBLIC_CONTRACT_ID`. Empty string if not set.

```typescript
export const TESTNET_RPC_URL = "https://soroban-testnet.stellar.org"
export const NETWORK_PASSPHRASE = Networks.TESTNET
```

### Types

```typescript
export interface PollData {
  question: string;    // The poll question text
  options: string[];   // Array of option strings (2–8 items)
  votes: number[];     // Vote count per option (parallel to options[])
  total: number;       // Sum of all votes
}
```

### Read Functions (no wallet required)

---

#### `getPollData(): Promise<PollData>`

Fetches the complete poll state from the contract. Makes three parallel simulation calls:

```typescript
const [question, options, votes] = await Promise.all([
  simulateRead("get_question"),
  simulateRead("get_options"),
  simulateRead("get_all_votes"),
]);
```

**Returns:** `PollData` object with question, options array, votes array, and total.

**Throws:** If `CONTRACT_ID` is not set, or if RPC simulation fails.

**Usage:**
```typescript
import { getPollData } from "@/lib/contract";
const data = await getPollData();
// { question: "...", options: [...], votes: [3, 7, 1, 4], total: 15 }
```

---

#### `hasVoted(voterAddress: string): Promise<boolean>`

Checks whether a Stellar address has cast a vote.

**Parameters:**
- `voterAddress` — Stellar public key (`G...`)

**Returns:** `true` if voted, `false` if not (or if any error occurs — fails gracefully to `false`).

**Contract call:** `has_voted(Address)` — reads persistent storage.

**Usage:**
```typescript
const voted = await hasVoted("GABC123...");
```

---

#### `getVoterChoice(voterAddress: string): Promise<number | null>`

Returns the option index the voter chose.

**Parameters:**
- `voterAddress` — Stellar public key

**Returns:** Option index (0-based) if voted, `null` if not voted or any error.

**Note:** The contract's `get_voter_choice()` panics if the address hasn't voted. This wrapper catches that panic and returns `null`.

**Usage:**
```typescript
const choice = await getVoterChoice("GABC123...");
// 2 (voted for options[2]), or null
```

---

### Write Functions (wallet signature required)

→ How these functions are chained together: [transaction-flow.md](transaction-flow.md)

---

#### `buildVoteTransaction(voterAddress: string, optionIndex: number): Promise<string>`

Builds and prepares an unsigned vote transaction XDR.

**Parameters:**
- `voterAddress` — Stellar public key of the voter (must be the connected wallet)
- `optionIndex` — 0-based index of the option to vote for

**Returns:** Base64 XDR string of the prepared unsigned transaction.

**Process:**
1. Fetches current account state (sequence number) from Soroban RPC
2. Builds a `TransactionBuilder` with `vote(voter, option)` invocation
3. Calls `server.prepareTransaction()` to add Soroban auth footprint
4. Returns the XDR of the prepared transaction

**Timeout:** 180 seconds (transaction expires 3 minutes after building).

**Throws:** If `CONTRACT_ID` is not set, or RPC unreachable.

**Usage:**
```typescript
const xdr = await buildVoteTransaction("GABC123...", 0);
```

---

#### `submitToRpc(signedXDR: string): Promise<string>`

Submits a signed transaction to the Soroban RPC.

**Parameters:**
- `signedXDR` — Base64 XDR string of the wallet-signed transaction

**Returns:** Transaction hash (hex string).

**Throws:** If the RPC rejects the transaction (`status === "ERROR"`).

**Note:** Successful return means the transaction was accepted for processing, not that it was confirmed. Use `waitForTransaction()` to confirm.

**Usage:**
```typescript
const hash = await submitToRpc(signedXDR);
```

---

#### `waitForTransaction(hash: string, maxRetries?: number): Promise<"SUCCESS" | "FAILED">`

Polls the RPC for transaction confirmation.

**Parameters:**
- `hash` — Transaction hash from `submitToRpc()`
- `maxRetries` — Maximum poll attempts (default: 20)

**Returns:** `"SUCCESS"` or `"FAILED"`.

**Behavior:**
- Polls every 2000ms
- `NOT_FOUND` status → continue polling (transaction pending)
- `SUCCESS` → return `"SUCCESS"`
- `FAILED` → return `"FAILED"`
- After `maxRetries` attempts → return `"FAILED"`

**Total wait time:** `maxRetries * 2s = 40s` with defaults.

**Usage:**
```typescript
const result = await waitForTransaction(hash);
if (result === "SUCCESS") { /* ... */ }
```

---

## `src/lib/stellar.ts`

Horizon API client for balance lookups and payment utilities.

### Constants

```typescript
export const TESTNET_HORIZON = "https://horizon-testnet.stellar.org"
export const TESTNET_RPC = "https://soroban-testnet.stellar.org"
export const NETWORK_PASSPHRASE = Networks.TESTNET
export const horizon: Horizon.Server
```

### Functions

---

#### `getXLMBalance(publicKey: string): Promise<string>`

Fetches the native XLM balance for a Stellar account.

**Parameters:**
- `publicKey` — Stellar public key

**Returns:** Balance as a string formatted to 7 decimal places (e.g., `"9999.9998000"`).
Returns `"0.0000000"` if the account has no native balance.

**Usage:**
```typescript
const bal = await getXLMBalance("GABC123...");
// "9999.9998000"
```

---

#### `buildSendXLMTransaction(source, destination, amount, memo?): Promise<string>`

Builds an unsigned XLM payment transaction.

**Parameters:**
- `source` — Sender Stellar public key
- `destination` — Recipient Stellar public key
- `amount` — Amount as string (e.g., `"10.5"`)
- `memo` — Optional text memo (max 28 bytes)

**Returns:** Base64 XDR of unsigned transaction.

**Note:** Not currently used in StellarPoll. Provided for extension.

---

#### `submitToHorizon(signedXDR: string): Promise<string>`

Submits a signed transaction to Horizon (for non-Soroban transactions).

**Parameters:**
- `signedXDR` — Signed base64 XDR

**Returns:** Transaction hash.

---

#### `isValidAddress(address: string): boolean`

Validates a Stellar Ed25519 public key.

**Parameters:**
- `address` — String to validate

**Returns:** `true` if valid Stellar public key format, `false` otherwise.

**Usage:**
```typescript
isValidAddress("GABC..."); // true
isValidAddress("not-a-key"); // false
```

---

#### `truncateAddress(address: string): string`

Formats a long Stellar address for display.

**Parameters:**
- `address` — Full Stellar public key (56 chars)

**Returns:** `"GA1234...5678XY"` — first 6 + `...` + last 6 characters.

**Usage:**
```typescript
truncateAddress("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN");
// "GAAZI4...OCCWN"
```

---

#### `getRecentTransactions(publicKey: string, limit?: number): Promise<TransactionRecord[]>`

Fetches recent transactions for an account from Horizon.

**Parameters:**
- `publicKey` — Stellar public key
- `limit` — Number of transactions to return (default: 10)

**Returns:** Array of Horizon `TransactionRecord` objects, ordered newest-first.

---

## `src/lib/walletkit.ts`

### Functions

---

#### `initWalletKit(): void`

Initializes the StellarWalletsKit singleton with Freighter support. Idempotent — safe to call multiple times.

**Usage:**
```typescript
import { initWalletKit, StellarWalletsKit } from "@/lib/walletkit";
initWalletKit();
const { address } = await StellarWalletsKit.authModal();
```

### Exports

```typescript
export { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
```

Re-exports the kit singleton and Networks enum for use across the app.

---

## `src/hooks/useWalletKit.ts`

→ How this hook is used in components: [frontend.md — Hooks](frontend.md#hooks)

### Types

```typescript
export type WalletError =
  | { type: "NOT_FOUND"; message: string }
  | { type: "REJECTED"; message: string }
  | { type: "INSUFFICIENT_BALANCE"; message: string }
  | { type: "GENERIC"; message: string };
```

### Hook Return Value

```typescript
useWalletKit(): {
  // State
  address: string | null;            // Connected wallet public key
  balance: string | null;            // XLM balance as string
  connecting: boolean;               // True during wallet modal open
  error: WalletError | null;         // Typed error or null

  // Actions
  connect: () => Promise<void>;      // Open wallet modal
  disconnect: () => Promise<void>;   // Disconnect and clear session
  signTransaction: (xdr: string) => Promise<string>; // Sign XDR via Freighter
  refreshBalance: () => void;        // Re-fetch XLM balance
  clearError: () => void;            // Dismiss current error
}
```

### Behavior

| Method | Description |
|---|---|
| `connect()` | Opens StellarWalletsKit auth modal. Sets `connecting: true`. On success, stores `address` and fetches balance. On failure, classifies and stores error. |
| `disconnect()` | Calls `StellarWalletsKit.disconnect()`. Sets `stellar_poll_disconnected` flag in localStorage. Resets all state. |
| `signTransaction(xdr)` | Passes XDR to `StellarWalletsKit.signTransaction()`. Returns `signedTxXdr`. On REJECTED: stores error in state AND re-throws `"REJECTED"`. |
| `refreshBalance()` | Calls `getXLMBalance(address)` and updates state. No-op if no address. |
| `clearError()` | Sets `error: null` in state. |

---

## `src/hooks/useContractEvents.ts`

### Hook Return Value

```typescript
useContractEvents(): {
  pollData: PollData | null;      // Current poll state
  loading: boolean;               // True during any fetch
  error: string | null;           // Error message or null
  lastUpdated: Date | null;       // Timestamp of last successful fetch
  refresh: () => void;            // Trigger immediate re-fetch
}
```

### Behavior

- Fetches poll data immediately on mount
- Refetches every 8 seconds automatically
- Clears interval on unmount
- `refresh()` triggers an immediate fetch outside the interval schedule

---

## Smart Contract — Rust API

→ Full contract internals, storage model, and security: [smart-contract.md](smart-contract.md)

**Contract:** `PollContract` (`contracts/poll/src/lib.rs`)

### Initialization

```
initialize(env: Env, question: String, options: Vec<String>) -> ()
```
- Panics if already initialized
- Panics if `options.len() < 2` or `options.len() > 8`
- No auth required (called once by deployer)

### Write

```
vote(env: Env, voter: Address, option: u32) -> ()
```
- **Auth required:** `voter.require_auth()`
- Panics `"invalid option"` if `option >= option_count`
- Panics `"already voted"` if address has voted before
- Emits event: topic `("vote",)`, data `(voter, option, new_count)`

### Read

```
get_question(env: Env) -> String
get_options(env: Env) -> Vec<String>
get_votes(env: Env, option: u32) -> u32
get_all_votes(env: Env) -> Vec<u32>
has_voted(env: Env, voter: Address) -> bool
get_voter_choice(env: Env, voter: Address) -> u32  // panics if not voted
```

All read functions are simulatable — no auth, no fee.
