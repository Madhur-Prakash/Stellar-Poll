"use client";
import { PollData } from "@/lib/contract";

interface Props {
  pollData: PollData;
  voterChoice: number | null;
  loading?: boolean;
  lastUpdated: Date | null;
}

const OPTION_COLORS = [
  { bar: "bg-indigo-500", border: "border-indigo-500/40", text: "text-indigo-300" },
  { bar: "bg-violet-500", border: "border-violet-500/40", text: "text-violet-300" },
  { bar: "bg-cyan-500", border: "border-cyan-500/40", text: "text-cyan-300" },
  { bar: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-300" },
];

export function PollCard({ pollData, voterChoice, loading, lastUpdated }: Props) {
  const { question, options, votes, total } = pollData;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-indigo-400 uppercase tracking-widest">Live Poll</span>
          <h2 className="text-xl font-bold text-white mt-1">{question}</h2>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white">{total}</p>
          <p className="text-xs text-zinc-500">total votes</p>
        </div>
      </div>

      <div className="space-y-3">
        {options.map((option, i) => {
          const pct = total > 0 ? Math.round((votes[i] / total) * 100) : 0;
          const colors = OPTION_COLORS[i % OPTION_COLORS.length];
          const isChosen = voterChoice === i;

          return (
            <div key={i} className={`rounded-xl border p-3 transition-all ${isChosen ? colors.border + " bg-zinc-800/60" : "border-zinc-800"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isChosen && <span className="text-xs">✓</span>}
                  <span className="text-sm font-medium text-zinc-200">{option}</span>
                </div>
                <span className={`text-sm font-bold ${colors.text}`}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.bar} rounded-full transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-zinc-600 mt-1">{votes[i]} votes</p>
            </div>
          );
        })}
      </div>

      {lastUpdated && (
        <p className="text-xs text-zinc-600 flex items-center gap-1.5">
          {loading && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />}
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
