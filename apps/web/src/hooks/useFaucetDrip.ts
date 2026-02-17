"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { parseEther } from "viem";

const MIN_BALANCE = parseEther("0.01");

interface FaucetState {
  status: "idle" | "checking" | "dripping" | "success" | "error" | "funded";
  txHash?: string;
  error?: string;
}

export function useFaucetDrip() {
  const { address, isConnected } = useAccount();
  const { data: balance, isLoading: balanceLoading } = useBalance({ address });
  const [state, setState] = useState<FaucetState>({ status: "idle" });
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address || balanceLoading || !balance) return;
    // Only attempt once per address per session
    if (attemptedRef.current === address) return;

    if (balance.value > MIN_BALANCE) {
      setState({ status: "funded" });
      return;
    }

    attemptedRef.current = address;
    setState({ status: "dripping" });

    fetch("/api/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setState({ status: "error", error: data.error });
          return;
        }
        setState({ status: "success", txHash: data.hash });
      })
      .catch(() => {
        setState({ status: "error", error: "Failed to reach faucet" });
      });
  }, [isConnected, address, balance, balanceLoading]);

  return state;
}
