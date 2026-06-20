# Deployment Guide

Complete instructions for deploying the StellarPoll contract and running the frontend.

> **Related:** [Smart Contract — internals](smart-contract.md) · [Architecture — system overview](architecture.md) · [Frontend — component structure](frontend.md) · [API Reference](api-reference.md)

---

## Prerequisites

### Node.js (Frontend)
- Version 18 or later
- Download from [nodejs.org](https://nodejs.org)
- Verify: `node --version`

### Rust toolchain (Contract)
- Install from [rustup.rs](https://rustup.rs)
- Verify: `rustc --version`

### WASM compilation target (Contract)
```bash
rustup target add wasm32-unknown-unknown
```

### stellar-cli (Contract)
```bash
cargo install --locked stellar-cli --features opt
```
Verify: `stellar --version`

### Freighter wallet (Testing)
- Browser extension for Chrome/Firefox: [freighter.app](https://freighter.app)
- Switch Freighter to **Testnet** in its network settings

### Testnet XLM (Testing)
- Get free testnet XLM from the Stellar Faucet:  
  [https://laboratory.stellar.org/account-creator?network=testnet](https://laboratory.stellar.org/account-creator?network=testnet)
- Minimum ~1 XLM needed per account (base reserve), 0.1+ XLM for fees

---

## Contract Deployment

→ What the contract does and why the deploy steps exist: [smart-contract.md — Deployment Script Walkthrough](smart-contract.md#deployment-script-walkthrough)

### Option A — Automated (Recommended)

Run the provided script from the repo root:

```bash
bash contracts/deploy.sh
```

This script does everything:
1. Builds the WASM contract binary
2. Generates a `deployer` keypair (or reuses existing)
3. Funds the deployer from the testnet faucet
4. Uploads the WASM to the network (stores WASM hash)
5. Deploys a contract instance (returns Contract ID)
6. Calls `initialize()` with the default poll question and options
7. Prints the `CONTRACT_ID` you need to copy

**Expected output:**
```
==> Building contract...
==> Generating/using identity 'deployer'...
Deployer address: GABCD...
==> Funding deployer from testnet friendbot...
==> Uploading contract WASM...
WASM hash: abc123...
==> Deploying contract...
Contract ID: CDEF456...
==> Initializing poll...

✅ Done! Add this to your .env.local:
NEXT_PUBLIC_CONTRACT_ID=CDEF456...
```

Copy the line starting with `NEXT_PUBLIC_CONTRACT_ID=` — you'll need it in the next step.

### Option B — Manual Step-by-Step

If you want to customize the question or options, or if the script fails, run the steps manually.

**Step 1 — Build:**
```bash
cd contracts/poll
stellar contract build
```
Output: `target/wasm32-unknown-unknown/release/poll_contract.wasm`

**Step 2 — Create deployer identity:**
```bash
stellar keys generate --global deployer --network testnet
stellar keys address deployer
```

**Step 3 — Fund deployer:**
```bash
DEPLOYER=$(stellar keys address deployer)
curl "https://friendbot.stellar.org?addr=$DEPLOYER"
```

**Step 4 — Upload WASM:**
```bash
WASM_HASH=$(stellar contract upload \
  --network testnet \
  --source deployer \
  --wasm target/wasm32-unknown-unknown/release/poll_contract.wasm)
echo "WASM hash: $WASM_HASH"
```

**Step 5 — Deploy contract:**
```bash
CONTRACT_ID=$(stellar contract deploy \
  --network testnet \
  --source deployer \
  --wasm-hash "$WASM_HASH")
echo "Contract ID: $CONTRACT_ID"
```

**Step 6 — Initialize with your question:**
```bash
stellar contract invoke \
  --network testnet \
  --source deployer \
  --id "$CONTRACT_ID" \
  -- initialize \
  --question "Your question here?" \
  --options '["Option A","Option B","Option C"]'
```

Options must be a JSON array string with 2–8 items.

---

## Frontend Setup

→ Component structure and state management: [frontend.md](frontend.md)

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Set the contract ID

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and paste your contract ID:

```env
NEXT_PUBLIC_CONTRACT_ID=CDEF456...your_contract_id_here...
```

The `NEXT_PUBLIC_` prefix makes this variable available in browser JavaScript (Next.js convention).

### 3. Run development server

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

**With Turbopack** (enabled by default in `next.config.ts`): hot module replacement is extremely fast — most changes rebuild in under 100ms.

### 4. Production build

```bash
npm run build
npm run start
```

Or deploy to Vercel:
```bash
npm install -g vercel
vercel
```

Set `NEXT_PUBLIC_CONTRACT_ID` as an environment variable in the Vercel project settings.

---

## Verifying Deployment

→ Contract read function signatures: [api-reference.md — Read Functions](api-reference.md#read-functions-no-wallet-required)

### Check the contract on Stellar.Expert

Open:
```
https://stellar.expert/explorer/testnet/contract/YOUR_CONTRACT_ID
```

You should see:
- Contract created transaction
- Initialize invocation
- Storage entries (Question, Options, Votes)

### Test read via stellar-cli

```bash
stellar contract invoke \
  --network testnet \
  --source deployer \
  --id YOUR_CONTRACT_ID \
  -- get_question
```

Should return your question string.

```bash
stellar contract invoke \
  --network testnet \
  --source deployer \
  --id YOUR_CONTRACT_ID \
  -- get_all_votes
```

Should return `[0, 0, 0, 0]` (all zeros before any votes).

### Test the frontend

1. Open [http://localhost:3000](http://localhost:3000)
2. The poll question and options should load (poll data box at the top)
3. Connect Freighter (switch Freighter to Testnet first)
4. Select an option, click "Submit Vote"
5. Approve in Freighter popup
6. Status progresses: building → signing → submitting → confirming → success
7. Vote bar for your option increases
8. Activity feed shows your vote with a link to Stellar.Expert

---

## Re-deploying / Updating the Poll

### Option A — Re-initialize the same contract

The current `initialize()` has a "once only" guard. To reset, you'd need to:
1. Modify the contract to add an `admin` key and an `admin_reset()` function
2. Redeploy

### Option B — Deploy a new contract instance

Since the WASM is already uploaded (reuse the hash):

```bash
# Get existing WASM hash
WASM_HASH=$(stellar contract upload \
  --network testnet \
  --source deployer \
  --wasm contracts/poll/target/wasm32-unknown-unknown/release/poll_contract.wasm)

# Deploy new instance
NEW_CONTRACT=$(stellar contract deploy \
  --network testnet \
  --source deployer \
  --wasm-hash "$WASM_HASH")

# Initialize with new question
stellar contract invoke \
  --network testnet \
  --source deployer \
  --id "$NEW_CONTRACT" \
  -- initialize \
  --question "New question?" \
  --options '["Yes","No","Maybe"]'

echo "New Contract ID: $NEW_CONTRACT"
```

Update `.env.local` with the new `CONTRACT_ID` and restart the frontend.

---

## Troubleshooting

### `stellar: command not found`

Install stellar-cli:
```bash
cargo install --locked stellar-cli --features opt
```
Ensure `~/.cargo/bin` is in your PATH.

### `error[E0463]: can't find crate for 'std'`

The Rust target is missing:
```bash
rustup target add wasm32-unknown-unknown
```

### `friendbot error` / `already funded`

The deployer account may already exist. This is fine — the deploy script uses `2>/dev/null || true` to ignore duplicate identity errors.

If the account needs more XLM, request from friendbot directly:
```bash
DEPLOYER=$(stellar keys address deployer)
curl "https://friendbot.stellar.org?addr=$DEPLOYER"
```

### `already initialized` on re-run

If you run `deploy.sh` a second time with the same contract, `initialize()` will panic. The deploy script creates a new contract on each run. If you see this error while testing with stellar-cli, you already called initialize. Deploy a new contract instance.

### `CONTRACT_ID not set` in frontend

Check that `.env.local` exists in `frontend/` (not the repo root) and contains:
```
NEXT_PUBLIC_CONTRACT_ID=C...
```
Restart the dev server after editing `.env.local`.

### Freighter shows wrong network

Open Freighter → Settings → Network → Select **Testnet**. Transactions signed on Mainnet cannot be submitted to Testnet and vice versa (different network passphrases).

### `insufficient balance` error in VoteForm

Your testnet XLM is too low. Get more from the faucet:
- [https://laboratory.stellar.org/account-creator?network=testnet](https://laboratory.stellar.org/account-creator?network=testnet)
- Or use `friendbot`: `curl "https://friendbot.stellar.org?addr=YOUR_ADDRESS"`

### `waitForTransaction` times out

The transaction may still be pending. Check Stellar.Expert with the displayed hash. If the transaction appears there as SUCCESS but the UI shows FAILED, refresh the page — the vote was recorded.

If the transaction doesn't appear after several minutes, it may have been dropped. Retry.

---

## Testnet vs Mainnet

| | Testnet | Mainnet |
|---|---|---|
| RPC | `soroban-testnet.stellar.org` | `mainnet.stellar.validationcloud.io` (or others) |
| Horizon | `horizon-testnet.stellar.org` | `horizon.stellar.org` |
| Network passphrase | `Networks.TESTNET` | `Networks.PUBLIC` |
| Faucet | Friendbot available | No faucet — XLM costs real money |
| Explorer | `stellar.expert/explorer/testnet` | `stellar.expert/explorer/public` |

To deploy to Mainnet:
1. Change `--network testnet` → `--network mainnet` in `deploy.sh`
2. Change `TESTNET_RPC_URL` in `contract.ts`
3. Change `TESTNET_HORIZON` in `stellar.ts`
4. Change `Networks.TESTNET` → `Networks.PUBLIC` everywhere
5. Fund the deployer with real XLM
6. Re-deploy and re-initialize
