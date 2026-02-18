"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { usePosition, useBalance } from "@/hooks/useContract";
import { DitheredCard } from "@/components/DitheredCard";
import { DepositStep } from "./DepositStep";
import { SplitMergeStep } from "./SplitMergeStep";
import { SwapStep } from "./SwapStep";

type Step = "deposit" | "split" | "trade";

const STEPS: { key: Step; label: string; number: number }[] = [
  { key: "deposit", label: "Deposit", number: 1 },
  { key: "split", label: "Split", number: 2 },
  { key: "trade", label: "Trade", number: 3 },
];

interface TradeFlowPanelProps {
  decisionId: bigint;
  proposalId: number;
  yesReserve: bigint;
  noReserve: bigint;
  status: number;
}

export function TradeFlowPanel({
  decisionId,
  proposalId,
  yesReserve,
  noReserve,
  status,
}: TradeFlowPanelProps) {
  const { address } = useAccount();
  const { data: position } = usePosition(address, decisionId, proposalId);
  const { data: creditBalance } = useBalance(address, decisionId);

  const yesBalance = position ? (position[0] as bigint) : BigInt(0);
  const noBalance = position ? (position[1] as bigint) : BigInt(0);
  const credits = creditBalance ?? BigInt(0);
  const isOpen = status === 0;

  const defaultStep = useMemo((): Step => {
    if (yesBalance > BigInt(0) || noBalance > BigInt(0)) return "trade";
    if (credits > BigInt(0)) return "split";
    return "deposit";
  }, [yesBalance, noBalance, credits]);

  const [activeStep, setActiveStep] = useState<Step | null>(null);
  const currentStep = activeStep ?? defaultStep;

  if (!address) {
    return (
      <DitheredCard innerClassName="p-6">
        <p className="text-sm text-neutral-500">Connect wallet to trade.</p>
      </DitheredCard>
    );
  }

  function stepColor(step: Step): string {
    if (step === currentStep) return "text-meridian-gold border-meridian-gold";
    // Has relevant balance
    if (step === "deposit") return "text-neutral-300 border-transparent";
    if (step === "split" && credits > BigInt(0)) return "text-neutral-300 border-transparent";
    if (step === "trade" && (yesBalance > BigInt(0) || noBalance > BigInt(0))) return "text-neutral-300 border-transparent";
    return "text-neutral-600 border-transparent";
  }

  return (
    <DitheredCard innerClassName="p-6">
      {/* Step indicator */}
      <div className="mb-4 flex items-center justify-between border-b border-meridian-border pb-3">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center">
            {i > 0 && <div className="mx-2 h-px w-4 bg-neutral-700" />}
            <button
              onClick={() => setActiveStep(step.key)}
              className={`border-b-2 pb-1 text-xs font-semibold uppercase tracking-wider transition-colors ${stepColor(step.key)}`}
            >
              {step.number}. {step.label}
            </button>
          </div>
        ))}
      </div>

      {/* Balance summary */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>Credits: <span className="font-mono text-meridian-gold">{Number(formatEther(credits)).toFixed(4)}</span></span>
        <span>YES: <span className="font-mono text-yes">{Number(formatEther(yesBalance)).toFixed(4)}</span></span>
        <span>NO: <span className="font-mono text-no">{Number(formatEther(noBalance)).toFixed(4)}</span></span>
      </div>

      {/* Active step content */}
      {currentStep === "deposit" && (
        <DepositStep
          decisionId={decisionId}
          creditBalance={credits}
          isOpen={isOpen}
        />
      )}

      {currentStep === "split" && (
        <SplitMergeStep
          decisionId={decisionId}
          proposalId={proposalId}
          creditBalance={credits}
          yesBalance={yesBalance}
          noBalance={noBalance}
          isOpen={isOpen}
        />
      )}

      {currentStep === "trade" && (
        <SwapStep
          decisionId={decisionId}
          proposalId={proposalId}
          yesReserve={yesReserve}
          noReserve={noReserve}
          yesBalance={yesBalance}
          noBalance={noBalance}
          isOpen={isOpen}
        />
      )}
    </DitheredCard>
  );
}
