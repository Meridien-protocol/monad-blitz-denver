"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { ProposalCard } from "@/components/ProposalCard";
import { DeltaDisplay } from "@/components/DeltaDisplay";
import { DepositPanel } from "@/components/DepositPanel";
import { SettlementPanel } from "@/components/SettlementPanel";
import { TradeFeedTicker } from "@/components/TradeFeedTicker";
import { BlockHeartbeat } from "@/components/BlockHeartbeat";
import { AddProposalForm } from "@/components/AddProposalForm";
import { ExpandedProposal } from "@/components/ExpandedProposal";
import { DeadlineProgress } from "@/components/DeadlineProgress";
import { ShareButton } from "@/components/ShareButton";
import { DitheredCard } from "@/components/DitheredCard";
import { useDecision, useProposals, useBalance as useUserBalance, useSettled } from "@/hooks/useContract";
import { yesPrice, MAX_PROPOSALS, DecisionStatus } from "@meridian/shared";

export default function DecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const decisionId = BigInt(id);
  const searchParams = useSearchParams();
  const { address } = useAccount();

  const { data: decision, isLoading: decisionLoading } = useDecision(decisionId);
  const proposalCount = decision ? Number(decision[4]) : 0;
  const { data: proposalsData, isLoading: proposalsLoading } = useProposals(decisionId, proposalCount);
  const { data: userBalance } = useUserBalance(address, decisionId);
  const { data: isSettled } = useSettled(address, decisionId);

  // Expandable proposal state
  const [expandedProposalId, setExpandedProposalId] = useState<number | null>(null);

  // Auto-expand from URL param ?proposal=N
  useEffect(() => {
    const p = searchParams.get("proposal");
    if (p !== null) {
      setExpandedProposalId(Number(p));
    }
  }, [searchParams]);

  const toggleProposal = useCallback((index: number) => {
    setExpandedProposalId((prev) => (prev === index ? null : index));
  }, []);

  if (decisionLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        <div className="animate-pulse text-neutral-500">Loading decision...</div>
      </main>
    );
  }

  if (!decision) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-neutral-500">Decision not found.</p>
      </main>
    );
  }

  // Decision tuple: [creator, title, deadline, createdAtBlock, proposalCount, totalDeposits, totalLPLiquidity, collectedFees, status, winningProposalId]
  const [creator, title, deadline, createdAtBlock, , totalDeposits, totalLPLiquidity, collectedFees, status, winPid] = decision;

  const proposalSummaries =
    proposalsData
      ?.filter((p) => p.status === "success" && p.result)
      .map((p, i) => {
        // getProposal returns: [lpProvider, yesReserve, noReserve, lpLiquidity, totalAllocated, totalVolume, lpRedeemed, title]
        const [, yesR, noR, , , , , pTitle] = p.result!;
        const price = yesR + noR > BigInt(0) ? Number(yesPrice(yesR, noR)) : 5000;
        return { title: pTitle, yesPrice: price, index: i };
      }) ?? [];

  // Find expanded proposal data
  const expandedData =
    expandedProposalId !== null
      ? proposalsData?.find(
          (_, i) => i === expandedProposalId && _.status === "success" && _.result,
        )
      : null;

  const isCreator = address?.toLowerCase() === (creator as string).toLowerCase();

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-4 py-10">
      {/* 1. Back Nav + Share */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to decisions
        </Link>
        <ShareButton />
      </div>

      {/* 2. Hero Header */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <StatusBadge status={status} />
          <span className="text-xs text-neutral-600">Decision #{id}</span>
          <BlockHeartbeat />
        </div>
        <h1 className="font-serif text-4xl font-bold text-white">{title}</h1>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-500">
          <span className="rounded bg-neutral-800/50 px-2 py-0.5">
            Deadline: {deadline.toString()}
          </span>
          <span className="rounded bg-neutral-800/50 px-2 py-0.5">
            Deposits: {formatEther(totalDeposits)} MON
          </span>
          <span className="rounded bg-neutral-800/50 px-2 py-0.5">
            LP Liquidity: {formatEther(totalLPLiquidity)} MON
          </span>
          <span className="rounded bg-neutral-800/50 px-2 py-0.5">
            Creator: {(creator as string).slice(0, 6)}...{(creator as string).slice(-4)}
          </span>
        </div>

        {/* Deadline Progress (OPEN only) */}
        <DeadlineProgress
          deadline={BigInt(deadline.toString())}
          createdAtBlock={BigInt(createdAtBlock.toString())}
          status={status}
        />
      </div>

      {/* 3. Deposit / Withdraw */}
      <div className="mb-6">
        <DepositPanel
          decisionId={decisionId}
          userBalance={userBalance}
          status={status}
        />
      </div>

      {/* 4. DeltaDisplay */}
      {proposalSummaries.length >= 2 && (
        <div className="mb-6">
          <DeltaDisplay proposals={proposalSummaries} />
        </div>
      )}

      {/* 5. Proposals -- Expandable Cards */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-neutral-300">
          Proposals ({proposalCount})
        </h2>
        {proposalsLoading ? (
          <div className="animate-pulse text-neutral-500">Loading proposals...</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {proposalsData?.map((p, i) => {
                if (p.status !== "success" || !p.result) return null;
                // getProposal: [lpProvider, yesReserve, noReserve, lpLiquidity, totalAllocated, totalVolume, lpRedeemed, title]
                const [lpProvider, yesR, noR, lpLiquidity, , totalVol, , pTitle] = p.result;
                return (
                  <ProposalCard
                    key={i}
                    decisionId={decisionId}
                    proposalId={i}
                    title={pTitle as string}
                    yesReserve={yesR as bigint}
                    noReserve={noR as bigint}
                    totalVolume={totalVol as bigint}
                    lpProvider={lpProvider as string}
                    lpLiquidity={lpLiquidity as bigint}
                    isExpanded={expandedProposalId === i}
                    onClick={() => toggleProposal(i)}
                  />
                );
              })}
            </div>

            {/* Expanded Proposal (full width below grid) */}
            {expandedData?.result && expandedProposalId !== null && (
              <ExpandedProposal
                decisionId={decisionId}
                proposalId={expandedProposalId}
                proposalTitle={expandedData.result[7] as string}
                yesReserve={expandedData.result[1] as bigint}
                noReserve={expandedData.result[2] as bigint}
                status={status}
                onClose={() => setExpandedProposalId(null)}
              />
            )}
          </>
        )}

        {status === DecisionStatus.OPEN && (
          <AddProposalForm
            decisionId={decisionId}
            proposalCount={proposalCount}
            maxProposals={MAX_PROPOSALS}
          />
        )}
      </section>

      {/* 6. Settlement */}
      <div className="mt-8">
        <SettlementPanel
          decisionId={decisionId}
          status={status}
          winningProposalId={Number(winPid)}
          userBalance={userBalance}
          settled={!!isSettled}
          isCreator={isCreator}
          collectedFees={collectedFees as bigint}
        />
      </div>

      {/* 7. Live Trade Feed */}
      <DitheredCard className="mt-8" innerClassName="p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Live Swap Feed
        </h2>
        <TradeFeedTicker />
      </DitheredCard>
    </main>
  );
}
