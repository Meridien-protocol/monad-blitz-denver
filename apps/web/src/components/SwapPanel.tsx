"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatEther, parseEther } from "viem";
import { calcSwapWithFee, TRADE_FEE_BPS } from "@meridian/shared";
import { useSwap } from "@/hooks/useWrite";
import { DitheredButton } from "@/components/DitheredButton.dynamic";
import { DitheredCard } from "@/components/DitheredCard";
import { usePosition } from "@/hooks/useContract";

type Direction = "YES_FOR_NO" | "NO_FOR_YES";

interface SwapPanelProps {
  decisionId: bigint;
  proposalId: number;
  yesReserve: bigint;
  noReserve: bigint;
  status: number;
}

export function SwapPanel({
  decisionId,
  proposalId,
  yesReserve,
  noReserve,
  status,
}: SwapPanelProps) {
  const { address } = useAccount();
  const { data: position } = usePosition(address, decisionId, proposalId);

  const [direction, setDirection] = useState<Direction>("YES_FOR_NO");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);

  const {
    swapYesForNo,
    swapNoForYes,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useSwap();

  const isOpen = status === 0;
  const parsedAmount = amount ? parseEther(amount) : BigInt(0);
  const hasAmount = parsedAmount > BigInt(0);

  const yesBalance = position ? (position[0] as bigint) : BigInt(0);
  const noBalance = position ? (position[1] as bigint) : BigInt(0);
  const currentBalance = direction === "YES_FOR_NO" ? yesBalance : noBalance;

  const estimate = useMemo(() => {
    if (!hasAmount || yesReserve === BigInt(0) || noReserve === BigInt(0)) return BigInt(0);

    if (direction === "YES_FOR_NO") {
      return calcSwapWithFee(yesReserve, noReserve, parsedAmount, BigInt(TRADE_FEE_BPS));
    } else {
      return calcSwapWithFee(noReserve, yesReserve, parsedAmount, BigInt(TRADE_FEE_BPS));
    }
  }, [direction, parsedAmount, yesReserve, noReserve, hasAmount]);

  const minOut = useMemo(() => {
    if (estimate === BigInt(0)) return BigInt(0);
    return (estimate * BigInt(10000 - slippageBps)) / BigInt(10000);
  }, [estimate, slippageBps]);

  function handleSwap() {
    if (!hasAmount || !isOpen) return;
    reset();
    const pid = BigInt(proposalId);
    if (direction === "YES_FOR_NO") {
      swapYesForNo(decisionId, pid, parsedAmount, minOut);
    } else {
      swapNoForYes(decisionId, pid, parsedAmount, minOut);
    }
    setAmount("");
  }

  function handleMax() {
    if (currentBalance > BigInt(0)) {
      setAmount(formatEther(currentBalance));
    }
  }

  if (!address) {
    return (
      <DitheredCard innerClassName="p-6">
        <p className="text-sm text-neutral-500">Connect wallet to swap.</p>
      </DitheredCard>
    );
  }

  const inputToken = direction === "YES_FOR_NO" ? "YES" : "NO";
  const outputToken = direction === "YES_FOR_NO" ? "NO" : "YES";
  const exceedsBalance = parsedAmount > currentBalance;

  return (
    <DitheredCard innerClassName="p-6">
      {/* Direction selector */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => {
            setDirection("YES_FOR_NO");
            setAmount("");
            reset();
          }}
          className={`flex-1 rounded py-2.5 text-sm font-bold transition-colors ${
            direction === "YES_FOR_NO"
              ? "bg-yes text-white"
              : "bg-yes/10 text-yes/60 hover:bg-yes/20"
          }`}
        >
          YES -&gt; NO
        </button>
        <button
          onClick={() => {
            setDirection("NO_FOR_YES");
            setAmount("");
            reset();
          }}
          className={`flex-1 rounded py-2.5 text-sm font-bold transition-colors ${
            direction === "NO_FOR_YES"
              ? "bg-no text-white"
              : "bg-no/10 text-no/60 hover:bg-no/20"
          }`}
        >
          NO -&gt; YES
        </button>
      </div>

      {/* Balance info */}
      <div className="mb-3 flex gap-4 text-xs text-neutral-500">
        <span>
          YES:{" "}
          <span className="font-mono text-yes">
            {Number(formatEther(yesBalance)).toFixed(4)}
          </span>
        </span>
        <span>
          NO:{" "}
          <span className="font-mono text-no">
            {Number(formatEther(noBalance)).toFixed(4)}
          </span>
        </span>
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">
          Amount ({inputToken} tokens)
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
          {currentBalance > BigInt(0) && (
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

      {/* Estimate */}
      {hasAmount && estimate > BigInt(0) && !exceedsBalance && (
        <div className="mb-3 rounded bg-meridian-bg px-3 py-2 text-xs text-neutral-400">
          <div className="flex justify-between">
            <span>Estimated {outputToken} tokens</span>
            <span className="font-mono text-neutral-200">
              {Number(formatEther(estimate)).toFixed(4)}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>
              Min output ({(slippageBps / 100).toFixed(1)}% slippage)
            </span>
            <span className="font-mono text-neutral-200">
              {Number(formatEther(minOut)).toFixed(4)}
            </span>
          </div>
        </div>
      )}

      {/* Slippage */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs text-neutral-600">Slippage:</label>
        {[50, 100, 200].map((bps) => (
          <button
            key={bps}
            onClick={() => setSlippageBps(bps)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              slippageBps === bps
                ? "bg-meridian-gold/20 text-meridian-gold"
                : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {(bps / 100).toFixed(1)}%
          </button>
        ))}
      </div>

      {/* Submit */}
      <DitheredButton
        onClick={handleSwap}
        variant={direction === "YES_FOR_NO" ? "yes" : "no"}
        size="lg"
        disabled={
          !hasAmount ||
          !isOpen ||
          isPending ||
          isConfirming ||
          exceedsBalance
        }
        className="w-full"
      >
        {isPending
          ? "Signing..."
          : isConfirming
            ? "Confirming..."
            : `Swap ${inputToken} for ${outputToken}`}
      </DitheredButton>

      {isSuccess && (
        <p className="mt-2 text-center text-xs text-yes">
          Swap confirmed.
        </p>
      )}
      {error && (
        <p className="mt-2 text-center text-xs text-no">
          {error.message.slice(0, 80)}
        </p>
      )}
    </DitheredCard>
  );
}
