"use client";

import { useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { parseEther } from "viem";
import { MeridianCoreABI, MERIDIAN_CORE_ADDRESS } from "@meridian/shared";

const CONTRACT = {
  address: MERIDIAN_CORE_ADDRESS,
  abi: MeridianCoreABI,
} as const;

/** Shared write helper: wraps useWriteContract + useWaitForTransactionReceipt
 *  and invalidates all queries once the tx is confirmed. */
function useContractWrite() {
  const queryClient = useQueryClient();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });

  useEffect(() => {
    if (receipt.isSuccess) {
      queryClient.invalidateQueries();
    }
  }, [receipt.isSuccess, queryClient]);

  return {
    writeContract: write.writeContract,
    hash: write.data,
    isPending: write.isPending,
    error: write.error,
    reset: write.reset,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
    receipt: receipt.data,
  };
}

export function useDeposit() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  function deposit(decisionId: bigint, amountEth: string) {
    writeContract({
      ...CONTRACT,
      functionName: "deposit",
      args: [decisionId],
      value: parseEther(amountEth),
    });
  }

  return { deposit, hash, isPending, isConfirming, isSuccess, error };
}

export function useWithdraw() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  function withdraw(decisionId: bigint, amount: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "withdraw",
      args: [decisionId, amount],
    });
  }

  return { withdraw, hash, isPending, isConfirming, isSuccess, error };
}

export function useTrade() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error, reset } = useContractWrite();

  function buyYes(decisionId: bigint, proposalId: bigint, amount: bigint, minOut: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "buyYes",
      args: [decisionId, proposalId, amount, minOut],
    });
  }

  function buyNo(decisionId: bigint, proposalId: bigint, amount: bigint, minOut: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "buyNo",
      args: [decisionId, proposalId, amount, minOut],
    });
  }

  function sellYes(decisionId: bigint, proposalId: bigint, yesAmount: bigint, minOut: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "sellYes",
      args: [decisionId, proposalId, yesAmount, minOut],
    });
  }

  function sellNo(decisionId: bigint, proposalId: bigint, noAmount: bigint, minOut: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "sellNo",
      args: [decisionId, proposalId, noAmount, minOut],
    });
  }

  return { buyYes, buyNo, sellYes, sellNo, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useCollapse() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  function collapse(decisionId: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "collapse",
      args: [decisionId],
    });
  }

  return { collapse, hash, isPending, isConfirming, isSuccess, error };
}

export function useSettle() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  function settle(decisionId: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "settle",
      args: [decisionId],
    });
  }

  return { settle, hash, isPending, isConfirming, isSuccess, error };
}

export function useResolve() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  function resolve(decisionId: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "resolve",
      args: [decisionId],
    });
  }

  return { resolve, hash, isPending, isConfirming, isSuccess, error };
}

export function useResolveDispute() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  function resolveDispute(decisionId: bigint, outcome: number) {
    writeContract({
      ...CONTRACT,
      functionName: "resolveDispute",
      args: [decisionId, outcome],
    });
  }

  return { resolveDispute, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateDecision() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, receipt, error } = useContractWrite();

  function createDecision(title: string, durationInBlocks: bigint, virtualLiquidity: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "createDecision",
      args: [title, durationInBlocks, virtualLiquidity],
    });
  }

  return { createDecision, hash, isPending, isConfirming, isSuccess, receipt, error };
}

export function useAddProposal() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error, reset } = useContractWrite();

  function addProposal(decisionId: bigint, title: string) {
    writeContract({
      ...CONTRACT,
      functionName: "addProposal",
      args: [decisionId, title],
    });
  }

  return { addProposal, hash, isPending, isConfirming, isSuccess, error, reset };
}
