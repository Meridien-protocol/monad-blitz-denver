"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { calcBuyYes, calcBuyNo, calcSellYes, calcSellNo, FEE_BPS } from "@meridian/shared";
import { useTrade } from "@/hooks/useWrite";
import { DitheredButton } from "@/components/DitheredButton.dynamic";
import { DitheredCard } from "@/components/DitheredCard";
import { useUserDeposit, usePosition } from "@/hooks/useContract";

type Mode = "BUY" | "SELL";
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
  const { data: position } = usePosition(address, decisionId, proposalId);

  const [mode, setMode] = useState<Mode>("BUY");
  const [side, setSide] = useState<Side>("YES");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100);

  const {
    buyYes,
    buyNo,
    sellYes,
    sellNo,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useTrade();

  const isOpen = status === 0;
  const parsedAmount = amount ? parseEther(amount) : BigInt(0);
  const hasAmount = parsedAmount > BigInt(0);

  const yesBalance = position ? position[0] : BigInt(0);
  const noBalance = position ? position[1] : BigInt(0);
  const currentBalance = side === "YES" ? yesBalance : noBalance;

  const estimate = useMemo(() => {
    if (!hasAmount || yesReserve === BigInt(0) || noReserve === BigInt(0)) return BigInt(0);

    if (mode === "BUY") {
      return side === "YES"
        ? calcBuyYes(yesReserve, noReserve, parsedAmount, BigInt(FEE_BPS))
        : calcBuyNo(yesReserve, noReserve, parsedAmount, BigInt(FEE_BPS));
    } else {
      return side === "YES"
        ? calcSellYes(yesReserve, noReserve, parsedAmount)
        : calcSellNo(yesReserve, noReserve, parsedAmount);
    }
  }, [mode, side, parsedAmount, yesReserve, noReserve, hasAmount]);

  const minOut = useMemo(() => {
    if (estimate === BigInt(0)) return BigInt(0);
    return (estimate * BigInt(10000 - slippageBps)) / BigInt(10000);
  }, [estimate, slippageBps]);

  function handleTrade() {
    if (!hasAmount || !isOpen) return;
    reset();
    const pid = BigInt(proposalId);
    if (mode === "BUY") {
      if (side === "YES") {
        buyYes(decisionId, pid, parsedAmount, minOut);
      } else {
        buyNo(decisionId, pid, parsedAmount, minOut);
      }
    } else {
      if (side === "YES") {
        sellYes(decisionId, pid, parsedAmount, minOut);
      } else {
        sellNo(decisionId, pid, parsedAmount, minOut);
      }
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
        <p className="text-sm text-neutral-500">Connect wallet to trade.</p>
      </DitheredCard>
    );
  }

  const isSell = mode === "SELL";
  const inputLabel = isSell ? `Amount (${side} tokens)` : "Amount (vMON)";
  const outputLabel = isSell ? "Estimated vMON return" : `Estimated ${side} tokens`;
  const buttonLabel = isSell ? `Sell ${side}` : `Buy ${side}`;

  const sellExceedsBalance = isSell && parsedAmount > currentBalance;

  return (
    <DitheredCard innerClassName="p-6">
      {/* Mode tabs */}
      <div className="mb-4 flex rounded border border-meridian-border">
        {(["BUY", "SELL"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setAmount("");
              reset();
            }}
            className={`flex-1 py-2 text-sm font-bold transition-colors ${
              mode === m
                ? "bg-meridian-gold/20 text-meridian-gold"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Balance info */}
      {isSell ? (
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
      ) : (
        userDeposit !== undefined && (
          <div className="mb-3 text-xs text-neutral-500">
            Available vMON:{" "}
            <span className="font-mono text-neutral-300">
              {formatEther(userDeposit)}
            </span>
          </div>
        )
      )}

      {/* Side selector */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => {
            setSide("YES");
            setAmount("");
          }}
          className={`flex-1 rounded py-2.5 text-sm font-bold transition-colors ${
            side === "YES"
              ? isSell
                ? "bg-yes/80 text-white"
                : "bg-yes text-white"
              : "bg-yes/10 text-yes/60 hover:bg-yes/20"
          }`}
        >
          {isSell ? "SELL YES" : "BUY YES"}
        </button>
        <button
          onClick={() => {
            setSide("NO");
            setAmount("");
          }}
          className={`flex-1 rounded py-2.5 text-sm font-bold transition-colors ${
            side === "NO"
              ? isSell
                ? "bg-no/80 text-white"
                : "bg-no text-white"
              : "bg-no/10 text-no/60 hover:bg-no/20"
          }`}
        >
          {isSell ? "SELL NO" : "BUY NO"}
        </button>
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">
          {inputLabel}
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
          {isSell && currentBalance > BigInt(0) && (
            <button
              type="button"
              onClick={handleMax}
              className="rounded bg-neutral-800 px-3 py-2 text-xs font-bold text-neutral-400 transition-colors hover:text-white"
            >
              MAX
            </button>
          )}
        </div>
        {sellExceedsBalance && (
          <p className="mt-1 text-xs text-no">Exceeds your balance.</p>
        )}
      </div>

      {/* Estimate */}
      {hasAmount && estimate > BigInt(0) && !sellExceedsBalance && (
        <div className="mb-3 rounded bg-meridian-bg px-3 py-2 text-xs text-neutral-400">
          <div className="flex justify-between">
            <span>{outputLabel}</span>
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
        onClick={handleTrade}
        variant={side === "YES" ? "yes" : "no"}
        size="lg"
        disabled={
          !hasAmount ||
          !isOpen ||
          isPending ||
          isConfirming ||
          sellExceedsBalance
        }
        className="w-full"
      >
        {isPending
          ? "Signing..."
          : isConfirming
            ? "Confirming..."
            : buttonLabel}
      </DitheredButton>

      {isSuccess && (
        <p className="mt-2 text-center text-xs text-yes">
          {isSell ? "Sell" : "Trade"} confirmed.
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
