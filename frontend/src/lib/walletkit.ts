// StellarWalletsKit v2 uses a static-class pattern (no instantiation)
export { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
export { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";

import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";

let initialized = false;

export function initWalletKit() {
  if (initialized) return;
  StellarWalletsKit.init({
    modules: [new FreighterModule()],
    network: Networks.TESTNET,
    selectedWalletId: FREIGHTER_ID,
  });
  initialized = true;
}
