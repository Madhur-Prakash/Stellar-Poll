#!/usr/bin/env bash
# Deploy the StellarPoll contract to testnet
#
# Prerequisites:
#   cargo install --locked stellar-cli --features opt
#   rustup target add wasm32v1-none
#
# Run from: stellar_poll/ (repo root)
#   bash contracts/deploy.sh

set -e

NETWORK="testnet"
REPO_ROOT="$(dirname "$0")/.."
CONTRACT_DIR="$(dirname "$0")/poll"

# ── Step 1: Build ────────────────────────────────────────────────────────────
echo "==> Building contract..."
cd "$CONTRACT_DIR"
stellar contract build

WASM="target/wasm32v1-none/release/poll_contract.wasm"

if [ ! -f "$WASM" ]; then
  echo "❌ WASM file not found at $WASM — build may have failed"
  exit 1
fi

# ── Step 2: Identity ─────────────────────────────────────────────────────────
echo "==> Generating identity 'deployer'..."
# Note: no --global flag — avoids config path errors on Windows
stellar keys generate deployer --network $NETWORK 2>/dev/null || true

DEPLOYER=$(stellar keys address deployer)
if [ -z "$DEPLOYER" ]; then
  echo "❌ Could not get deployer address. Run manually:"
  echo "   stellar keys generate deployer --network testnet"
  exit 1
fi
echo "Deployer address: $DEPLOYER"

# ── Step 3: Fund ─────────────────────────────────────────────────────────────
echo "==> Funding deployer from testnet friendbot..."
curl -s "https://friendbot.stellar.org?addr=$DEPLOYER" > /dev/null
echo "Funded."

# ── Step 4: Upload WASM ──────────────────────────────────────────────────────
echo "==> Uploading contract WASM..."
WASM_HASH=$(stellar contract upload \
  --network $NETWORK \
  --source deployer \
  --wasm "$WASM")
echo "WASM hash: $WASM_HASH"

# ── Step 5: Deploy ───────────────────────────────────────────────────────────
echo "==> Deploying contract..."
CONTRACT_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source deployer \
  --wasm-hash "$WASM_HASH")
echo "Contract ID: $CONTRACT_ID"

# ── Step 6: Initialize poll ──────────────────────────────────────────────────
echo "==> Initializing poll..."
stellar contract invoke \
  --network $NETWORK \
  --source deployer \
  --id "$CONTRACT_ID" \
  -- initialize \
  --question "What is the best use case for Stellar?" \
  --options '["DeFi & DEX Trading","Cross-border Payments","NFT Marketplace","Micropayments & Remittances"]'

echo ""
echo "✅ Done! Update frontend/.env with:"
echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID"
