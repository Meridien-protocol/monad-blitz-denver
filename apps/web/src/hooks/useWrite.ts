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

export function useSplit() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error, reset } = useContractWrite();

  function split(decisionId: bigint, proposalId: bigint, amount: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "split",
      args: [decisionId, proposalId, amount],
    });
  }

  return { split, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useMerge() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error, reset } = useContractWrite();

  function merge(decisionId: bigint, proposalId: bigint, amount: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "merge",
      args: [decisionId, proposalId, amount],
    });
  }

  return { merge, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useSwap() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error, reset } = useContractWrite();

  function swapYesForNo(decisionId: bigint, proposalId: bigint, yesIn: bigint, minNoOut: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "swapYesForNo",
      args: [decisionId, proposalId, yesIn, minNoOut],
    });
  }

  function swapNoForYes(decisionId: bigint, proposalId: bigint, noIn: bigint, minYesOut: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "swapNoForYes",
      args: [decisionId, proposalId, noIn, minYesOut],
    });
  }

  return { swapYesForNo, swapNoForYes, hash, isPending, isConfirming, isSuccess, error, reset };
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

export function useRedeemLP() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  function redeemLP(decisionId: bigint, proposalId: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "redeemLP",
      args: [decisionId, proposalId],
    });
  }

  return { redeemLP, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaimFees() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  function claimFees(decisionId: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "claimFees",
      args: [decisionId],
    });
  }

  return { claimFees, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateDecision() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, receipt, error } = useContractWrite();

  function createDecision(title: string, durationInBlocks: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "createDecision",
      args: [title, durationInBlocks],
    });
  }

  return { createDecision, hash, isPending, isConfirming, isSuccess, receipt, error };
}

export function useAddProposal() {
  const { writeContract, hash, isPending, isConfirming, isSuccess, error, reset } = useContractWrite();

  function addProposal(decisionId: bigint, title: string, liquidityEth: string) {
    writeContract({
      ...CONTRACT,
      functionName: "addProposal",
      args: [decisionId, title],
      value: parseEther(liquidityEth),
    });
  }

  return { addProposal, hash, isPending, isConfirming, isSuccess, error, reset };
}
