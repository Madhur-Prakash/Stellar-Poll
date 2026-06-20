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
  - [1. Clone the repository](#1-clone-the-repository)
  - [2. Deploy the Soroban contract](#2-deploy-the-soroban-contract)
  - [3. Configure environment](#3-configure-environment)
  - [4. Run the frontend](#4-run-the-frontend)
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
    ├── .env.local.example
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

### For running the frontend only

- **Node.js** 18 or later
- **Freighter wallet** browser extension — [freighter.app](https://freighter.app)
- **Testnet XLM** — [Stellar Laboratory Faucet](https://laboratory.stellar.org/account-creator?network=testnet)
- A deployed contract ID (see below, or use a friend's)

### For deploying the contract

- **Rust** toolchain — [rustup.rs](https://rustup.rs)
- **WASM target** — `rustup target add wasm32-unknown-unknown`
- **stellar-cli** — `cargo install --locked stellar-cli --features opt`

---

## Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd stellar_poll
```

### 2. Deploy the Soroban contract

> Skip this step if you already have a deployed contract ID.

```bash
# Install stellar-cli (once)
cargo install --locked stellar-cli --features opt

# Add WASM compilation target (once)
rustup target add wasm32-unknown-unknown

# Build, deploy, and initialize the poll contract
bash contracts/deploy.sh
```

The script will:
1. Compile the Rust contract to WASM
2. Generate a `deployer` keypair and fund it from the testnet friendbot
3. Upload the WASM bytecode to the network
4. Deploy the contract and get a Contract ID
5. Call `initialize()` with a default question and four options
6. Print the `CONTRACT_ID` — copy it

### 3. Configure environment

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ID=C...your_contract_id_here...
```

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Connect Freighter, fund your testnet wallet from the faucet if needed, pick an option, and submit your vote.

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

```bash
# Frontend (from frontend/)
npm run dev        # Start development server with Turbopack
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint

# Contract (from repo root)
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
