"use client";
import { useState, useCallback } from "react";
import { buildVoteTransaction, submitToRpc, waitForTransaction } from "@/lib/contract";
import { useWalletKit } from "@/hooks/useWalletKit";

interface Props {
  options: string[];
  alreadyVoted: boolean;
  voterChoice: number | null;
  onVoteSuccess: () => void;
  onVoteCast?: (option: string, txHash: string) => void;
}

type TxStatus = "idle" | "building" | "signing" | "submitting" | "confirming" | "success" | "failed";

const STATUS_LABELS: Record<TxStatus, string> = {
  idle: "",
  building: "Building transaction…",
  signing: "Waiting for wallet signature…",
  submitting: "Submitting to network…",
  confirming: "Confirming on-chain…",
  success: "Vote cast successfully!",
  failed: "Transaction failed",
};

export function VoteForm({ options, alreadyVoted, voterChoice, onVoteSuccess, onVoteCast }: Props) {
  const { address, balance, signTransaction, refreshBalance, clearError } = useWalletKit();
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txTimestamp, setTxTimestamp] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const copyHash = useCallback(async () => {
    if (!txHash) return;
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [txHash]);

  const handleVote = async () => {
    if (selected === null || !address) return;

    // Check balance (3rd error type: insufficient balance)
    if (balance !== null && parseFloat(balance) < 0.1) {
      setErrorMsg("Insufficient balance. You need at least 0.1 XLM to vote (for transaction fees).");
      return;
    }

    setErrorMsg(null);
    setTxHash(null);
    clearError();

    try {
      setStatus("building");
      const xdr = await buildVoteTransaction(address, selected);

      setStatus("signing");
      const signedXdr = await signTransaction(xdr);

      setStatus("submitting");
      const hash = await submitToRpc(signedXdr);
      setTxHash(hash);

      setStatus("confirming");
      const result = await waitForTransaction(hash);

      if (result === "SUCCESS") {
        setStatus("success");
        setTxTimestamp(new Date());
        refreshBalance();
        onVoteCast?.(options[selected!] ?? "Unknown", hash);
        onVoteSuccess();
      } else {
        setStatus("failed");
        setErrorMsg("Transaction was submitted but failed on-chain.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "REJECTED") {
        setStatus("idle");
        setErrorMsg("Transaction was rejected by the wallet.");
      } else if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("underfunded")) {
        setStatus("idle");
        setErrorMsg("Insufficient XLM balance to cover transaction fees.");
      } else {
        setStatus("failed");
        setErrorMsg(msg || "An unexpected error occurred.");
      }
    }
  };

  if (alreadyVoted) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-2">
        <p className="text-2xl">✅</p>
        <p className="text-white font-semibold">You already voted!</p>
        {voterChoice !== null && (
          <p className="text-zinc-400 text-sm">Your choice: <span className="text-indigo-300 font-medium">{options[voterChoice]}</span></p>
        )}
      </div>
    );
  }

  if (!address) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-zinc-500 text-sm">Connect your wallet to vote</p>
      </div>
    );
  }

  const isProcessing = ["building", "signing", "submitting", "confirming"].includes(status);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <h3 className="text-white font-semibold">Cast Your Vote</h3>

      <div className="space-y-2">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => !isProcessing && setSelected(i)}
            disabled={isProcessing}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              selected === i
                ? "border-indigo-500 bg-indigo-900/30 text-indigo-200"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="inline-block w-5 h-5 rounded-full border mr-2 align-middle transition-all
              border-current text-center leading-5 text-xs">
              {selected === i ? "●" : "○"}
            </span>
            {opt}
          </button>
        ))}
      </div>

      {/* Success receipt */}
      {status === "success" && txHash && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-500/20 flex items-center gap-2">
            <span className="text-emerald-400 text-base">✅</span>
            <span className="text-emerald-300 font-semibold text-sm">Vote Cast Successfully</span>
            {txTimestamp && (
              <span className="ml-auto text-emerald-600 text-xs">{txTimestamp.toLocaleTimeString()}</span>
            )}
          </div>
          <div className="px-4 py-3 space-y-3 text-xs">
            {selected !== null && (
              <div className="flex justify-between items-center">
                <span className="text-emerald-600 uppercase tracking-wide font-medium">Voted for</span>
                <span className="text-white font-semibold">{options[selected]}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-emerald-600 uppercase tracking-wide font-medium">Network</span>
              <span className="text-indigo-300">Stellar Testnet</span>
            </div>
            <div>
              <span className="text-emerald-600 uppercase tracking-wide font-medium block mb-1">Transaction Hash</span>
              <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                <span className="text-emerald-200 font-mono break-all flex-1">{txHash}</span>
                <button
                  onClick={copyHash}
                  className="text-emerald-500 hover:text-emerald-300 shrink-0 transition-colors"
                  title="Copy hash"
                >
                  {copied ? "✓" : "⎘"}
                </button>
              </div>
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors font-medium"
            >
              View on Stellar.Expert ↗
            </a>
          </div>
        </div>
      )}

      {/* In-progress / failed status */}
      {status !== "idle" && status !== "success" && (
        <div className={`rounded-xl p-4 border text-sm ${
          status === "failed"
            ? "bg-red-900/30 border-red-500/40 text-red-200"
            : "bg-indigo-900/20 border-indigo-500/30 text-indigo-200"
        }`}>
          <div className="flex items-center gap-2">
            {isProcessing && (
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            <span className="font-medium">{STATUS_LABELS[status]}</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-900/30 border border-red-500/40 text-red-200 rounded-xl px-4 py-3 text-sm">
          {errorMsg}
        </div>
      )}

      <button
        onClick={handleVote}
        disabled={selected === null || isProcessing || status === "success"}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
      >
        {isProcessing ? STATUS_LABELS[status] : "Submit Vote"}
      </button>
    </div>
  );
}
