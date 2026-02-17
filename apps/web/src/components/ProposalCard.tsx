"use client";

import Link from "next/link";
import { formatEther } from "viem";
import { welfare } from "@meridian/shared";
import { WelfareBar } from "@/components/WelfareBar";

interface ProposalCardProps {
  decisionId: bigint;
  proposalId: number;
  title: string;
  yesReserve: bigint;
  noReserve: bigint;
  totalVolume: bigint;
}

export function ProposalCard({
  decisionId,
  proposalId,
  title,
  yesReserve,
  noReserve,
  totalVolume,
}: ProposalCardProps) {
  const w =
    yesReserve + noReserve > BigInt(0)
      ? Number(welfare(yesReserve, noReserve))
      : 5000;

  const volume = formatEther(totalVolume);

  return (
    <Link
      href={`/decisions/${decisionId.toString()}/proposals/${proposalId}`}
      className="animate-fade-up group block rounded-lg border border-meridian-border bg-meridian-surface p-4 transition-colors hover:border-meridian-gold/30"
    >
      <h3 className="mb-3 text-sm font-medium text-neutral-200 group-hover:text-white">
        {title}
      </h3>
      <WelfareBar welfare={w} size="sm" />
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>Proposal #{proposalId}</span>
        <span>{parseFloat(volume).toLocaleString()} vMON volume</span>
      </div>
    </Link>
  );
}
