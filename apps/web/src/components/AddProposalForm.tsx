"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance } from "wagmi";
import { useAddProposal } from "@/hooks/useWrite";
import { DitheredButton } from "@/components/DitheredButton.dynamic";
import { formatEther } from "viem";

interface AddProposalFormProps {
  decisionId: bigint;
  proposalCount: number;
  maxProposals: number;
}

export function AddProposalForm({
  decisionId,
  proposalCount,
  maxProposals,
}: AddProposalFormProps) {
  const { address } = useAccount();
  const { data: walletBalance } = useBalance({ address });
  const [title, setTitle] = useState("");
  const [liquidity, setLiquidity] = useState("0.1");
  const {
    addProposal,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useAddProposal();

  useEffect(() => {
    if (isSuccess) {
      setTitle("");
      setLiquidity("0.1");
      const timer = setTimeout(() => reset(), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, reset]);

  if (!address) return null;
  if (proposalCount >= maxProposals) {
    return (
      <p className="mt-4 text-xs text-neutral-600">
        Maximum proposals ({maxProposals}) reached.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !liquidity) return;
    reset();
    addProposal(decisionId, title.trim(), liquidity);
  }

  const liqNum = parseFloat(liquidity);
  const insufficientLiquidity = !isNaN(liqNum) && liqNum < 0.1;

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Propose an option..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="flex-1 rounded border border-meridian-border bg-meridian-bg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.1"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value.replace(/[^0-9.]/g, ""))}
            className="w-full rounded border border-meridian-border bg-meridian-bg px-3 py-2 font-mono text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
          />
          <div className="mt-1 flex justify-between text-xs text-neutral-600">
            <span>AMM liquidity (min 0.1 MON)</span>
            {walletBalance && (
              <span>{Number(formatEther(walletBalance.value)).toFixed(4)} MON</span>
            )}
          </div>
          {insufficientLiquidity && (
            <p className="mt-1 text-xs text-no">Minimum 0.1 MON required.</p>
          )}
        </div>
        <DitheredButton
          type="submit"
          variant="gold"
          size="sm"
          disabled={!title.trim() || !liquidity || insufficientLiquidity || isPending || isConfirming}
        >
          {isPending ? "Signing..." : isConfirming ? "Confirming..." : "Add"}
        </DitheredButton>
      </div>
      {isSuccess && (
        <span className="text-xs text-yes">Proposal added</span>
      )}
      {error && (
        <span className="text-xs text-no">
          {error.message.slice(0, 60)}
        </span>
      )}
    </form>
  );
}
