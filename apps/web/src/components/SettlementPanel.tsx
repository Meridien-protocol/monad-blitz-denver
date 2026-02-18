"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useCollapse, useSettle, useRedeemLP, useClaimFees } from "@/hooks/useWrite";
import { DecisionStatus } from "@meridian/shared";
import { DitheredButton } from "@/components/DitheredButton.dynamic";
import { DitheredCard } from "@/components/DitheredCard";

interface SettlementPanelProps {
  decisionId: bigint;
  status: number;
  winningProposalId: number;
  userBalance: bigint | undefined;
  settled: boolean;
  isCreator: boolean;
  collectedFees: bigint;
}

export function SettlementPanel({
  decisionId,
  status,
  winningProposalId,
  userBalance,
  settled,
  isCreator,
  collectedFees,
}: SettlementPanelProps) {
  const { address } = useAccount();
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
    claimFees,
    isPending: claimPending,
    isConfirming: claimConfirming,
    isSuccess: claimSuccess,
  } = useClaimFees();

  if (!address) return null;

  // Show collapse button when decision is still open and past deadline
  if (status === DecisionStatus.OPEN) {
    return (
      <div className="rounded-lg border border-meridian-gold/30 bg-meridian-gold/5 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-meridian-gold">
          Resolution
        </h2>
        <p className="mb-4 text-sm text-neutral-400">
          If the deadline has passed, trigger the collapse to determine the winning proposal via TWAP YES prices.
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

  // Show settlement UI when collapsed
  if (status === DecisionStatus.COLLAPSED) {
    return (
      <DitheredCard variant="gold" innerClassName="bg-meridian-gold/5 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-meridian-gold">
          Settlement
        </h2>
        <div className="mb-4 space-y-2 text-sm text-neutral-400">
          <div>
            Winning proposal: <span className="font-mono text-meridian-gold">#{winningProposalId}</span>
          </div>
          {userBalance !== undefined && userBalance > BigInt(0) && (
            <div>
              Your balance: <span className="font-mono text-neutral-200">{formatEther(userBalance)} MON</span>
            </div>
          )}
        </div>

        {settled ? (
          <div className="rounded bg-yes/10 px-3 py-2 text-sm text-yes">
            You have already settled this decision.
          </div>
        ) : (
          <>
            <DitheredButton
              onClick={() => settle(decisionId)}
              variant="gold"
              size="md"
              disabled={settlePending || settleConfirming}
            >
              {settlePending
                ? "Signing..."
                : settleConfirming
                  ? "Confirming..."
                  : settleSuccess
                    ? "Settled"
                    : "Claim Payout"}
            </DitheredButton>
            {settleError && (
              <p className="mt-2 text-xs text-no">{settleError.message.slice(0, 80)}</p>
            )}
          </>
        )}

        {/* Fee claim for decision creator */}
        {isCreator && collectedFees > BigInt(0) && (
          <div className="mt-4 border-t border-meridian-border pt-4">
            <div className="mb-2 text-xs text-neutral-500">
              Collected fees: <span className="font-mono text-meridian-gold">{formatEther(collectedFees)} MON</span>
            </div>
            <DitheredButton
              onClick={() => claimFees(decisionId)}
              variant="neutral"
              size="sm"
              disabled={claimPending || claimConfirming}
            >
              {claimPending
                ? "Signing..."
                : claimConfirming
                  ? "Confirming..."
                  : claimSuccess
                    ? "Claimed"
                    : "Claim Fees"}
            </DitheredButton>
          </div>
        )}
      </DitheredCard>
    );
  }

  // Already settled
  if (status === DecisionStatus.SETTLED) {
    return (
      <DitheredCard variant="neutral" innerClassName="bg-neutral-800/50 p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Settled
        </h2>
        <p className="text-sm text-neutral-500">
          This decision has been fully settled. Winning proposal: #{winningProposalId}
        </p>
      </DitheredCard>
    );
  }

  return null;
}
