"use client";

import { useState, useMemo } from "react";
import { formatEther, parseEther } from "viem";
import { applyFee, SPLIT_FEE_BPS } from "@meridian/shared";
import { useSplit, useMerge } from "@/hooks/useWrite";
import { DitheredButton } from "@/components/DitheredButton.dynamic";

interface SplitMergeStepProps {
  decisionId: bigint;
  proposalId: number;
  creditBalance: bigint;
  yesBalance: bigint;
  noBalance: bigint;
  isOpen: boolean;
}

export function SplitMergeStep({
  decisionId,
  proposalId,
  creditBalance,
  yesBalance,
  noBalance,
  isOpen,
}: SplitMergeStepProps) {
  const [mode, setMode] = useState<"split" | "merge">("split");
  const [amount, setAmount] = useState("");

  const { split, isPending: splitPending, isConfirming: splitConfirming, isSuccess: splitSuccess, error: splitError, reset: splitReset } = useSplit();
  const { merge, isPending: mergePending, isConfirming: mergeConfirming, isSuccess: mergeSuccess, error: mergeError, reset: mergeReset } = useMerge();

  const isPending = splitPending || mergePending;
  const isConfirming = splitConfirming || mergeConfirming;
  const isSuccess = splitSuccess || mergeSuccess;
  const error = splitError || mergeError;

  const parsedAmount = amount ? parseEther(amount) : BigInt(0);
  const hasAmount = parsedAmount > BigInt(0);

  const maxBalance = mode === "split"
    ? creditBalance
    : yesBalance < noBalance ? yesBalance : noBalance; // min(yes, no)

  const exceedsBalance = parsedAmount > maxBalance;

  const feePreview = useMemo(() => {
    if (mode !== "split" || !hasAmount) return null;
    const [effective, fee] = applyFee(parsedAmount, BigInt(SPLIT_FEE_BPS));
    return { effective, fee };
  }, [mode, parsedAmount, hasAmount]);

  function handleSubmit() {
    if (!hasAmount || exceedsBalance) return;
    const pid = BigInt(proposalId);
    if (mode === "split") {
      splitReset();
      split(decisionId, pid, parsedAmount);
    } else {
      mergeReset();
      merge(decisionId, pid, parsedAmount);
    }
    setAmount("");
  }

  function handleMax() {
    if (maxBalance > BigInt(0)) {
      setAmount(formatEther(maxBalance));
    }
  }

  return (
    <div>
      {/* Mode selector */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => { setMode("split"); setAmount(""); splitReset(); mergeReset(); }}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            mode === "split"
              ? "bg-meridian-gold/20 text-meridian-gold"
              : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Split
        </button>
        <button
          onClick={() => { setMode("merge"); setAmount(""); splitReset(); mergeReset(); }}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            mode === "merge"
              ? "bg-meridian-gold/20 text-meridian-gold"
              : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Merge
        </button>
      </div>

      {/* Balance info */}
      <div className="mb-3 text-xs text-neutral-500">
        {mode === "split" ? (
          <span>Credits: <span className="font-mono text-meridian-gold">{Number(formatEther(creditBalance)).toFixed(4)}</span> MON</span>
        ) : (
          <span>
            Mergeable: <span className="font-mono text-neutral-300">{Number(formatEther(maxBalance)).toFixed(4)}</span>
            <span className="ml-1 text-neutral-600">(min of YES/NO)</span>
          </span>
        )}
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">
          Amount ({mode === "split" ? "credits" : "token pairs"})
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="w-full rounded border border-meridian-border bg-meridian-bg px-3 py-2 font-mono text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
          />
          {maxBalance > BigInt(0) && (
            <button
              type="button"
              onClick={handleMax}
              className="rounded bg-neutral-800 px-3 py-2 text-xs font-bold text-neutral-400 transition-colors hover:text-white"
            >
              MAX
            </button>
          )}
        </div>
        {exceedsBalance && (
          <p className="mt-1 text-xs text-no">Exceeds your balance.</p>
        )}
      </div>

      {/* Fee preview (split only) */}
      {mode === "split" && feePreview && !exceedsBalance && (
        <div className="mb-3 rounded bg-meridian-bg px-3 py-2 text-xs text-neutral-400">
          <div className="flex justify-between">
            <span>Fee ({SPLIT_FEE_BPS / 100}%)</span>
            <span className="font-mono text-neutral-200">
              {Number(formatEther(feePreview.fee)).toFixed(6)}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>You receive (YES + NO each)</span>
            <span className="font-mono text-neutral-200">
              {Number(formatEther(feePreview.effective)).toFixed(4)}
            </span>
          </div>
        </div>
      )}

      {/* Merge preview (no fee) */}
      {mode === "merge" && hasAmount && !exceedsBalance && (
        <div className="mb-3 rounded bg-meridian-bg px-3 py-2 text-xs text-neutral-400">
          <div className="flex justify-between">
            <span>Credits returned</span>
            <span className="font-mono text-neutral-200">
              {Number(formatEther(parsedAmount)).toFixed(4)}
            </span>
          </div>
          <div className="mt-1 text-neutral-600">No fee on merge</div>
        </div>
      )}

      {/* Submit */}
      <DitheredButton
        onClick={handleSubmit}
        variant="gold"
        size="lg"
        disabled={!hasAmount || !isOpen || isPending || isConfirming || exceedsBalance}
        className="w-full"
      >
        {isPending
          ? "Signing..."
          : isConfirming
            ? "Confirming..."
            : mode === "split"
              ? "Split into YES + NO"
              : "Merge YES + NO"}
      </DitheredButton>

      {isSuccess && (
        <p className="mt-2 text-center text-xs text-yes">
          {mode === "split" ? "Split" : "Merge"} confirmed.
        </p>
      )}
      {error && (
        <p className="mt-2 text-center text-xs text-no">
          {error.message.slice(0, 80)}
        </p>
      )}
    </div>
  );
}
