"use client";
import { useWalletKit, WalletError } from "@/hooks/useWalletKit";
import { truncateAddress } from "@/lib/stellar";

function ErrorBanner({ error, onDismiss }: { error: WalletError; onDismiss: () => void }) {
  const colors: Record<WalletError["type"], string> = {
    NOT_FOUND: "bg-amber-900/40 border-amber-500/50 text-amber-200",
    REJECTED: "bg-red-900/40 border-red-500/50 text-red-200",
    INSUFFICIENT_BALANCE: "bg-orange-900/40 border-orange-500/50 text-orange-200",
    GENERIC: "bg-zinc-800 border-zinc-600 text-zinc-200",
  };
  const labels: Record<WalletError["type"], string> = {
    NOT_FOUND: "Wallet Not Found",
    REJECTED: "Connection Rejected",
    INSUFFICIENT_BALANCE: "Insufficient Balance",
    GENERIC: "Error",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${colors[error.type]}`}>
      <span className="text-lg mt-0.5">
        {error.type === "NOT_FOUND" ? "🔍" : error.type === "REJECTED" ? "🚫" : error.type === "INSUFFICIENT_BALANCE" ? "💸" : "⚠️"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{labels[error.type]}</p>
        <p className="text-sm opacity-80 mt-0.5">{error.message}</p>
        {error.type === "NOT_FOUND" && (
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noreferrer"
            className="text-xs underline opacity-70 hover:opacity-100 mt-1 inline-block"
          >
            Install Freighter →
          </a>
        )}
      </div>
      <button onClick={onDismiss} className="text-lg opacity-50 hover:opacity-100 shrink-0">×</button>
    </div>
  );
}

export function WalletPanel() {
  const { address, balance, connecting, error, connect, disconnect, clearError } = useWalletKit();

  if (address) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 font-mono text-sm">{truncateAddress(address)}</span>
          {balance !== null && (
            <span className="text-emerald-200 text-sm font-medium ml-1">{parseFloat(balance).toFixed(2)} XLM</span>
          )}
        </div>
        <button
          onClick={disconnect}
          className="text-sm px-3 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <ErrorBanner error={error} onDismiss={clearError} />}
      <button
        onClick={connect}
        disabled={connecting}
        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    </div>
  );
}
