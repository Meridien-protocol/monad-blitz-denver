"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useCollapse, useSettle, useResolve, useResolveDispute } from "@/hooks/useWrite";
import { useDecisionB } from "@/hooks/useContract";
import { DecisionStatus, ResolutionMode, Outcome } from "@meridian/shared";

interface SettlementPanelProps {
  decisionId: bigint;
  status: number;
  winningProposalId: number;
  userDeposit: bigint | undefined;
  settled: boolean;
}

const OUTCOME_LABELS: Record<number, string> = {
  [Outcome.UNRESOLVED]: "Unresolved",
  [Outcome.YES]: "YES",
  [Outcome.NO]: "NO",
};

export function SettlementPanel({
  decisionId,
  status,
  winningProposalId,
  userDeposit,
  settled,
}: SettlementPanelProps) {
  const { address } = useAccount();
  const { data: decisionB } = useDecisionB(decisionId);
  const {
    collapse,
    isPending: collapsePending,
    isConfirming: collapseConfirming,
    isSuccess: collapseSuccess,
  } = useCollapse();
  const {
    settle,
    isPending: settlePending,
    isConfirming: settleConfirming,
    isSuccess: settleSuccess,
    error: settleError,
  } = useSettle();
  const {
    resolve,
    isPending: resolvePending,
    isConfirming: resolveConfirming,
    isSuccess: resolveSuccess,
    error: resolveError,
  } = useResolve();
  const {
    resolveDispute,
    isPending: disputePending,
    isConfirming: disputeConfirming,
    isSuccess: disputeSuccess,
  } = useResolveDispute();

  if (!address) return null;

  const isModeBRaw = decisionB ? Number(decisionB[3]) : 0;
  const isModeB = isModeBRaw === ResolutionMode.MODE_B;
  const guardian = decisionB ? (decisionB[1] as string) : "";
  const isGuardian = guardian.toLowerCase() === address.toLowerCase();
  const outcomeRaw = decisionB ? Number(decisionB[4]) : 0;
  const mBaseline = decisionB ? decisionB[5] : BigInt(0);
  const mActual = decisionB ? decisionB[6] : BigInt(0);

  // Show collapse button when decision is still open and past deadline
  if (status === DecisionStatus.OPEN) {
    return (
      <div className="rounded-lg border border-meridian-gold/30 bg-meridian-gold/5 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-meridian-gold">
          Resolution
        </h2>
        <p className="mb-4 text-sm text-neutral-400">
          If the deadline has passed, trigger the collapse to determine the winning proposal via TWAP welfare scores.
          {isModeB && " This Mode B decision will enter the measurement phase after collapse."}
        </p>
        <button
          onClick={() => collapse(decisionId)}
          disabled={collapsePending || collapseConfirming}
          className="rounded bg-meridian-gold px-4 py-2 text-sm font-medium text-meridian-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {collapsePending
            ? "Signing..."
            : collapseConfirming
              ? "Confirming..."
              : collapseSuccess
                ? "Collapsed"
                : "Trigger Collapse"}
        </button>
      </div>
    );
  }

  // Mode B: MEASURING state -- show resolve button
  if (status === DecisionStatus.MEASURING) {
    return (
      <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-cyan-400">
          Measurement Phase
        </h2>
        <div className="mb-4 space-y-2 text-sm text-neutral-400">
          <div>
            Winning proposal: <span className="font-mono text-cyan-400">#{winningProposalId}</span>
          </div>
          <div>
            Baseline metric: <span className="font-mono text-neutral-200">{mBaseline.toString()}</span>
          </div>
          <p>
            The welfare oracle is being measured. Once the measurement period ends, anyone can trigger resolution.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => resolve(decisionId)}
            disabled={resolvePending || resolveConfirming}
            className="rounded bg-cyan-500 px-4 py-2 text-sm font-medium text-meridian-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {resolvePending
              ? "Signing..."
              : resolveConfirming
                ? "Confirming..."
                : resolveSuccess
                  ? "Resolved"
                  : "Resolve"}
          </button>

          {isGuardian && (
            <>
              <button
                onClick={() => resolveDispute(decisionId, Outcome.YES)}
                disabled={disputePending || disputeConfirming}
                className="rounded border border-yes/40 bg-yes/10 px-4 py-2 text-sm font-medium text-yes transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {disputePending || disputeConfirming ? "..." : "Override: YES"}
              </button>
              <button
                onClick={() => resolveDispute(decisionId, Outcome.NO)}
                disabled={disputePending || disputeConfirming}
                className="rounded border border-no/40 bg-no/10 px-4 py-2 text-sm font-medium text-no transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {disputePending || disputeConfirming ? "..." : "Override: NO"}
              </button>
            </>
          )}
        </div>

        {resolveError && (
          <p className="mt-2 text-xs text-no">{resolveError.message.slice(0, 80)}</p>
        )}
      </div>
    );
  }

  // Mode A: Show settlement UI when collapsed
  if (status === DecisionStatus.COLLAPSED) {
    return (
      <div className="rounded-lg border border-meridian-gold/30 bg-meridian-gold/5 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-meridian-gold">
          Settlement
        </h2>
        <div className="mb-4 space-y-2 text-sm text-neutral-400">
          <div>
            Winning proposal: <span className="font-mono text-meridian-gold">#{winningProposalId}</span>
          </div>
          {userDeposit !== undefined && userDeposit > BigInt(0) && (
            <div>
              Your deposit: <span className="font-mono text-neutral-200">{formatEther(userDeposit)} MON</span>
            </div>
          )}
        </div>

        {settled ? (
          <div className="rounded bg-yes/10 px-3 py-2 text-sm text-yes">
            You have already settled this decision.
          </div>
        ) : (
          <>
            <button
              onClick={() => settle(decisionId)}
              disabled={settlePending || settleConfirming}
              className="rounded bg-meridian-gold px-4 py-2 text-sm font-medium text-meridian-bg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {settlePending
                ? "Signing..."
                : settleConfirming
                  ? "Confirming..."
                  : settleSuccess
                    ? "Settled"
                    : "Claim Payout"}
            </button>
            {settleError && (
              <p className="mt-2 text-xs text-no">{settleError.message.slice(0, 80)}</p>
            )}
          </>
        )}
      </div>
    );
  }

  // Mode B: RESOLVED state -- show settle with outcome info
  if (status === DecisionStatus.RESOLVED) {
    return (
      <div className="rounded-lg border border-violet-400/30 bg-violet-400/5 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-violet-400">
          Settlement (Mode B)
        </h2>
        <div className="mb-4 space-y-2 text-sm text-neutral-400">
          <div>
            Winning proposal: <span className="font-mono text-violet-400">#{winningProposalId}</span>
          </div>
          <div>
            Outcome: <span className={`font-mono font-bold ${outcomeRaw === Outcome.YES ? "text-yes" : "text-no"}`}>
              {OUTCOME_LABELS[outcomeRaw] ?? "Unknown"}
            </span>
          </div>
          <div>
            Baseline: <span className="font-mono text-neutral-200">{mBaseline.toString()}</span>
            {" -> "}
            Actual: <span className="font-mono text-neutral-200">{mActual.toString()}</span>
          </div>
          {userDeposit !== undefined && userDeposit > BigInt(0) && (
            <div>
              Your deposit: <span className="font-mono text-neutral-200">{formatEther(userDeposit)} MON</span>
            </div>
          )}
        </div>

        {isGuardian && (
          <div className="mb-4 flex gap-3">
            <button
              onClick={() => resolveDispute(decisionId, Outcome.YES)}
              disabled={disputePending || disputeConfirming}
              className="rounded border border-yes/40 bg-yes/10 px-4 py-2 text-sm font-medium text-yes transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {disputeSuccess ? "Overridden" : disputePending || disputeConfirming ? "..." : "Override: YES"}
            </button>
            <button
              onClick={() => resolveDispute(decisionId, Outcome.NO)}
              disabled={disputePending || disputeConfirming}
              className="rounded border border-no/40 bg-no/10 px-4 py-2 text-sm font-medium text-no transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {disputeSuccess ? "Overridden" : disputePending || disputeConfirming ? "..." : "Override: NO"}
            </button>
          </div>
        )}

        {settled ? (
          <div className="rounded bg-yes/10 px-3 py-2 text-sm text-yes">
            You have already settled this decision.
          </div>
        ) : (
          <>
            <button
              onClick={() => settle(decisionId)}
              disabled={settlePending || settleConfirming}
              className="rounded bg-violet-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {settlePending
                ? "Signing..."
                : settleConfirming
                  ? "Confirming..."
                  : settleSuccess
                    ? "Settled"
                    : "Claim Payout"}
            </button>
            {settleError && (
              <p className="mt-2 text-xs text-no">{settleError.message.slice(0, 80)}</p>
            )}
          </>
        )}
      </div>
    );
  }

  // Already settled
  if (status === DecisionStatus.SETTLED) {
    return (
      <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Settled
        </h2>
        <p className="text-sm text-neutral-500">
          This decision has been fully settled. Winning proposal: #{winningProposalId}
        </p>
      </div>
    );
  }

  return null;
}
