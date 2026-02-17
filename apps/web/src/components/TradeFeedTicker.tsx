"use client";

import { formatEther } from "viem";
import { useEvents } from "@/providers/EventProvider";

export function TradeFeedTicker() {
  const { trades } = useEvents();

  if (trades.length === 0) {
    return (
      <div className="text-center text-xs text-neutral-600">
        No recent trades. Activity will appear here in real-time.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {trades.slice(0, 10).map((t, i) => {
        const addr = `${t.user.slice(0, 6)}...${t.user.slice(-4)}`;
        const side = t.isYes ? "YES" : "NO";
        const sideClass = t.isYes ? "text-yes" : "text-no";
        const amt = Number(formatEther(t.amountIn)).toFixed(2);
        const out = Number(formatEther(t.amountOut)).toFixed(2);
        const age = Math.floor((Date.now() - t.timestamp) / 1000);
        const ageStr = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`;

        return (
          <div
            key={`${t.timestamp}-${i}`}
            className="flex items-center gap-2 rounded bg-meridian-bg/50 px-2 py-1 text-xs"
          >
            <span className="font-mono text-neutral-500">{addr}</span>
            <span className={`font-bold ${sideClass}`}>{side}</span>
            <span className="text-neutral-400">
              {amt} vMON
            </span>
            <span className="text-neutral-600">-&gt;</span>
            <span className="font-mono text-neutral-300">{out}</span>
            <span className="ml-auto text-neutral-600">{ageStr}</span>
          </div>
        );
      })}
    </div>
  );
}
