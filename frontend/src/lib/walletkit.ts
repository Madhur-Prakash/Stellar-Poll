export { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
export { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
export { AlbedoModule, ALBEDO_ID } from "@creit.tech/stellar-wallets-kit/modules/albedo";
export { xBullModule, XBULL_ID } from "@creit.tech/stellar-wallets-kit/modules/xbull";
export { LobstrModule, LOBSTR_ID } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
export { RabetModule, RABET_ID } from "@creit.tech/stellar-wallets-kit/modules/rabet";

import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";

let initialized = false;

export function initWalletKit() {
  if (initialized) return;
  StellarWalletsKit.init({
    modules: [
      new FreighterModule(),
      new AlbedoModule(),
      new xBullModule(),
      new LobstrModule(),
      new RabetModule(),
    ],
    network: Networks.TESTNET,
    selectedWalletId: FREIGHTER_ID,
  });
  initialized = true;
}
