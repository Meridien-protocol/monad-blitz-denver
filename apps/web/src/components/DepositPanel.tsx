"use client";

import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatEther, parseEther } from "viem";
import { useDeposit, useWithdraw } from "@/hooks/useWrite";
import { DitheredButton } from "@/components/DitheredButton.dynamic";
import { DitheredCard } from "@/components/DitheredCard";

interface DepositPanelProps {
  decisionId: bigint;
  userBalance: bigint | undefined;
  status: number;
}

export function DepositPanel({ decisionId, userBalance, status }: DepositPanelProps) {
  const { address } = useAccount();
  const { data: walletBalance } = useBalance({ address });
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  const { deposit, isPending: depositPending, isConfirming: depositConfirming } = useDeposit();
  const { withdraw, isPending: withdrawPending, isConfirming: withdrawConfirming } = useWithdraw();

  const isOpen = status === 0;
  const isPending = depositPending || withdrawPending;
  const isConfirming = depositConfirming || withdrawConfirming;
  const parsedAmount = amount ? parseEther(amount) : BigInt(0);
  const hasAmount = parsedAmount > BigInt(0);

  function handleSubmit() {
    if (!hasAmount) return;
    if (mode === "deposit") {
      deposit(decisionId, amount);
    } else {
      withdraw(decisionId, parsedAmount);
    }
    setAmount("");
  }

  if (!address) return null;

  return (
    <DitheredCard innerClassName="p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
        Deposit / Withdraw
      </h2>

      {userBalance !== undefined && userBalance > BigInt(0) && (
        <div className="mb-4 rounded bg-meridian-bg px-3 py-2 text-sm text-neutral-300">
          Your credits: <span className="font-mono text-meridian-gold">{formatEther(userBalance)} MON</span>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setMode("deposit")}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            mode === "deposit"
              ? "bg-yes/20 text-yes"
              : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setMode("withdraw")}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            mode === "withdraw"
              ? "bg-no/20 text-no"
              : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Withdraw
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="flex-1 rounded border border-meridian-border bg-meridian-bg px-3 py-2 font-mono text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
        />
        <DitheredButton
          onClick={handleSubmit}
          variant="gold"
          size="md"
          disabled={!hasAmount || !isOpen || isPending || isConfirming}
        >
          {isPending ? "Signing..." : isConfirming ? "Confirming..." : mode === "deposit" ? "Deposit" : "Withdraw"}
        </DitheredButton>
      </div>

      {walletBalance && mode === "deposit" && (
        <div className="mt-2 text-xs text-neutral-600">
          Wallet: {Number(formatEther(walletBalance.value)).toFixed(4)} MON
        </div>
      )}
    </DitheredCard>
  );
}
