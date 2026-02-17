"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { MeridianCoreABI, MERIDIAN_CORE_ADDRESS } from "@meridian/shared";

const CONTRACT = {
  address: MERIDIAN_CORE_ADDRESS,
  abi: MeridianCoreABI,
} as const;

export function useDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function settle(decisionId: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "settle",
      args: [decisionId],
    });
  }

  return { settle, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateDecision() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  function createDecision(title: string, durationInBlocks: bigint, virtualLiquidity: bigint) {
    writeContract({
      ...CONTRACT,
      functionName: "createDecision",
      args: [title, durationInBlocks, virtualLiquidity],
    });
  }

  return { createDecision, hash, isPending, isConfirming: receipt.isLoading, isSuccess: receipt.isSuccess, receipt: receipt.data, error };
}

export function useAddProposal() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function addProposal(decisionId: bigint, title: string) {
    writeContract({
      ...CONTRACT,
      functionName: "addProposal",
      args: [decisionId, title],
    });
  }

  return { addProposal, hash, isPending, isConfirming, isSuccess, error, reset };
}
