"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useWatchContractEvent, useBlockNumber } from "wagmi";
import { MeridianCoreABI, MERIDIAN_CORE_ADDRESS } from "@meridian/shared";

export interface SwapEvent {
  user: string;
  decisionId: bigint;
  proposalId: bigint;
  yesForNo: boolean;
  amountIn: bigint;
  amountOut: bigint;
  newYesPrice: bigint;
  timestamp: number;
}

interface EventContextValue {
  swaps: SwapEvent[];
  blockNumber: bigint | undefined;
}

const EventContext = createContext<EventContextValue>({
  swaps: [],
  blockNumber: undefined,
});

export function useEvents() {
  return useContext(EventContext);
}

const MAX_SWAPS = 50;

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [swaps, setSwaps] = useState<SwapEvent[]>([]);
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const onSwap = useCallback((logs: unknown[]) => {
    const newSwaps: SwapEvent[] = [];
    for (const log of logs) {
      const l = log as { args: { user: string; decisionId: bigint; proposalId: bigint; yesForNo: boolean; amountIn: bigint; amountOut: bigint; newYesPrice: bigint } };
      if (!l.args) continue;
      newSwaps.push({
        user: l.args.user,
        decisionId: l.args.decisionId,
        proposalId: l.args.proposalId,
        yesForNo: l.args.yesForNo,
        amountIn: l.args.amountIn,
        amountOut: l.args.amountOut,
        newYesPrice: l.args.newYesPrice,
        timestamp: Date.now(),
      });
    }
    if (newSwaps.length > 0) {
      setSwaps((prev) => [...newSwaps, ...prev].slice(0, MAX_SWAPS));
    }
  }, []);

  useWatchContractEvent({
    address: MERIDIAN_CORE_ADDRESS,
    abi: MeridianCoreABI,
    eventName: "Swapped",
    onLogs: onSwap,
  });

  return (
    <EventContext.Provider value={{ swaps, blockNumber }}>
      {children}
    </EventContext.Provider>
  );
}
