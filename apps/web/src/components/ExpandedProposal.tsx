"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { BPS } from "@meridian/shared";
import { WelfareChart } from "@/components/WelfareChart";
import { TradePanel } from "@/components/TradePanel";
import { useWelfare, usePosition } from "@/hooks/useContract";

interface ExpandedProposalProps {
  decisionId: bigint;
  proposalId: number;
  proposalTitle: string;
  yesReserve: bigint;
  noReserve: bigint;
  status: number;
  onClose: () => void;
}

export function ExpandedProposal({
  decisionId,
  proposalId,
  proposalTitle,
  yesReserve,
  noReserve,
  status,
  onClose,
}: ExpandedProposalProps) {
  const { address } = useAccount();
  const { data: welfareValue } = useWelfare(decisionId, proposalId);
  const { data: position } = usePosition(address, decisionId, proposalId);

  const w = welfareValue !== undefined ? Number(welfareValue) : 5000;
  const pct = Math.min(100, Math.max(0, (w / BPS) * 100));
  const hasPosition =
    position && (position[0] > BigInt(0) || position[1] > BigInt(0));

  return (
    <div className="animate-slide-down mt-4 rounded-lg border border-meridian-gold/20 bg-meridian-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-meridian-border px-6 py-3">
        <h3 className="text-sm font-semibold text-white">{proposalTitle}</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 p-6 lg:grid-cols-5">
        {/* Left: Chart + Position */}
        <div className="lg:col-span-3">
          <WelfareChart
            decisionId={decisionId}
            proposalId={proposalId}
            currentWelfare={w}
          />

          {/* Position display */}
          <div className="mt-4 rounded-lg border border-meridian-border bg-meridian-bg p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Your Position
            </h4>
            {!address ? (
              <p className="text-sm text-neutral-500">
                Connect wallet to view your position.
              </p>
            ) : hasPosition ? (
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
              <p className="text-sm text-neutral-500">
                No position in this proposal yet.
              </p>
            )}
          </div>
        </div>

        {/* Right: Trade Panel */}
        <div className="lg:col-span-2">
          <TradePanel
            decisionId={decisionId}
            proposalId={proposalId}
            yesReserve={yesReserve}
            noReserve={noReserve}
            status={status}
          />
        </div>
      </div>
    </div>
  );
}
