"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useWatchContractEvent, useBlockNumber } from "wagmi";
import { formatEther } from "viem";
import { MeridianCoreABI, MERIDIAN_CORE_ADDRESS } from "@meridian/shared";

export interface TradeEvent {
  user: string;
  decisionId: bigint;
  proposalId: bigint;
  isYes: boolean;
  amountIn: bigint;
  amountOut: bigint;
  newWelfare: bigint;
  timestamp: number;
}

interface EventContextValue {
  trades: TradeEvent[];
  blockNumber: bigint | undefined;
}

const EventContext = createContext<EventContextValue>({
  trades: [],
  blockNumber: undefined,
});

export function useEvents() {
  return useContext(EventContext);
}

const MAX_TRADES = 50;

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const onTrade = useCallback((logs: unknown[]) => {
    const newTrades: TradeEvent[] = [];
    for (const log of logs) {
      const l = log as { args: { user: string; decisionId: bigint; proposalId: bigint; isYes: boolean; amountIn: bigint; amountOut: bigint; newWelfare: bigint } };
      if (!l.args) continue;
      newTrades.push({
        user: l.args.user,
        decisionId: l.args.decisionId,
        proposalId: l.args.proposalId,
        isYes: l.args.isYes,
        amountIn: l.args.amountIn,
        amountOut: l.args.amountOut,
        newWelfare: l.args.newWelfare,
        timestamp: Date.now(),
      });
    }
    if (newTrades.length > 0) {
      setTrades((prev) => [...newTrades, ...prev].slice(0, MAX_TRADES));
    }
  }, []);

  useWatchContractEvent({
    address: MERIDIAN_CORE_ADDRESS,
    abi: MeridianCoreABI,
    eventName: "Trade",
    onLogs: onTrade,
  });

  return (
    <EventContext.Provider value={{ trades, blockNumber }}>
      {children}
    </EventContext.Provider>
  );
}
