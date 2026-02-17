"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { calcBuyYes, calcBuyNo, FEE_BPS } from "@meridian/shared";
import { useTrade } from "@/hooks/useWrite";
import { useUserDeposit } from "@/hooks/useContract";

type Side = "YES" | "NO";

interface TradePanelProps {
  decisionId: bigint;
  proposalId: number;
  yesReserve: bigint;
  noReserve: bigint;
  status: number;
}

export function TradePanel({
  decisionId,
  proposalId,
  yesReserve,
  noReserve,
  status,
}: TradePanelProps) {
  const { address } = useAccount();
  const { data: userDeposit } = useUserDeposit(address, decisionId);
  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100); // 1% default

  const {
    buyYes,
    buyNo,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useTrade();

  const isOpen = status === 0;
  const parsedAmount = amount ? parseEther(amount) : BigInt(0);
  const hasAmount = parsedAmount > BigInt(0);

  const estimate = useMemo(() => {
    if (!hasAmount || yesReserve === BigInt(0) || noReserve === BigInt(0)) return BigInt(0);
    return side === "YES"
      ? calcBuyYes(yesReserve, noReserve, parsedAmount, BigInt(FEE_BPS))
      : calcBuyNo(yesReserve, noReserve, parsedAmount, BigInt(FEE_BPS));
  }, [side, parsedAmount, yesReserve, noReserve, hasAmount]);

  const minOut = useMemo(() => {
    if (estimate === BigInt(0)) return BigInt(0);
    return (estimate * BigInt(10000 - slippageBps)) / BigInt(10000);
  }, [estimate, slippageBps]);

  function handleTrade() {
    if (!hasAmount || !isOpen) return;
    reset();
    const pid = BigInt(proposalId);
    if (side === "YES") {
      buyYes(decisionId, pid, parsedAmount, minOut);
    } else {
      buyNo(decisionId, pid, parsedAmount, minOut);
    }
    setAmount("");
  }

  if (!address) {
    return (
      <div className="rounded-lg border border-meridian-border bg-meridian-surface p-6">
        <p className="text-sm text-neutral-500">Connect wallet to trade.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-meridian-border bg-meridian-surface p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
        Trade
      </h2>

      {userDeposit !== undefined && (
        <div className="mb-3 text-xs text-neutral-500">
          Available vMON: <span className="font-mono text-neutral-300">{formatEther(userDeposit)}</span>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSide("YES")}
          className={`flex-1 rounded py-2.5 text-sm font-bold transition-colors ${
            side === "YES"
              ? "bg-yes text-white"
              : "bg-yes/10 text-yes/60 hover:bg-yes/20"
          }`}
        >
          BUY YES
        </button>
        <button
          onClick={() => setSide("NO")}
          className={`flex-1 rounded py-2.5 text-sm font-bold transition-colors ${
            side === "NO"
              ? "bg-no text-white"
              : "bg-no/10 text-no/60 hover:bg-no/20"
          }`}
        >
          BUY NO
        </button>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">Amount (vMON)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full rounded border border-meridian-border bg-meridian-bg px-3 py-2 font-mono text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
        />
      </div>

      {hasAmount && estimate > BigInt(0) && (
        <div className="mb-3 rounded bg-meridian-bg px-3 py-2 text-xs text-neutral-400">
          <div className="flex justify-between">
            <span>Estimated {side} tokens</span>
            <span className="font-mono text-neutral-200">
              {Number(formatEther(estimate)).toFixed(4)}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Min output ({(slippageBps / 100).toFixed(1)}% slippage)</span>
            <span className="font-mono text-neutral-200">
              {Number(formatEther(minOut)).toFixed(4)}
            </span>
          </div>
        </div>
      )}

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

      <button
        onClick={handleTrade}
        disabled={!hasAmount || !isOpen || isPending || isConfirming}
        className={`w-full rounded py-3 text-sm font-bold transition-all ${
          side === "YES"
            ? "bg-yes hover:bg-yes/90 disabled:bg-yes/30"
            : "bg-no hover:bg-no/90 disabled:bg-no/30"
        } text-white disabled:text-white/50`}
      >
        {isPending
          ? "Signing..."
          : isConfirming
            ? "Confirming..."
            : `Buy ${side}`}
      </button>

      {isSuccess && (
        <p className="mt-2 text-center text-xs text-yes">Trade confirmed.</p>
      )}
      {error && (
        <p className="mt-2 text-center text-xs text-no">
          {error.message.slice(0, 80)}
        </p>
      )}
    </div>
  );
}
