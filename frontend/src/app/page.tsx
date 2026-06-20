"use client";
import { useState, useEffect, useCallback } from "react";
import { WalletPanel } from "@/components/WalletPanel";
import { PollCard } from "@/components/PollCard";
import { VoteForm } from "@/components/VoteForm";
import { ActivityFeed, FeedItem } from "@/components/ActivityFeed";
import { useContractEvents } from "@/hooks/useContractEvents";
import { useWalletKit } from "@/hooks/useWalletKit";
import { hasVoted, getVoterChoice, CONTRACT_ID } from "@/lib/contract";

let feedCounter = 0;

export default function Home() {
  const { address } = useWalletKit();
  const { pollData, loading, error, refresh, lastUpdated } = useContractEvents();
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [voterChoice, setVoterChoice] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const checkVoteStatus = useCallback(async () => {
    if (!address || !pollData) return;
    const [voted, choice] = await Promise.all([
      hasVoted(address),
      getVoterChoice(address),
    ]);
    setAlreadyVoted(voted);
    setVoterChoice(choice);
  }, [address, pollData]);

  useEffect(() => {
    checkVoteStatus();
  }, [checkVoteStatus]);

  const handleVoteSuccess = useCallback(() => {
    refresh();
    checkVoteStatus();
  }, [refresh, checkVoteStatus]);

  const handleVoteCast = useCallback((option: string, txHash: string) => {
    if (!address) return;
    const newItem: FeedItem = {
      id: String(++feedCounter),
      voter: address,
      option,
      txHash,
      timestamp: new Date(),
    };
    setFeed((prev) => [newItem, ...prev.slice(0, 19)]);
  }, [address]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xl font-bold text-white tracking-tight">StellarPoll</span>
            <span className="ml-2 text-xs bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">Testnet</span>
          </div>
          <WalletPanel />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {CONTRACT_ID ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-zinc-500">Contract:</span>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 break-all transition-colors"
            >
              {CONTRACT_ID}
            </a>
          </div>
        ) : (
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-200">
            ⚠️ No contract deployed. Set <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_CONTRACT_ID</code> in <code className="bg-black/30 px-1 rounded">.env.local</code> after deploying.
          </div>
        )}

        {loading && !pollData && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Loading poll data…</p>
          </div>
        )}

        {error && !pollData && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 text-center">
            <p className="text-red-300 text-sm font-medium">Failed to load poll</p>
            <p className="text-red-400/70 text-xs mt-1">{error}</p>
          </div>
        )}

        {pollData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <PollCard
                pollData={pollData}
                voterChoice={voterChoice}
                loading={loading}
                lastUpdated={lastUpdated}
              />
              <VoteForm
                options={pollData.options}
                alreadyVoted={alreadyVoted}
                voterChoice={voterChoice}
                onVoteSuccess={handleVoteSuccess}
                onVoteCast={handleVoteCast}
              />
            </div>

            <div className="space-y-5">
              <ActivityFeed items={feed} totalVotes={pollData.total} />
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Stats</h3>
                <div className="space-y-2">
                  {[
                    ["Total Votes", pollData.total, "text-white"],
                    ["Options", pollData.options.length, "text-white"],
                    ["Network", "Testnet", "text-indigo-300"],
                    ["Your Status", address ? (alreadyVoted ? "Voted ✓" : "Not voted") : "Not connected", alreadyVoted ? "text-emerald-400" : "text-zinc-400"],
                  ].map(([label, value, cls]) => (
                    <div key={String(label)} className="flex justify-between text-sm">
                      <span className="text-zinc-500">{label}</span>
                      <span className={`font-semibold ${cls}`}>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-xs text-zinc-500 mb-2">Need testnet XLM?</p>
                <a
                  href="https://laboratory.stellar.org/account-creator?network=testnet"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
                >
                  Get free testnet XLM →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
