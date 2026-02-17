"use client";

import { use } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { WelfareBar } from "@/components/WelfareBar";
import { StatusBadge } from "@/components/StatusBadge";
import { TradePanel } from "@/components/TradePanel";
import { BlockHeartbeat } from "@/components/BlockHeartbeat";
import {
  useDecision,
  useWelfare,
  usePosition,
  useProposalData,
} from "@/hooks/useContract";

export default function ProposalPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const { id, proposalId: pidStr } = use(params);
  const decisionId = BigInt(id);
  const proposalId = Number(pidStr);
  const { address } = useAccount();

  const { data: decision } = useDecision(decisionId);
  const { data: welfareValue, isLoading: welfareLoading } = useWelfare(decisionId, proposalId);
  const { data: position } = usePosition(address, decisionId, proposalId);
  const { data: proposalData } = useProposalData(decisionId, proposalId);

  const w = welfareValue !== undefined ? Number(welfareValue) : 5000;
  const status = decision ? decision[5] : 0;
  const decisionTitle = decision ? decision[8] : "Loading...";

  const yesReserve = proposalData ? proposalData[0] : BigInt(0);
  const noReserve = proposalData ? proposalData[1] : BigInt(0);
  const proposalTitle = proposalData ? proposalData[4] : "";

  const hasPosition = position && (position[0] > BigInt(0) || position[1] > BigInt(0));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-2 flex items-center gap-3 text-xs text-neutral-600">
          <span>Decision #{id} / Proposal #{pidStr}</span>
          <BlockHeartbeat />
        </div>
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">
            {proposalTitle || decisionTitle}
          </h1>
          <StatusBadge status={status} />
        </div>

        <section className="mb-8 rounded-lg border border-meridian-border bg-meridian-surface p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Welfare Score
          </h2>
          {welfareLoading ? (
            <div className="animate-pulse text-neutral-500">Loading welfare...</div>
          ) : (
            <WelfareBar welfare={w} size="lg" />
          )}
        </section>

        {address && (
          <section className="mb-8 rounded-lg border border-meridian-border bg-meridian-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Your Position
            </h2>
            {hasPosition ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-neutral-500">YES tokens</div>
                  <div className="font-mono text-lg text-yes">
                    {Number(formatEther(position[0])).toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">NO tokens</div>
                  <div className="font-mono text-lg text-no">
                    {Number(formatEther(position[1])).toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">vMON spent</div>
                  <div className="font-mono text-lg text-neutral-300">
                    {Number(formatEther(position[2])).toFixed(4)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No position in this proposal yet.</p>
            )}
          </section>
        )}

        <TradePanel
          decisionId={decisionId}
          proposalId={proposalId}
          yesReserve={yesReserve}
          noReserve={noReserve}
          status={status}
        />
      </main>
  );
}
