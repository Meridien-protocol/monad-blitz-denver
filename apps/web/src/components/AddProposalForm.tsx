"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useAddProposal } from "@/hooks/useWrite";

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
  const [title, setTitle] = useState("");
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
    if (!title.trim()) return;
    reset();
    addProposal(decisionId, title.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
      <input
        type="text"
        placeholder="Propose an option..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        className="flex-1 rounded border border-meridian-border bg-meridian-bg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
      />
      <button
        type="submit"
        disabled={!title.trim() || isPending || isConfirming}
        className="rounded bg-meridian-gold px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-meridian-gold/90 disabled:bg-meridian-gold/30 disabled:text-black/50"
      >
        {isPending ? "Signing..." : isConfirming ? "Confirming..." : "Add"}
      </button>
      {isSuccess && (
        <span className="self-center text-xs text-yes">Added</span>
      )}
      {error && (
        <span className="self-center text-xs text-no">
          {error.message.slice(0, 60)}
        </span>
      )}
    </form>
  );
}
