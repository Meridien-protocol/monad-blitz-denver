"use client";

import { formatEther } from "viem";
import { yesPrice } from "@meridian/shared";
import { PriceBar } from "@/components/PriceBar";

interface ProposalCardProps {
  decisionId: bigint;
  proposalId: number;
  title: string;
  yesReserve: bigint;
  noReserve: bigint;
  totalVolume: bigint;
  lpProvider: string;
  lpLiquidity: bigint;
  isExpanded?: boolean;
  onClick?: () => void;
}

export function ProposalCard({
  proposalId,
  title,
  yesReserve,
  noReserve,
  totalVolume,
  lpProvider,
  lpLiquidity,
  isExpanded,
  onClick,
}: ProposalCardProps) {
  const price =
    yesReserve + noReserve > BigInt(0)
      ? Number(yesPrice(yesReserve, noReserve))
      : 5000;

  const volume = formatEther(totalVolume);
  const liquidity = formatEther(lpLiquidity);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`animate-fade-up group block w-full rounded-lg border p-4 text-left transition-colors ${
        isExpanded
          ? "border-meridian-gold/40 bg-meridian-surface"
          : "border-meridian-border bg-meridian-surface hover:border-meridian-gold/30"
      }`}
    >
      <h3 className="mb-3 text-sm font-medium text-neutral-200 group-hover:text-white">
        {title}
      </h3>
      <PriceBar yesPrice={price} size="sm" />
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>Proposal #{proposalId}</span>
        <span>{parseFloat(liquidity).toFixed(2)} MON pool</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-600">
        <span>LP: {lpProvider.slice(0, 6)}...{lpProvider.slice(-4)}</span>
        <span>{parseFloat(volume).toLocaleString()} MON vol</span>
      </div>
    </button>
  );
}
