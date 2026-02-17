"use client";

import { useEvents } from "@/providers/EventProvider";

interface DeadlineProgressProps {
  deadline: bigint;
  createdAtBlock: bigint;
  status: number;
}

export function DeadlineProgress({
  deadline,
  createdAtBlock,
  status,
}: DeadlineProgressProps) {
  const { blockNumber } = useEvents();

  if (status !== 0 || !blockNumber) return null;

  const total = Number(deadline - createdAtBlock);
  const elapsed = Number(blockNumber - createdAtBlock);
  const remaining = Number(deadline - blockNumber);
  const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100;
  const passed = remaining <= 0;

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-neutral-500">
          {passed ? "Deadline passed" : `${remaining.toLocaleString()} blocks remaining`}
        </span>
        <span className="font-mono text-neutral-600">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            passed ? "bg-no" : "bg-meridian-gold"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {passed && (
        <p className="mt-1 text-xs text-no">
          Deadline block {deadline.toString()} has passed. Awaiting finalization.
        </p>
      )}
    </div>
  );
}
