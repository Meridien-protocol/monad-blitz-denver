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
import { OracleControlPanel } from "@/components/OracleControlPanel";
import { DecisionWelfareChart } from "@/components/DecisionWelfareChart";
import { ExpandedProposal } from "@/components/ExpandedProposal";
import { DeadlineProgress } from "@/components/DeadlineProgress";
import { ShareButton } from "@/components/ShareButton";
import { useDecision, useDecisionB, useProposals, useUserDeposit, useSettled } from "@/hooks/useContract";
import { welfare, MAX_PROPOSALS, ResolutionMode, DecisionStatus } from "@meridian/shared";

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
  const { data: userDeposit } = useUserDeposit(address, decisionId);
  const { data: isSettled } = useSettled(address, decisionId);
  const { data: decisionB } = useDecisionB(decisionId);

  const isModeB = decisionB ? Number(decisionB[3]) === ResolutionMode.MODE_B : false;
  const oracleAddress = decisionB ? (decisionB[0] as string) : "";
  const mBaseline = decisionB ? (decisionB[5] as bigint) : BigInt(0);
  const minImprovement = decisionB ? (decisionB[7] as bigint) : BigInt(0);
  const measuringDeadline = decisionB ? Number(decisionB[2]) : 0;

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

  const [creator, deadline, createdAtBlock, totalDeposits, , status, winPid, virtualLiquidity, title] = decision;

  const proposalSummaries =
    proposalsData
      ?.filter((p) => p.status === "success" && p.result)
      .map((p, i) => {
        const [yesR, noR, , , pTitle] = p.result!;
        const w = yesR + noR > BigInt(0) ? Number(welfare(yesR, noR)) : 5000;
        return { title: pTitle, welfare: w, index: i };
      }) ?? [];

  // Find expanded proposal data
  const expandedData =
    expandedProposalId !== null
      ? proposalsData?.find(
          (_, i) => i === expandedProposalId && _.status === "success" && _.result,
        )
      : null;

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
          {isModeB && (
            <span className="rounded border border-meridian-gold/30 px-2 py-0.5 text-xs font-medium text-meridian-gold">
              Mode B
            </span>
          )}
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
            Liquidity: {formatEther(virtualLiquidity)} vMON
          </span>
          <span className="rounded bg-neutral-800/50 px-2 py-0.5">
            Creator: {creator.slice(0, 6)}...{creator.slice(-4)}
          </span>
        </div>

        {/* Deadline Progress (OPEN only) */}
        <DeadlineProgress
          deadline={BigInt(deadline.toString())}
          createdAtBlock={BigInt(createdAtBlock.toString())}
          status={status}
        />
      </div>

      {/* 3. DeltaDisplay */}
      {proposalSummaries.length >= 2 && (
        <div className="mb-6">
          <DeltaDisplay proposals={proposalSummaries} />
        </div>
      )}

      {/* 4. Proposals -- Expandable Cards */}
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
                const [yesR, noR, , totalVol, pTitle] = p.result;
                return (
                  <ProposalCard
                    key={i}
                    decisionId={decisionId}
                    proposalId={i}
                    title={pTitle}
                    yesReserve={yesR}
                    noReserve={noR}
                    totalVolume={totalVol}
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
                proposalTitle={expandedData.result[4]}
                yesReserve={expandedData.result[0]}
                noReserve={expandedData.result[1]}
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

      {/* 5. Multi-line Welfare Chart */}
      {proposalCount >= 2 && (
        <div className="mt-8">
          <DecisionWelfareChart
            decisionId={decisionId}
            proposalCount={proposalCount}
            proposalNames={proposalSummaries.map((p) => p.title)}
          />
        </div>
      )}

      {/* 6. Action Panels */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <DepositPanel
          decisionId={decisionId}
          userDeposit={userDeposit}
          status={status}
        />

        <SettlementPanel
          decisionId={decisionId}
          status={status}
          winningProposalId={winPid}
          userDeposit={userDeposit}
          settled={!!isSettled}
        />
      </div>

      {/* 7. OracleControlPanel (Mode B only) */}
      {isModeB && (
        status === DecisionStatus.OPEN ||
        status === DecisionStatus.MEASURING ||
        status === DecisionStatus.RESOLVED
      ) && (
        <div className="mt-6">
          <OracleControlPanel
            oracleAddress={oracleAddress}
            mBaseline={mBaseline}
            minImprovement={minImprovement}
            measuringDeadline={measuringDeadline}
          />
        </div>
      )}

      {/* 8. Live Trade Feed */}
      <section className="mt-8 rounded-lg border border-meridian-border bg-meridian-surface p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Live Trade Feed
        </h2>
        <TradeFeedTicker />
      </section>
    </main>
  );
}
