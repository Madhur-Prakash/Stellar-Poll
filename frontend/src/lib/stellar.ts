import { Horizon, Networks, TransactionBuilder, BASE_FEE, Operation, Asset, Memo, StrKey } from "@stellar/stellar-sdk";

export const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
export const TESTNET_RPC = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const horizon = new Horizon.Server(TESTNET_HORIZON);

export async function getXLMBalance(publicKey: string): Promise<string> {
  const account = await horizon.loadAccount(publicKey);
  const native = account.balances.find((b) => b.asset_type === "native");
  return native ? parseFloat(native.balance).toFixed(7) : "0.0000000";
}

export async function buildSendXLMTransaction(
  source: string,
  destination: string,
  amount: string,
  memo?: string
): Promise<string> {
  const account = await horizon.loadAccount(source);
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({ destination, asset: Asset.native(), amount })
  );
  if (memo) builder.addMemo(Memo.text(memo));
  return builder.setTimeout(180).build().toXDR();
}

export async function submitToHorizon(signedXDR: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXDR, NETWORK_PASSPHRASE);
  const result = await horizon.submitTransaction(tx as Parameters<typeof horizon.submitTransaction>[0]);
  return result.hash;
}

export function isValidAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export async function getRecentTransactions(publicKey: string, limit = 10) {
  const txs = await horizon.transactions().forAccount(publicKey).limit(limit).order("desc").call();
  return txs.records;
}
