"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { StellarWalletsKit, Networks, initWalletKit } from "@/lib/walletkit";
import { getXLMBalance } from "@/lib/stellar";

export type WalletError =
  | { type: "NOT_FOUND"; message: string }
  | { type: "REJECTED"; message: string }
  | { type: "INSUFFICIENT_BALANCE"; message: string }
  | { type: "GENERIC"; message: string };

interface WalletState {
  address: string | null;
  balance: string | null;
  connecting: boolean;
  error: WalletError | null;
}

function classifyError(err: unknown): WalletError {
  const raw = err as Record<string, unknown>;
  const msg = String(raw?.message ?? err ?? "");
  const code = Number(raw?.code ?? 0);

  if (code === -1 || msg.toLowerCase().includes("closed") || msg.toLowerCase().includes("cancel")) {
    return { type: "REJECTED", message: "Wallet modal closed by user." };
  }
  if (
    msg.toLowerCase().includes("not found") ||
    msg.toLowerCase().includes("not installed") ||
    msg.toLowerCase().includes("extension") ||
    code === -3
  ) {
    return { type: "NOT_FOUND", message: "Wallet extension not found. Please install Freighter." };
  }
  if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("denied")) {
    return { type: "REJECTED", message: "Connection rejected by user." };
  }
  return { type: "GENERIC", message: msg || "An unexpected error occurred." };
}

export function useWalletKit() {
  const [state, setState] = useState<WalletState>({
    address: null,
    balance: null,
    connecting: false,
    error: null,
  });
  const autoConnectDone = useRef(false);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const bal = await getXLMBalance(addr);
      setState((s) => ({ ...s, balance: bal }));
    } catch {
      setState((s) => ({ ...s, balance: null }));
    }
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));
    initWalletKit();
    try {
      const { address } = await StellarWalletsKit.authModal();
      if (!address) throw new Error("NO_ADDRESS");
      localStorage.removeItem("stellar_poll_disconnected");
      await fetchBalance(address);
      setState((s) => ({ ...s, address, connecting: false }));
    } catch (err: unknown) {
      setState((s) => ({ ...s, connecting: false, error: classifyError(err) }));
    }
  }, [fetchBalance]);

  const disconnect = useCallback(async () => {
    try { await StellarWalletsKit.disconnect(); } catch { /* ignore */ }
    localStorage.setItem("stellar_poll_disconnected", "1");
    setState({ address: null, balance: null, connecting: false, error: null });
  }, []);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!state.address) throw new Error("Wallet not connected");
      try {
        const result = await StellarWalletsKit.signTransaction(xdr, {
          networkPassphrase: Networks.TESTNET,
        });
        return result.signedTxXdr;
      } catch (err: unknown) {
        const walletErr = classifyError(err);
        if (walletErr.type === "REJECTED") {
          setState((s) => ({ ...s, error: walletErr }));
          throw new Error("REJECTED");
        }
        throw err;
      }
    },
    [state.address]
  );

  const refreshBalance = useCallback(() => {
    if (state.address) fetchBalance(state.address);
  }, [state.address, fetchBalance]);

  // Auto-reconnect if previously connected
  useEffect(() => {
    if (autoConnectDone.current) return;
    autoConnectDone.current = true;
    if (typeof window === "undefined") return;
    if (localStorage.getItem("stellar_poll_disconnected")) return;
    initWalletKit();
    StellarWalletsKit.getAddress()
      .then(({ address }) => {
        if (address) {
          setState((s) => ({ ...s, address }));
          fetchBalance(address);
        }
      })
      .catch(() => { /* no prior session */ });
  }, [fetchBalance]);

  return { ...state, connect, disconnect, signTransaction, refreshBalance, clearError };
}
