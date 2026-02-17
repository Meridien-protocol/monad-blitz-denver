"use client";

import { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  WelfareOracleABI,
  WELFARE_ORACLE_ADDRESS,
  BPS,
} from "@meridian/shared";
import { DitheredButton } from "@/components/DitheredButton.dynamic";
import { DitheredCard } from "@/components/DitheredCard";

interface OracleControlPanelProps {
  oracleAddress: string;
  mBaseline: bigint;
  minImprovement: bigint;
  measuringDeadline: number;
}

export function OracleControlPanel({
  oracleAddress,
  mBaseline,
  minImprovement,
  measuringDeadline,
}: OracleControlPanelProps) {
  const [metricInput, setMetricInput] = useState("");

  const oracleContract = {
    address: (oracleAddress || WELFARE_ORACLE_ADDRESS) as `0x${string}`,
    abi: WelfareOracleABI,
  } as const;

  const { data: currentMetric, refetch: refetchMetric } = useReadContract({
    ...oracleContract,
    functionName: "getMetric",
  });

  const { data: lastUpdatedBlock } = useReadContract({
    ...oracleContract,
    functionName: "lastUpdated",
  });

  const queryClient = useQueryClient();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries();
    }
  }, [isSuccess, queryClient]);

  function setMetric(value: bigint) {
    writeContract({
      ...oracleContract,
      functionName: "setMetric",
      args: [value],
    });
  }

  function handleSubmit() {
    const val = parseInt(metricInput, 10);
    if (!isNaN(val) && val >= 0) {
      setMetric(BigInt(val));
    }
  }

  // Calculate the threshold for YES outcome
  const baselineNum = Number(mBaseline);
  const minImpNum = Number(minImprovement);
  const threshold = Math.ceil((baselineNum * (BPS + minImpNum)) / BPS);

  // Quick-set presets
  const presets = [
    { label: "Below threshold", value: threshold - 1, color: "text-no" },
    { label: "Exact threshold", value: threshold, color: "text-meridian-gold" },
    { label: "+10% above baseline", value: Math.ceil(baselineNum * 1.1), color: "text-yes" },
    { label: "+25% above baseline", value: Math.ceil(baselineNum * 1.25), color: "text-yes" },
  ];

  return (
    <DitheredCard variant="amber" innerClassName="bg-amber-500/5 p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-amber-400">
        Oracle Control Panel
      </h2>
      <p className="mb-4 text-xs text-neutral-500">
        Admin only -- set the welfare oracle metric to control Mode B outcome.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-neutral-500">Current metric:</span>{" "}
          <span className="font-mono text-neutral-200">
            {currentMetric !== undefined ? currentMetric.toString() : "..."}
          </span>
        </div>
        <div>
          <span className="text-neutral-500">Baseline:</span>{" "}
          <span className="font-mono text-neutral-200">{mBaseline.toString()}</span>
        </div>
        <div>
          <span className="text-neutral-500">Min improvement:</span>{" "}
          <span className="font-mono text-neutral-200">{minImpNum / 100}%</span>
        </div>
        <div>
          <span className="text-neutral-500">YES threshold:</span>{" "}
          <span className="font-mono text-yes">{">="} {threshold}</span>
        </div>
        <div>
          <span className="text-neutral-500">Last updated:</span>{" "}
          <span className="font-mono text-neutral-200">
            {lastUpdatedBlock !== undefined ? `block ${lastUpdatedBlock.toString()}` : "..."}
          </span>
        </div>
        <div>
          <span className="text-neutral-500">Measuring deadline:</span>{" "}
          <span className="font-mono text-neutral-200">block {measuringDeadline}</span>
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">Quick set:</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setMetricInput(p.value.toString());
                setMetric(BigInt(p.value));
              }}
              disabled={isPending || isConfirming}
              className={`rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium ${p.color} transition-colors hover:border-neutral-600 disabled:opacity-40`}
            >
              {p.label} ({p.value})
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          value={metricInput}
          onChange={(e) => setMetricInput(e.target.value)}
          placeholder="Custom metric value"
          className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
        />
        <DitheredButton
          onClick={handleSubmit}
          variant="gold"
          size="md"
          disabled={isPending || isConfirming || !metricInput}
        >
          {isPending ? "Signing..." : isConfirming ? "Confirming..." : isSuccess ? "Set" : "Set Metric"}
        </DitheredButton>
        <button
          onClick={() => refetchMetric()}
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-400 transition-colors hover:border-neutral-600"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-no">{error.message.slice(0, 100)}</p>
      )}

      {isSuccess && (
        <p className="mt-2 text-xs text-yes">
          Metric updated.
        </p>
      )}
    </DitheredCard>
  );
}
