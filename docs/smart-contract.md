# Smart Contract — Deep Dive

**File:** `contracts/poll/src/lib.rs`  
**Language:** Rust (`#![no_std]`)  
**SDK:** `soroban-sdk = "22.0.0"`  
**Compiled Target:** `wasm32-unknown-unknown`

> **Related:** [Architecture](architecture.md) · [Deployment](deployment.md) · [Transaction Flow](transaction-flow.md) · [API Reference](api-reference.md)

---

## Overview

The `PollContract` is a Soroban smart contract that implements a single on-chain poll. It is designed around three invariants:

1. **Immutable question and options** — once `initialize()` is called, the question and options cannot be changed
2. **One vote per address** — enforced cryptographically via `require_auth()` + persistent storage
3. **Transparent results** — anyone can read vote counts without a wallet

---

## Storage Architecture

→ Why instance vs. persistent was chosen: [architecture.md — Design Philosophy](architecture.md#design-philosophy)

Soroban has three storage tiers. The poll contract uses two:

### Instance Storage
Accessed via `env.storage().instance()`

Instance storage is tied to the contract instance. All entries share the same TTL and are evicted together. Used for **shared, mutable poll state**:

| Key | Type | Description |
|---|---|---|
| `DataKey::Question` | `String` | The poll question text |
| `DataKey::OptionCount` | `u32` | Number of options (2–8) |
| `DataKey::Option(u32)` | `String` | Text of option at index i |
| `DataKey::Votes(u32)` | `u32` | Vote count for option at index i |

**Why instance storage for these?** They are read on every poll fetch. Grouping them in instance storage means one storage footprint for all shared data, reducing auth/fee overhead.

### Persistent Storage
Accessed via `env.storage().persistent()`

Persistent storage entries are per-key and have independent TTLs. Each entry survives ledger cleanup independently. Used for **per-voter records** that must outlast the poll:

| Key | Type | Description |
|---|---|---|
| `DataKey::HasVoted(Address)` | `bool` | Whether this address has cast a vote |
| `DataKey::VoterChoice(Address)` | `u32` | Which option index they voted for |

**Why persistent for voter data?** If instance storage is archived, voter records must still be queryable (for `has_voted()` checks). Persistent storage guarantees this independently.

---

## Data Key Enum

```rust
#[contracttype]
pub enum DataKey {
    Question,
    OptionCount,
    Option(u32),
    Votes(u32),
    HasVoted(Address),
    VoterChoice(Address),
}
```

`#[contracttype]` makes this enum serializable by the Soroban SDK into XDR storage keys. The enum variants become the ledger entry keys.

---

## Function Reference

→ TypeScript wrappers that call these functions: [api-reference.md](api-reference.md)

### `initialize(env, question, options)`

```rust
pub fn initialize(env: Env, question: String, options: Vec<String>)
```

**Purpose:** One-time poll setup. Sets the question and option list.

**Guards:**
- Checks `env.storage().instance().has(&DataKey::Question)` — panics with `"already initialized"` if called twice. This makes initialization idempotent: the deployer cannot accidentally overwrite an active poll.
- Asserts `options.len() >= 2` — a poll with one option is meaningless.
- Asserts `options.len() <= 8` — prevents unbounded storage growth.

**Storage writes:**
- `Question` → question string
- `OptionCount` → number of options
- `Option(i)` → each option text
- `Votes(i)` → `0u32` for each option (explicit zero initialization)

**Called by:** The `deploy.sh` script immediately after contract deployment.

---

### `vote(env, voter, option)`

```rust
pub fn vote(env: Env, voter: Address, option: u32)
```

**Purpose:** Cast one vote for the given option index.

**Auth:** `voter.require_auth()` — the Soroban runtime verifies that the transaction was signed by the `voter`'s keypair. Without this, anyone could vote on behalf of any address.

→ How the frontend builds and submits this transaction: [transaction-flow.md — Stage 2](transaction-flow.md#stage-2--build-transaction)

**Guards:**
1. `option < count` — prevents out-of-bounds index panics
2. `HasVoted(voter)` persistent lookup — panics `"already voted"` if true

**Side effects:**
1. Increments `Votes(option)` in instance storage
2. Sets `HasVoted(voter) = true` in persistent storage
3. Sets `VoterChoice(voter) = option` in persistent storage

**Event publication:**
```rust
env.events().publish(
    (symbol_short!("vote"),),
    (voter, option, current + 1),
);
```

Emits a `"vote"` event with topic `vote` and data `(voter_address, option_index, new_vote_count)`. Off-chain indexers (horizon event streaming, custom indexers) can subscribe to this.

---

### Read Functions

All read functions are view-only (no state mutation). They can be called via RPC simulation with no wallet and no fee.

```rust
pub fn get_question(env: Env) -> String
```
Returns the poll question.

```rust
pub fn get_options(env: Env) -> Vec<String>
```
Returns all option strings as a `Vec<String>`. Iterates from `0..OptionCount` fetching each `Option(i)`.

```rust
pub fn get_votes(env: Env, option: u32) -> u32
```
Returns vote count for a single option index.

```rust
pub fn get_all_votes(env: Env) -> Vec<u32>
```
Returns all vote counts as a `Vec<u32>`. More efficient than calling `get_votes()` N times (single simulation call).

```rust
pub fn has_voted(env: Env, voter: Address) -> bool
```
Returns whether the address has voted. Uses `unwrap_or(false)` so uninitialized entries (addresses that have never interacted) return false without panicking.

```rust
pub fn get_voter_choice(env: Env, voter: Address) -> u32
```
Returns the option index the voter chose. **Panics** with `"voter has not voted"` if called on an address that hasn't voted — callers should check `has_voted()` first.

---

## Error Conditions

| Condition | Panic Message | When |
|---|---|---|
| Poll already initialized | `"already initialized"` | `initialize()` called twice |
| Too few options | assertion failure | `initialize()` with < 2 options |
| Too many options | assertion failure | `initialize()` with > 8 options |
| Option out of range | assertion failure | `vote()` with index >= option count |
| Address already voted | `"already voted"` | `vote()` called on already-voted address |
| Voter choice not found | `"voter has not voted"` | `get_voter_choice()` on address with no vote |
| Not initialized | `unwrap()` panic | Any read function before `initialize()` |

---

## Security Model

### Sybil resistance
The contract enforces one vote per **Stellar address**. An address must have XLM to pay transaction fees. This creates a soft economic barrier: a user needs a funded account for each vote, and accounts cost a base reserve (~1 XLM minimum) plus fee per transaction.

This is **not** Sybil-proof in the way a KYC system would be, but it is appropriate for a testnet demonstration. On mainnet, the economic cost provides meaningful friction.

### Authority model
`voter.require_auth()` ensures that only the keypair controlling `voter` can call `vote()` on behalf of that address. The frontend passes the connected wallet's address as `voter` — Freighter's signature authorizes that specific invocation. Even a malicious frontend cannot cast a vote for an address it doesn't control.

### Replay protection
Soroban transactions include the account's sequence number. The `buildVoteTransaction()` function fetches the current sequence number from the network:

```typescript
const account = await server.getAccount(voterAddress);
```

Each account can only use each sequence number once — replay attacks are structurally prevented.

---

## Contract Cargo.toml

```toml
[package]
name = "poll-contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "22.0.0", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "22.0.0", features = ["testutils"] }

[profile.release]
opt-level = "z"        # Optimize for size (WASM target)
overflow-checks = true
debug = 0
strip = "symbols"
lto = true
codegen-units = 1
```

`crate-type = ["cdylib"]` is required for Soroban — the output must be a C-compatible dynamic library (WASM module).

`opt-level = "z"` prioritizes binary size over speed, which reduces upload cost and execution fees on-chain.

---

## Deployment Script Walkthrough

→ Full prerequisites, step-by-step guide, and troubleshooting: [deployment.md](deployment.md)

`contracts/deploy.sh` performs the complete deployment lifecycle:

### Step 1 — Build

```bash
stellar contract build
```

Compiles `lib.rs` to `target/wasm32-unknown-unknown/release/poll_contract.wasm` using the Soroban-optimized build pipeline.

### Step 2 — Identity

```bash
stellar keys generate --global deployer --network testnet
DEPLOYER=$(stellar keys address deployer)
```

Generates a local keypair named `deployer` (stored in `~/.config/stellar/identity/deployer.toml`). The `--global` flag means it persists across directories.

### Step 3 — Fund

```bash
curl -s "https://friendbot.stellar.org?addr=$DEPLOYER"
```

Requests testnet XLM from the Stellar Friendbot (testnet faucet). This creates the account on-chain and funds it with 10,000 test XLM.

### Step 4 — Upload WASM

```bash
WASM_HASH=$(stellar contract upload --network testnet --source deployer --wasm "$WASM")
```

Uploads the WASM binary to Stellar's ledger. The hash identifies the bytecode. Uploading once means the same bytecode can be deployed multiple times without re-uploading.

### Step 5 — Deploy

```bash
CONTRACT_ID=$(stellar contract deploy --network testnet --source deployer --wasm-hash "$WASM_HASH")
```

Creates a contract instance from the uploaded WASM. Returns the Contract ID (starts with `C`).

### Step 6 — Initialize

```bash
stellar contract invoke --network testnet --source deployer --id "$CONTRACT_ID" \
  -- initialize \
  --question "What is the best use case for Stellar?" \
  --options '["DeFi & DEX Trading","Cross-border Payments","NFT Marketplace","Micropayments & Remittances"]'
```

Calls `initialize()` to seed the poll with a question and four options.

---

## Event Schema

The `vote` event emitted by the contract:

```
Topic: (Symbol("vote"),)
Data:  (Address voter, u32 option_index, u32 new_vote_count)
```

Consumers can subscribe to this event via:
- Stellar SDK's EventSource streaming (from Horizon)
- A custom Soroban event indexer
- The `server.getEvents()` RPC method

The frontend does not currently consume events — it polls state instead. Events are available for future off-chain indexing.

---

## Limitations & Extension Points

| Current limitation | Extension approach |
|---|---|
| Single poll per contract | Deploy multiple contract instances, or add a `poll_id` dimension to storage keys |
| Testnet only | Change `Networks.TESTNET` → `Networks.PUBLIC` and redeploy |
| No question update | Remove the `has(&DataKey::Question)` guard and add admin auth |
| Options capped at 8 | Increase the assert upper bound (storage cost increases linearly) |
| No vote retraction | Add `retract_vote()` with inverse storage operations |
| No poll end date | Store an `ExpiryLedger` and check `env.ledger().sequence()` in `vote()` |
