export { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
export { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
export { AlbedoModule, ALBEDO_ID } from "@creit.tech/stellar-wallets-kit/modules/albedo";
export { xBullModule, XBULL_ID } from "@creit.tech/stellar-wallets-kit/modules/xbull";
export { LobstrModule, LOBSTR_ID } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
export { RabetModule, RABET_ID } from "@creit.tech/stellar-wallets-kit/modules/rabet";
export { HanaModule, HANA_ID } from "@creit.tech/stellar-wallets-kit/modules/hana";
export { BitgetModule, BITGET_WALLET_ID } from "@creit.tech/stellar-wallets-kit/modules/bitget";
export { KleverModule, KLEVER_ID } from "@creit.tech/stellar-wallets-kit/modules/klever";
export { OneKeyModule, ONEKEY_ID } from "@creit.tech/stellar-wallets-kit/modules/onekey";
export { CactusLinkModule, CACTUSLINK_ID } from "@creit.tech/stellar-wallets-kit/modules/cactuslink";
export { HotWalletModule, HOTWALLET_ID } from "@creit.tech/stellar-wallets-kit/modules/hotwallet";

import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";
import { BitgetModule } from "@creit.tech/stellar-wallets-kit/modules/bitget";
import { KleverModule } from "@creit.tech/stellar-wallets-kit/modules/klever";
import { OneKeyModule } from "@creit.tech/stellar-wallets-kit/modules/onekey";
import { CactusLinkModule } from "@creit.tech/stellar-wallets-kit/modules/cactuslink";
import { HotWalletModule } from "@creit.tech/stellar-wallets-kit/modules/hotwallet";

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
      new HanaModule(),
      new BitgetModule(),
      new KleverModule(),
      new OneKeyModule(),
      new CactusLinkModule(),
      new HotWalletModule(),
    ],
    network: Networks.TESTNET,
    selectedWalletId: FREIGHTER_ID,
  });
  initialized = true;
}
