"use client";

import { use } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { StatusBadge } from "@/components/StatusBadge";
import { ProposalCard } from "@/components/ProposalCard";
import { DeltaDisplay } from "@/components/DeltaDisplay";
import { DepositPanel } from "@/components/DepositPanel";
import { SettlementPanel } from "@/components/SettlementPanel";
import { TradeFeedTicker } from "@/components/TradeFeedTicker";
import { BlockHeartbeat } from "@/components/BlockHeartbeat";
import { AddProposalForm } from "@/components/AddProposalForm";
import { OracleControlPanel } from "@/components/OracleControlPanel";
import { useDecision, useDecisionB, useProposals, useUserDeposit, useSettled } from "@/hooks/useContract";
import { welfare, MAX_PROPOSALS, ResolutionMode, DecisionStatus } from "@meridian/shared";

export default function DecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const decisionId = BigInt(id);
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

  const [creator, deadline, , totalDeposits, , status, winPid, , title] = decision;

  const proposalSummaries =
    proposalsData
      ?.filter((p) => p.status === "success" && p.result)
      .map((p, i) => {
        const [yesR, noR, , , pTitle] = p.result!;
        const w = yesR + noR > BigInt(0) ? Number(welfare(yesR, noR)) : 5000;
        return { title: pTitle, welfare: w, index: i };
      }) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <StatusBadge status={status} />
            <span className="text-xs text-neutral-600">Decision #{id}</span>
            <BlockHeartbeat />
          </div>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <div className="mt-3 flex gap-6 text-sm text-neutral-500">
            <span>Deadline block: {deadline.toString()}</span>
            <span>Deposits: {formatEther(totalDeposits)} MON</span>
            <span>Creator: {creator.slice(0, 6)}...{creator.slice(-4)}</span>
          </div>
        </div>

        {proposalSummaries.length >= 2 && (
          <div className="mb-6">
            <DeltaDisplay proposals={proposalSummaries} />
          </div>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold text-neutral-300">
            Proposals ({proposalCount})
          </h2>
          {proposalsLoading ? (
            <div className="animate-pulse text-neutral-500">Loading proposals...</div>
          ) : (
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
                  />
                );
              })}
            </div>
          )}

          {status === 0 && (
            <AddProposalForm
              decisionId={decisionId}
              proposalCount={proposalCount}
              maxProposals={MAX_PROPOSALS}
            />
          )}
        </section>

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

        <section className="mt-8 rounded-lg border border-meridian-border bg-meridian-surface p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Live Trade Feed
          </h2>
          <TradeFeedTicker />
        </section>
      </main>
  );
}
