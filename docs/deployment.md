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
rustup target add wasm32v1-none
```

> **Note:** Newer versions of `stellar-cli` use `wasm32v1-none`, not `wasm32-unknown-unknown`. If you see `error[E0463]: can't find crate for 'std'`, run the command above.

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
Output: `target/wasm32v1-none/release/poll_contract.wasm`

**Step 2 — Create deployer identity:**
```bash
# Do NOT use --global — it causes config path errors on Windows
stellar keys generate deployer --network testnet
stellar keys address deployer
```

**Step 3 — Fund deployer:**
```bash
DEPLOYER=$(stellar keys address deployer)
curl "https://friendbot.stellar.org?addr=$DEPLOYER"
```

**Step 4 — Upload WASM:**
```bash
# Run from: contracts/poll/
WASM_HASH=$(stellar contract upload \
  --network testnet \
  --source deployer \
  --wasm target/wasm32v1-none/release/poll_contract.wasm)
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

**Git Bash / Linux / macOS:**
```bash
stellar contract invoke \
  --network testnet \
  --source deployer \
  --id "$CONTRACT_ID" \
  -- initialize \
  --question "Your question here?" \
  --options '["Option A","Option B","Option C"]'
```

**PowerShell (Windows) — JSON quoting fix:**

PowerShell strips inner double quotes when passing to native executables. Two workarounds:

*Option 1 — No spaces in option names (simplest):*
```powershell
stellar contract invoke --network testnet --source deployer --id YOUR_CONTRACT_ID -- initialize --question "Your question?" --options '["OptionA","OptionB","OptionC"]'
```

*Option 2 — Write JSON to a file first (supports spaces):*
```powershell
'["DeFi & DEX Trading","Cross-border Payments","NFT Marketplace","Micropayments"]' | Out-File -Encoding utf8 options.json

stellar contract invoke --network testnet --source deployer --id YOUR_CONTRACT_ID -- initialize --question "Your question?" --options-file-path options.json
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

### 2. Set the contract ID and simulation source

Edit `frontend/.env`:

```env
NEXT_PUBLIC_CONTRACT_ID=C...your_contract_id_from_deploy...

# Any funded testnet G-address used as simulation source for read-only calls
# Use your deployer address — get it with: stellar keys address deployer
NEXT_PUBLIC_SIMULATED_SOURCE_ADDRESS=G...your_deployer_address...
```

**Why is `NEXT_PUBLIC_SIMULATED_SOURCE_ADDRESS` needed?**
Read-only contract calls (fetching the poll question, options, vote counts) are done via RPC simulation. The simulation needs a valid, funded Stellar account as a "source" to build a transaction structure against. No XLM is actually spent — it's a dry run. Your deployer address works perfectly for this.

**To get your deployer address:**
```bash
stellar keys address deployer
```

**To create a dedicated simulation account (optional, cleaner for Vercel):**
```bash
stellar keys generate sim-source --fund --network testnet
stellar keys address sim-source
```
Use the printed address as `NEXT_PUBLIC_SIMULATED_SOURCE_ADDRESS`.

The `NEXT_PUBLIC_` prefix makes variables available in browser JavaScript (Next.js convention). **Restart the dev server after editing `.env`** — Next.js bakes these values at startup.

For **Vercel deployment**, add both variables in the Vercel dashboard under Settings → Environment Variables.

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

Set both `NEXT_PUBLIC_CONTRACT_ID` and `NEXT_PUBLIC_SIMULATED_SOURCE_ADDRESS` as environment variables in the Vercel dashboard (Settings → Environment Variables).

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
# Run from: contracts/poll/
# If code hasn't changed, upload returns the same hash instantly
WASM_HASH=$(stellar contract upload \
  --network testnet \
  --source deployer \
  --wasm target/wasm32v1-none/release/poll_contract.wasm)

# Deploy new instance
NEW_CONTRACT=$(stellar contract deploy \
  --network testnet \
  --source deployer \
  --wasm-hash "$WASM_HASH")

# Initialize with new question (Git Bash)
stellar contract invoke \
  --network testnet \
  --source deployer \
  --id "$NEW_CONTRACT" \
  -- initialize \
  --question "New question?" \
  --options '["Yes","No","Maybe"]'

echo "New Contract ID: $NEW_CONTRACT"
```

> **PowerShell users:** See the JSON quoting fix in Step 6 above if your options contain spaces.

Update `frontend/.env` with the new `CONTRACT_ID` and restart the frontend.

---

## Troubleshooting

### `stellar: command not found`

Install stellar-cli:
```bash
cargo install --locked stellar-cli --features opt
```
Ensure `~/.cargo/bin` is in your PATH.

### `error[E0463]: can't find crate for 'std'`

The WASM target is missing. Newer `stellar-cli` uses `wasm32v1-none`:
```bash
rustup target add wasm32v1-none
```

> If you previously installed `wasm32-unknown-unknown`, that was for older versions. Add `wasm32v1-none` instead.

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

Check that `frontend/.env` exists and contains:
```
NEXT_PUBLIC_CONTRACT_ID=C...
NEXT_PUBLIC_SIMULATED_SOURCE_ADDRESS=G...
```
**Restart the dev server** after editing `.env` — Next.js bakes `NEXT_PUBLIC_*` values at startup, hot reload does not pick them up.

### `invalid encoded string` when loading poll

The simulation source address is invalid or missing. Check:
1. `NEXT_PUBLIC_SIMULATED_SOURCE_ADDRESS` in `frontend/.env` is a valid 56-character G-address
2. The account is funded on testnet — run `stellar keys fund deployer --network testnet`
3. The dev server was restarted after `.env` was updated

### PowerShell strips quotes from `--options`

When running `stellar contract invoke` with `--options '["A","B"]'` in PowerShell, inner double quotes get stripped, producing invalid JSON.

**Fix:** Use the file approach:
```powershell
'["Option A","Option B"]' | Out-File -Encoding utf8 options.json
stellar contract invoke ... --options-file-path options.json
```
Or use option names without spaces to avoid the quoting issue entirely.

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
