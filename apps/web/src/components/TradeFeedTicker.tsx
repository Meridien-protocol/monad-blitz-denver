"use client";

import { formatEther } from "viem";
import { useEvents } from "@/providers/EventProvider";

export function TradeFeedTicker() {
  const { swaps } = useEvents();

  if (swaps.length === 0) {
    return (
      <div className="text-center text-xs text-neutral-600">
        No recent swaps. Activity will appear here in real-time.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {swaps.slice(0, 10).map((s, i) => {
        const addr = `${s.user.slice(0, 6)}...${s.user.slice(-4)}`;
        const direction = s.yesForNo ? "YES->NO" : "NO->YES";
        const dirClass = s.yesForNo ? "text-yes" : "text-no";
        const amtIn = Number(formatEther(s.amountIn)).toFixed(2);
        const amtOut = Number(formatEther(s.amountOut)).toFixed(2);
        const age = Math.floor((Date.now() - s.timestamp) / 1000);
        const ageStr = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`;

        return (
          <div
            key={`${s.timestamp}-${i}`}
            className="flex items-center gap-2 rounded bg-meridian-bg/50 px-2 py-1 text-xs"
          >
            <span className="font-mono text-neutral-500">{addr}</span>
            <span className={`font-bold ${dirClass}`}>{direction}</span>
            <span className="text-neutral-400">{amtIn}</span>
            <span className="text-neutral-600">-&gt;</span>
            <span className="font-mono text-neutral-300">{amtOut}</span>
            <span className="ml-auto text-neutral-600">{ageStr}</span>
          </div>
        );
      })}
    </div>
  );
}
