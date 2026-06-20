# StellarPoll — On-Chain Voting DApp on Stellar Testnet

StellarPoll is a fully decentralized polling application built on Stellar's Soroban smart contract platform. Votes are enforced on-chain — one vote per address, cryptographically guaranteed — with a real-time React frontend that tracks transaction status live.

> **Network:** Stellar Testnet  
> **Contract Runtime:** Soroban (Rust WASM)  
> **Frontend:** Next.js 16 + React 19 + Tailwind CSS v4

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
  - [Step 1 — Clone](#step-1--clone-the-repository)
  - [Step 2 — Install contract tooling](#step-2--install-contract-tooling-one-time-setup)
  - [Step 3 — Deploy contract](#step-3--deploy-the-soroban-contract)
  - [Step 4 — Set contract ID](#step-4--set-the-contract-id)
  - [Step 5 — Run frontend](#step-5--install-dependencies-and-run)
- [Deployed Contract](#deployed-contract)
- [Smart Contract Reference](#smart-contract-reference)
- [Transaction Flow](#transaction-flow)
- [Error Handling](#error-handling)
- [Wallet Support](#wallet-support)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Documentation](#documentation)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| **On-chain voting** | Every vote is a signed Soroban transaction; the contract enforces one vote per address via `require_auth()` |
| **Real-time updates** | Poll data auto-refreshes every 8 seconds from Soroban RPC |
| **Transaction tracking** | Live status: Building → Signing → Submitting → Confirming → Success/Failed |
| **Multi-wallet support** | StellarWalletsKit with Freighter; extensible to LOBSTR, xBull |
| **Activity feed** | Session-scoped live feed of votes with transaction links to Stellar.Expert |
| **Auto-reconnect** | Restores prior wallet session on page reload via localStorage |
| **3 error types handled** | Wallet Not Found, User Rejected, Insufficient Balance |
| **Dark theme UI** | Zinc + indigo accent palette, fully responsive |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                     │
│                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐  │
│   │  WalletPanel │   │   PollCard   │   │  ActivityFeed │  │
│   └──────┬───────┘   └──────┬───────┘   └───────────────┘  │
│          │                  │                               │
│   ┌──────▼───────┐   ┌──────▼───────┐                       │
│   │ useWalletKit │   │useContractEvt│                       │
│   └──────┬───────┘   └──────┬───────┘                       │
│          │                  │                               │
│   ┌──────▼───────────────────▼──────────────────────────┐   │
│   │                    lib/                              │   │
│   │  walletkit.ts   contract.ts     stellar.ts           │   │
│   └──────┬──────────────────┬───────────────┬───────────┘   │
└──────────┼──────────────────┼───────────────┼───────────────┘
           │                  │               │
           ▼                  ▼               ▼
    ┌─────────────┐   ┌──────────────┐ ┌───────────────┐
    │  Freighter  │   │ Soroban RPC  │ │ Horizon API   │
    │  Extension  │   │  (Testnet)   │ │  (Testnet)    │
    └─────────────┘   └──────┬───────┘ └───────────────┘
                             │
                      ┌──────▼───────┐
                      │  PollContract │
                      │  (Soroban,   │
                      │   Rust WASM) │
                      └──────────────┘
```

The frontend is a pure client-side Next.js app — no backend server. All blockchain reads go through Soroban RPC simulation (no wallet needed); all writes require a wallet-signed XDR transaction submitted to the same RPC.

→ Full design theory and layer breakdown: [docs/architecture.md](docs/architecture.md)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | Next.js (App Router) | 16.2.9 |
| **UI Library** | React | 19.2.4 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | v4 |
| **Wallet Integration** | @creit.tech/stellar-wallets-kit | 2.3.0 |
| **Blockchain SDK** | @stellar/stellar-sdk | 13.3.0 |
| **Smart Contract** | Soroban SDK (Rust) | 22.0.0 |
| **Soroban RPC** | soroban-testnet.stellar.org | — |
| **Horizon API** | horizon-testnet.stellar.org | — |
| **Build Tool** | Turbopack (via Next.js) | — |
| **Runtime** | Node.js | 18+ |

---

## Project Structure

```
stellar_poll/
├── README.md
├── LICENSE
│
├── contracts/
│   ├── deploy.sh                  # Full build → upload → deploy → init script
│   └── poll/
│       ├── Cargo.toml             # Soroban SDK v22 dependency
│       └── src/
│           └── lib.rs             # Poll smart contract (130 lines, Rust)
│
├── docs/                          # Full technical documentation
│   ├── architecture.md            # System design and design theory
│   ├── smart-contract.md          # Contract internals, storage model, events
│   ├── frontend.md                # Component tree, hooks, state management
│   ├── transaction-flow.md        # Step-by-step transaction lifecycle
│   ├── api-reference.md           # All exported functions with types
│   ├── deployment.md              # Detailed deployment and troubleshooting
│   └── design-system.md          # UI/UX design decisions
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── .env                    ← set NEXT_PUBLIC_CONTRACT_ID here
    └── src/
        ├── app/
        │   ├── layout.tsx         # Root layout, Geist fonts, metadata
        │   ├── page.tsx           # Main page, state orchestration
        │   └── globals.css        # Tailwind + dark theme variables
        ├── components/
        │   ├── WalletPanel.tsx    # Wallet connect/disconnect, balance
        │   ├── PollCard.tsx       # Question, vote bars, percentages
        │   ├── VoteForm.tsx       # Option selection, tx tracking
        │   └── ActivityFeed.tsx   # Session vote feed
        ├── hooks/
        │   ├── useWalletKit.ts    # Wallet state + Freighter integration
        │   └── useContractEvents.ts # 8s polling for poll data
        └── lib/
            ├── contract.ts        # Soroban RPC read/write calls
            ├── stellar.ts         # Horizon API helpers
            └── walletkit.ts       # StellarWalletsKit initialization
```

---

## Prerequisites

### 1. Node.js 18+

Download and install from [nodejs.org](https://nodejs.org). Verify: `node --version`

### 2. Rust + Cargo (needed to deploy the contract)

**Windows:** Go to [rustup.rs](https://rustup.rs) → download `rustup-init.exe` → run it → press `1` (default install) → wait → **close and reopen your terminal** (PATH must refresh).

**Mac/Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Verify (after reopening terminal): `cargo --version`

### 3. Freighter wallet browser extension

Install from [freighter.app](https://freighter.app). Switch it to **Testnet** in Settings → Network.

### 4. Testnet XLM

Get free testnet XLM from the [Stellar Faucet](https://laboratory.stellar.org/account-creator?network=testnet).

---

## Quick Start

> **Where to run what — at a glance:**
>
> | Step | Directory | Shell |
> |---|---|---|
> | Install Rust / Node | anywhere | any |
> | `rustup target add ...` | anywhere | any |
> | `cargo install stellar-cli` | anywhere | any |
> | `bash contracts/deploy.sh` | `stellar_poll/` (repo root) | **Git Bash** |
> | `npm install` / `npm run dev` | `stellar_poll/frontend/` | any |

---

### Step 1 — Clone the repository

```bash
# Run from: anywhere
git clone https://github.com/Madhur-Prakash/Stellar-Poll
cd stellar_poll
```

---

### Step 2 — Install contract tooling (one-time setup)

Open **any terminal** (PowerShell, cmd, or Git Bash) and run each line:

```bash
# Run from: anywhere — installs the WASM compilation target
rustup target add wasm32-unknown-unknown
```

```bash
# Run from: anywhere — installs the Stellar CLI (takes 5–10 min, compiles from source)
cargo install --locked stellar-cli --features opt
```

Verify: `stellar --version`

---

### Step 3 — Deploy the Soroban contract

> **Windows:** The deploy script is a `.sh` bash file. Use **Git Bash** (installed with Git for Windows), not PowerShell or cmd.

```bash
# Run from: stellar_poll/  (the repo root, NOT the frontend folder)
bash contracts/deploy.sh
```

What the script does:
1. Compiles `contracts/poll/src/lib.rs` → WASM binary
2. Generates a `deployer` keypair and funds it from the testnet friendbot
3. Uploads the WASM to Stellar Testnet
4. Deploys the contract instance → prints a `CONTRACT_ID`
5. Calls `initialize()` with a default poll question and 4 options

At the end you will see:
```
✅ Done! Add this to your .env.local:
NEXT_PUBLIC_CONTRACT_ID=CABC1234...your_real_id...
```

**Copy that contract ID.**

---

### Step 4 — Set the contract ID

Open `frontend/.env` and replace the placeholder with your real contract ID:

```env
# frontend/.env  — edit this file directly
NEXT_PUBLIC_CONTRACT_ID=CABC1234...your_real_id_from_step_3...
```

> The file already exists at `frontend/.env`. Just open it and replace `C...your_contract_id_here...` with the ID printed by the deploy script.

---

### Step 5 — Install dependencies and run

```bash
# Run from: stellar_poll/frontend/
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Connect Freighter (make sure it's on Testnet), get XLM from the faucet if your balance is 0, pick a poll option, and submit your vote.

---

## Deployed Contract

| Field | Value |
|---|---|
| **Network** | Stellar Testnet |
| **Contract ID** | `CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| **Explorer** | [View on Stellar Expert](https://stellar.expert/explorer/testnet) |
| **Default Question** | "What is the best use case for Stellar?" |
| **Default Options** | DeFi & DEX Trading / Cross-border Payments / NFT Marketplace / Micropayments & Remittances |

> Replace the Contract ID above after running `contracts/deploy.sh`.

### Sample vote transaction

`<paste a successful vote transaction hash here>`

Verify at: `https://stellar.expert/explorer/testnet/tx/<hash>`

---

## Smart Contract Reference

→ Full contract deep-dive: [docs/smart-contract.md](docs/smart-contract.md)

**File:** `contracts/poll/src/lib.rs`  
**Language:** Rust, compiled to WASM  
**SDK:** `soroban-sdk = "22.0.0"`

### Data model

```rust
enum DataKey {
    Question,           // String — the poll question (instance storage)
    OptionCount,        // u32   — number of options (instance storage)
    Option(u32),        // String — indexed option text (instance storage)
    Votes(u32),         // u32   — vote count per option (instance storage)
    HasVoted(Address),  // bool  — whether an address has voted (persistent storage)
    VoterChoice(Address), // u32 — which option they chose (persistent storage)
}
```

Instance storage holds shared poll data (question, options, vote counts). Persistent storage holds per-address voter records that survive ledger entry expiration.

### Functions

```
initialize(env, question: String, options: Vec<String>)
  → Panics if already initialized. Requires 2–8 options.

vote(env, voter: Address, option: u32)
  → voter.require_auth()  — wallet must sign
  → Panics "already voted" if the address has voted before
  → Increments Votes(option), sets HasVoted and VoterChoice in persistent storage
  → Publishes "vote" event: (voter, option, new_total)

get_question(env) → String
get_options(env)  → Vec<String>
get_votes(env, option: u32) → u32
get_all_votes(env) → Vec<u32>
has_voted(env, voter: Address) → bool
get_voter_choice(env, voter: Address) → u32  (panics if not voted)
```

---

## Transaction Flow

→ Annotated step-by-step with code: [docs/transaction-flow.md](docs/transaction-flow.md)

```
User clicks "Submit Vote"
         │
         ▼
[1] Balance check (< 0.1 XLM → error, no transaction)
         │
         ▼
[2] buildVoteTransaction()
    - Fetch account sequence number from Soroban RPC
    - Build unsigned TX with vote() call + 180s timeout
    - prepareTransaction() — adds Soroban auth footprint
    - Return XDR string
         │
         ▼
[3] signTransaction(xdr) via StellarWalletsKit
    - Opens Freighter popup
    - User approves → returns signed XDR
    - User cancels → throws REJECTED
         │
         ▼
[4] submitToRpc(signedXDR)
    - Deserialize XDR back to Transaction
    - server.sendTransaction() → returns tx hash
         │
         ▼
[5] waitForTransaction(hash)
    - Polls every 2 seconds, up to 20 retries (40s total)
    - Returns "SUCCESS" or "FAILED"
         │
         ▼
[6] On SUCCESS:
    - Refresh poll data
    - Re-check voter status (hasVoted, getVoterChoice)
    - Append to activity feed
    - Refresh wallet balance
```

---

## Error Handling

→ UI display and UX rationale: [docs/design-system.md](docs/design-system.md)

### Wallet errors (from `useWalletKit`)

| Error Type | Trigger Conditions | UI Behavior |
|---|---|---|
| `NOT_FOUND` | Extension not installed; error message contains "not found", "not installed", "extension"; code -3 | Amber warning banner with Freighter install link |
| `REJECTED` | User closed modal; message contains "closed", "cancel", "reject", "denied"; code -1 | Red banner "Connection rejected by user" |
| `INSUFFICIENT_BALANCE` | Balance check before tx: XLM < 0.1 | Inline red error in VoteForm |
| `GENERIC` | Any other error | Red banner with raw error message |

### Transaction errors (from `VoteForm`)

| Scenario | Behavior |
|---|---|
| `REJECTED` thrown by `signTransaction` | Reset status to idle, show rejection message |
| On-chain `FAILED` status | Show "Transaction was submitted but failed on-chain" |
| Underfunded / insufficient XLM | Inline balance error message |
| Contract `already voted` panic | Surfaces as transaction failure; VoteForm disabled on success |

---

## Wallet Support

StellarWalletsKit is initialized with `FreighterModule` only. To add more wallets, extend `walletkit.ts`:

```typescript
import { FreighterModule, LobstrModule, xBullModule } from "@creit.tech/stellar-wallets-kit";

kit = new StellarWalletsKit({
  network: Networks.TESTNET,
  selectedWalletId: "freighter",
  modules: [new FreighterModule(), new LobstrModule(), new xBullModule()],
});
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CONTRACT_ID` | Yes | The deployed Soroban contract address (starts with `C`) |

All other endpoints (Soroban RPC, Horizon API) are hardcoded constants in `lib/contract.ts` and `lib/stellar.ts` targeting Stellar Testnet.

---

## Scripts

### From `stellar_poll/frontend/`

```bash
npm run dev        # Start development server (Turbopack, hot reload)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
```

### From `stellar_poll/` (repo root) — Git Bash only on Windows

```bash
bash contracts/deploy.sh   # Full contract build + deploy + initialize
```

---

## Documentation

Detailed technical documentation lives in [`docs/`](docs/):

| File | Contents |
|---|---|
| [architecture.md](docs/architecture.md) | System design, design theory, layer responsibilities |
| [smart-contract.md](docs/smart-contract.md) | Contract internals, storage model, event system |
| [frontend.md](docs/frontend.md) | Component tree, hooks, state management patterns |
| [transaction-flow.md](docs/transaction-flow.md) | Full transaction lifecycle with code references |
| [api-reference.md](docs/api-reference.md) | All exported functions with TypeScript signatures |
| [deployment.md](docs/deployment.md) | Step-by-step deployment, troubleshooting, re-deployment |
| [design-system.md](docs/design-system.md) | UI/UX decisions, color system, component patterns |

---

## License

MIT — Madhur Prakash Mangal. See [LICENSE](LICENSE).
