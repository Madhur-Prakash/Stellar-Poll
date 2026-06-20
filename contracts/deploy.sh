#!/usr/bin/env bash
# Deploy the StellarPoll contract to testnet
# Prerequisites: stellar-cli, Rust with wasm32-unknown-unknown target
#
# Install stellar-cli:   cargo install --locked stellar-cli --features opt
# Install wasm target:   rustup target add wasm32-unknown-unknown

set -e

NETWORK="testnet"
CONTRACT_DIR="$(dirname "$0")/poll"

echo "==> Building contract..."
cd "$CONTRACT_DIR"
stellar contract build

WASM="target/wasm32-unknown-unknown/release/poll_contract.wasm"

echo "==> Generating/using identity 'deployer'..."
stellar keys generate --global deployer --network $NETWORK 2>/dev/null || true
DEPLOYER=$(stellar keys address deployer)
echo "Deployer address: $DEPLOYER"

echo "==> Funding deployer from testnet friendbot..."
curl -s "https://friendbot.stellar.org?addr=$DEPLOYER" > /dev/null

echo "==> Uploading contract WASM..."
WASM_HASH=$(stellar contract upload \
  --network $NETWORK \
  --source deployer \
  --wasm "$WASM")
echo "WASM hash: $WASM_HASH"

echo "==> Deploying contract..."
CONTRACT_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source deployer \
  --wasm-hash "$WASM_HASH")
echo "Contract ID: $CONTRACT_ID"

echo "==> Initializing poll..."
stellar contract invoke \
  --network $NETWORK \
  --source deployer \
  --id "$CONTRACT_ID" \
  -- initialize \
  --question "What is the best use case for Stellar?" \
  --options '["DeFi & DEX Trading","Cross-border Payments","NFT Marketplace","Micropayments & Remittances"]'

echo ""
echo "✅ Done! Add this to your .env.local:"
echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID"
