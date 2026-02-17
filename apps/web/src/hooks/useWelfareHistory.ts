"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePublicClient } from "wagmi";
import { MeridianCoreABI, MERIDIAN_CORE_ADDRESS, BPS } from "@meridian/shared";
import { useEvents } from "@/providers/EventProvider";

export type Timeframe = "1H" | "6H" | "1D" | "ALL";

export interface WelfarePoint {
  timestamp: number;
  welfare: number;
}

const TIMEFRAME_SECONDS: Record<Timeframe, number | null> = {
  "1H": 3600,
  "6H": 21600,
  "1D": 86400,
  ALL: null,
};

export function useWelfareHistory(
  decisionId: bigint,
  proposalId: number,
  timeframe: Timeframe,
) {
  const client = usePublicClient();
  const { trades } = useEvents();
  const [historicalData, setHistoricalData] = useState<WelfarePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!client) return;

    try {
      setIsLoading(true);
      setError(null);

      const logs = await client.getLogs({
        address: MERIDIAN_CORE_ADDRESS,
        event: {
          type: "event",
          name: "Trade",
          inputs: [
            { name: "user", type: "address", indexed: true },
            { name: "decisionId", type: "uint256", indexed: true },
            { name: "proposalId", type: "uint256", indexed: true },
            { name: "isYes", type: "bool", indexed: false },
            { name: "amountIn", type: "uint256", indexed: false },
            { name: "amountOut", type: "uint256", indexed: false },
            { name: "newWelfare", type: "uint256", indexed: false },
          ],
        },
        args: {
          decisionId: decisionId,
          proposalId: BigInt(proposalId),
        },
        fromBlock: BigInt(0),
        toBlock: "latest",
      });

      if (logs.length === 0) {
        setHistoricalData([]);
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

      const points: WelfarePoint[] = logs.map((log) => ({
        timestamp:
          blockTimestamps.get(log.blockNumber ?? BigInt(0)) ?? Date.now(),
        welfare:
          (Number(
            (log as unknown as { args: { newWelfare: bigint } }).args
              .newWelfare,
          ) /
            BPS) *
          100,
      }));

      setHistoricalData(points);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch logs"));
    } finally {
      setIsLoading(false);
    }
  }, [client, decisionId, proposalId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const livePoints: WelfarePoint[] = useMemo(() => {
    return trades
      .filter(
        (t) =>
          t.decisionId === decisionId &&
          t.proposalId === BigInt(proposalId),
      )
      .reverse()
      .map((t) => ({
        timestamp: t.timestamp,
        welfare: (Number(t.newWelfare) / BPS) * 100,
      }));
  }, [trades, decisionId, proposalId]);

  const data = useMemo(() => {
    const allPoints = [...historicalData];

    for (const lp of livePoints) {
      const exists = allPoints.some(
        (hp) => Math.abs(hp.timestamp - lp.timestamp) < 1000,
      );
      if (!exists) {
        allPoints.push(lp);
      }
    }

    allPoints.sort((a, b) => a.timestamp - b.timestamp);

    const cutoffSeconds = TIMEFRAME_SECONDS[timeframe];
    if (cutoffSeconds === null) return allPoints;

    const cutoff = Date.now() - cutoffSeconds * 1000;
    return allPoints.filter((p) => p.timestamp >= cutoff);
  }, [historicalData, livePoints, timeframe]);

  return { data, isLoading, error };
}
