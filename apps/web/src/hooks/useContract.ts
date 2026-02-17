"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { MeridianCoreABI, MERIDIAN_CORE_ADDRESS } from "@meridian/shared";

const CONTRACT = {
  address: MERIDIAN_CORE_ADDRESS,
  abi: MeridianCoreABI,
} as const;

export function useDecision(decisionId: bigint) {
  return useReadContract({
    ...CONTRACT,
    functionName: "decisions",
    args: [decisionId],
  });
}

export function useProposals(decisionId: bigint, count: number) {
  const contracts = Array.from({ length: count }, (_, i) => ({
    ...CONTRACT,
    functionName: "getProposal" as const,
    args: [decisionId, BigInt(i)] as const,
  }));

  return useReadContracts({
    contracts,
    query: { enabled: count > 0 },
  });
}

export function useWelfare(decisionId: bigint, proposalId: number) {
  return useReadContract({
    ...CONTRACT,
    functionName: "getWelfare",
    args: [decisionId, BigInt(proposalId)],
  });
}

export function usePosition(
  address: `0x${string}` | undefined,
  decisionId: bigint,
  proposalId: number,
) {
  return useReadContract({
    ...CONTRACT,
    functionName: "getPosition",
    args: [address!, decisionId, BigInt(proposalId)],
    query: { enabled: !!address },
  });
}

export function useUserDeposit(
  address: `0x${string}` | undefined,
  decisionId: bigint,
) {
  return useReadContract({
    ...CONTRACT,
    functionName: "getUserDeposit",
    args: [address!, decisionId],
    query: { enabled: !!address },
  });
}

export function useSettled(
  address: `0x${string}` | undefined,
  decisionId: bigint,
) {
  return useReadContract({
    ...CONTRACT,
    functionName: "settled",
    args: [decisionId, address!],
    query: { enabled: !!address },
  });
}

export function useProposalData(decisionId: bigint, proposalId: number) {
  return useReadContract({
    ...CONTRACT,
    functionName: "getProposal",
    args: [decisionId, BigInt(proposalId)],
  });
}

export function useNextDecisionId() {
  return useReadContract({
    ...CONTRACT,
    functionName: "nextDecisionId",
  });
}

export function useDecisions(count: number) {
  const contracts = Array.from({ length: count }, (_, i) => ({
    ...CONTRACT,
    functionName: "decisions" as const,
    args: [BigInt(i)] as const,
  }));

  return useReadContracts({
    contracts,
    query: { enabled: count > 0 },
  });
}
