"use client";

import { useState } from "react";
import { useAccount, useBalance as useWalletBalance } from "wagmi";
import { formatEther, parseEther } from "viem";
import { useDeposit, useWithdraw } from "@/hooks/useWrite";
import { DitheredButton } from "@/components/DitheredButton.dynamic";

interface DepositStepProps {
  decisionId: bigint;
  creditBalance: bigint;
  isOpen: boolean;
}

export function DepositStep({ decisionId, creditBalance, isOpen }: DepositStepProps) {
  const { address } = useAccount();
  const { data: walletBalance } = useWalletBalance({ address });
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  const { deposit, isPending: depositPending, isConfirming: depositConfirming, isSuccess: depositSuccess, error: depositError } = useDeposit();
  const { withdraw, isPending: withdrawPending, isConfirming: withdrawConfirming, isSuccess: withdrawSuccess, error: withdrawError } = useWithdraw();

  const isPending = depositPending || withdrawPending;
  const isConfirming = depositConfirming || withdrawConfirming;
  const isSuccess = depositSuccess || withdrawSuccess;
  const error = depositError || withdrawError;
  const parsedAmount = amount ? parseEther(amount) : BigInt(0);
  const hasAmount = parsedAmount > BigInt(0);

  const maxBalance = mode === "deposit"
    ? (walletBalance?.value ?? BigInt(0))
    : creditBalance;
  const exceedsBalance = parsedAmount > maxBalance;

  function handleSubmit() {
    if (!hasAmount || exceedsBalance) return;
    if (mode === "deposit") {
      deposit(decisionId, amount);
    } else {
      withdraw(decisionId, parsedAmount);
    }
    setAmount("");
  }

  function handleMax() {
    if (maxBalance > BigInt(0)) {
      setAmount(formatEther(maxBalance));
    }
  }

  if (!address) {
    return <p className="text-sm text-neutral-500">Connect wallet to deposit.</p>;
  }

  return (
    <div>
      {/* Mode selector */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => { setMode("deposit"); setAmount(""); }}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            mode === "deposit"
              ? "bg-yes/20 text-yes"
              : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => { setMode("withdraw"); setAmount(""); }}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            mode === "withdraw"
              ? "bg-no/20 text-no"
              : "bg-neutral-800 text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">
          Amount (MON)
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

      {/* Balance info */}
      <div className="mb-4 text-xs text-neutral-500">
        {mode === "deposit" ? (
          <span>Wallet: <span className="font-mono text-neutral-300">{walletBalance ? Number(formatEther(walletBalance.value)).toFixed(4) : "0.0000"}</span> MON</span>
        ) : (
          <span>Credits: <span className="font-mono text-meridian-gold">{Number(formatEther(creditBalance)).toFixed(4)}</span> MON</span>
        )}
      </div>

      {/* Submit */}
      <DitheredButton
        onClick={handleSubmit}
        variant={mode === "deposit" ? "gold" : "neutral"}
        size="lg"
        disabled={!hasAmount || !isOpen || isPending || isConfirming || exceedsBalance}
        className="w-full"
      >
        {isPending
          ? "Signing..."
          : isConfirming
            ? "Confirming..."
            : mode === "deposit"
              ? "Deposit MON"
              : "Withdraw MON"}
      </DitheredButton>

      {isSuccess && (
        <p className="mt-2 text-center text-xs text-yes">
          {mode === "deposit" ? "Deposit" : "Withdrawal"} confirmed.
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
