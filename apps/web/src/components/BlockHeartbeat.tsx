"use client";

import { useEvents } from "@/providers/EventProvider";

export function BlockHeartbeat() {
  const { blockNumber } = useEvents();

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-meridian-gold opacity-40" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-meridian-gold" />
      </span>
      <span className="font-mono">
        {blockNumber ? `#${blockNumber.toString()}` : "..."}
      </span>
    </div>
  );
}
