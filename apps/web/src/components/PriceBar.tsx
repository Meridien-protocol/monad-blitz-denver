"use client";

import { BPS } from "@meridian/shared";

interface PriceBarProps {
  yesPrice: number;
  size?: "sm" | "lg";
}

export function PriceBar({ yesPrice, size = "sm" }: PriceBarProps) {
  const pct = Math.min(100, Math.max(0, (yesPrice / BPS) * 100));
  const isLarge = size === "lg";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className={`font-mono font-bold text-yes ${isLarge ? "text-4xl" : "text-lg"}`}
        >
          {pct.toFixed(1)}%
        </span>
        <span
          className={`font-mono text-neutral-500 ${isLarge ? "text-lg" : "text-xs"}`}
        >
          YES
        </span>
      </div>
      <div
        className={`w-full overflow-hidden rounded-full bg-no/20 ${isLarge ? "h-3" : "h-1.5"}`}
      >
        <div
          className="h-full rounded-full bg-yes transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        <span
          className={`font-mono text-neutral-500 ${isLarge ? "text-sm" : "text-xs"}`}
        >
          {pct.toFixed(1)}% YES
        </span>
        <span
          className={`font-mono text-neutral-500 ${isLarge ? "text-sm" : "text-xs"}`}
        >
          {(100 - pct).toFixed(1)}% NO
        </span>
      </div>
    </div>
  );
}
