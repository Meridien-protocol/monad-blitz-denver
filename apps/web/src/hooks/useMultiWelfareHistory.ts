"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePublicClient } from "wagmi";
import { MERIDIAN_CORE_ADDRESS, BPS } from "@meridian/shared";
import { useEvents } from "@/providers/EventProvider";

export type Timeframe = "1H" | "6H" | "1D" | "ALL";

export interface MultiWelfarePoint {
  timestamp: number;
  [proposalKey: string]: number;
}

interface RawPoint {
  timestamp: number;
  proposalId: number;
  welfare: number;
}

const TIMEFRAME_SECONDS: Record<Timeframe, number | null> = {
  "1H": 3600,
  "6H": 21600,
  "1D": 86400,
  ALL: null,
};

const TRADE_EVENT = {
  type: "event" as const,
  name: "Trade" as const,
  inputs: [
    { name: "user", type: "address" as const, indexed: true },
    { name: "decisionId", type: "uint256" as const, indexed: true },
    { name: "proposalId", type: "uint256" as const, indexed: true },
    { name: "isYes", type: "bool" as const, indexed: false },
    { name: "amountIn", type: "uint256" as const, indexed: false },
    { name: "amountOut", type: "uint256" as const, indexed: false },
    { name: "newWelfare", type: "uint256" as const, indexed: false },
  ],
};

export function useMultiWelfareHistory(
  decisionId: bigint,
  proposalCount: number,
  proposalNames: string[],
  timeframe: Timeframe,
) {
  const client = usePublicClient();
  const { trades } = useEvents();
  const [rawPoints, setRawPoints] = useState<RawPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!client || proposalCount === 0) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const logs = await client.getLogs({
        address: MERIDIAN_CORE_ADDRESS,
        event: TRADE_EVENT,
        args: { decisionId },
        fromBlock: BigInt(0),
        toBlock: "latest",
      });

      if (logs.length === 0) {
        setRawPoints([]);
        setIsLoading(false);
        return;
      }

      const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber))];
      const blockTimestamps = new Map<bigint, number>();

      const batchSize = 20;
      for (let i = 0; i < uniqueBlocks.length; i += batchSize) {
        const batch = uniqueBlocks.slice(i, i + batchSize);
        const blocks = await Promise.all(
          batch.map((bn) =>
            bn !== null
              ? client.getBlock({ blockNumber: bn })
              : Promise.resolve(null),
          ),
        );
        for (const block of blocks) {
          if (block) {
            blockTimestamps.set(block.number, Number(block.timestamp) * 1000);
          }
        }
      }

      const points: RawPoint[] = logs.map((log) => {
        const args = (log as unknown as { args: { proposalId: bigint; newWelfare: bigint } }).args;
        return {
          timestamp: blockTimestamps.get(log.blockNumber ?? BigInt(0)) ?? Date.now(),
          proposalId: Number(args.proposalId),
          welfare: (Number(args.newWelfare) / BPS) * 100,
        };
      });

      setRawPoints(points);
    } catch {
      setRawPoints([]);
    } finally {
      setIsLoading(false);
    }
  }, [client, decisionId, proposalCount]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const livePoints: RawPoint[] = useMemo(() => {
    return trades
      .filter((t) => t.decisionId === decisionId)
      .reverse()
      .map((t) => ({
        timestamp: t.timestamp,
        proposalId: Number(t.proposalId),
        welfare: (Number(t.newWelfare) / BPS) * 100,
      }));
  }, [trades, decisionId]);

  const data = useMemo(() => {
    const allRaw = [...rawPoints];

    for (const lp of livePoints) {
      const exists = allRaw.some(
        (hp) =>
          hp.proposalId === lp.proposalId &&
          Math.abs(hp.timestamp - lp.timestamp) < 1000,
      );
      if (!exists) {
        allRaw.push(lp);
      }
    }

    allRaw.sort((a, b) => a.timestamp - b.timestamp);

    const cutoffSeconds = TIMEFRAME_SECONDS[timeframe];
    const filtered =
      cutoffSeconds === null
        ? allRaw
        : allRaw.filter((p) => p.timestamp >= Date.now() - cutoffSeconds * 1000);

    if (filtered.length === 0) return [];

    const lastKnown: Record<number, number> = {};
    for (let i = 0; i < proposalCount; i++) {
      lastKnown[i] = 50;
    }

    const merged: MultiWelfarePoint[] = [];

    for (const pt of filtered) {
      lastKnown[pt.proposalId] = pt.welfare;

      const entry: MultiWelfarePoint = { timestamp: pt.timestamp };
      for (let i = 0; i < proposalCount; i++) {
        const key = proposalNames[i] || `Proposal ${i}`;
        entry[key] = lastKnown[i];
      }
      merged.push(entry);
    }

    return merged;
  }, [rawPoints, livePoints, timeframe, proposalCount, proposalNames]);

  return { data, isLoading };
}
