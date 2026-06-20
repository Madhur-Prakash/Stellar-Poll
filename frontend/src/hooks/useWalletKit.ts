// Re-export from shared context so all consumers share one wallet state instance.
export type { WalletError } from "@/context/WalletContext";
export { useWallet as useWalletKit } from "@/context/WalletContext";
