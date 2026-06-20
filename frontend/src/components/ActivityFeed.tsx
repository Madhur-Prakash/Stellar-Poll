"use client";
import { truncateAddress } from "@/lib/stellar";

export interface FeedItem {
  id: string;
  voter: string;
  option: string;
  txHash: string;
  timestamp: Date;
}

interface Props {
  items: FeedItem[];
}

export function ActivityFeed({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-zinc-600 text-sm">No votes yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Activity Feed</h3>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <div className="divide-y divide-zinc-800/50 max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="px-6 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors">
            <div className="w-8 h-8 rounded-full bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center text-xs text-indigo-400 shrink-0 font-mono">
              {item.voter.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zinc-300 text-sm">
                <span className="text-indigo-300 font-mono text-xs">{truncateAddress(item.voter)}</span>
                <span className="text-zinc-500"> voted for </span>
                <span className="font-medium text-white">{item.option}</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${item.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-600 hover:text-zinc-400 font-mono transition-colors"
                >
                  {item.txHash.slice(0, 12)}…
                </a>
                <span className="text-zinc-700 text-xs">{item.timestamp.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
