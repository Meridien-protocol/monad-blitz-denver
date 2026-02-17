"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { parseEther, decodeEventLog } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MeridianCoreABI } from "@meridian/shared";
import { useCreateDecision } from "@/hooks/useWrite";

const BLOCKS_PER_HOUR = 7200;

type DurationUnit = "hours" | "days";

export default function CreateDecisionPage() {
  const router = useRouter();
  const { isConnected } = useAccount();

  const [title, setTitle] = useState("");
  const [durationValue, setDurationValue] = useState("");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");
  const [liquidity, setLiquidity] = useState("100");

  const {
    createDecision,
    isPending,
    isConfirming,
    isSuccess,
    receipt,
    error,
  } = useCreateDecision();

  useEffect(() => {
    if (isSuccess && receipt) {
      const log = receipt.logs.find((l) => {
        try {
          const decoded = decodeEventLog({
            abi: MeridianCoreABI,
            data: l.data,
            topics: l.topics,
          });
          return decoded.eventName === "DecisionCreated";
        } catch {
          return false;
        }
      });

      if (log) {
        const decoded = decodeEventLog({
          abi: MeridianCoreABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "DecisionCreated") {
          const newId = (decoded.args as { decisionId: bigint }).decisionId;
          router.push(`/decisions/${newId.toString()}`);
        }
      }
    }
  }, [isSuccess, receipt, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !durationValue || !liquidity) return;

    const multiplier = durationUnit === "days" ? BLOCKS_PER_HOUR * 24 : BLOCKS_PER_HOUR;
    const durationInBlocks = BigInt(Math.floor(Number(durationValue) * multiplier));
    const virtualLiquidity = parseEther(liquidity);

    createDecision(title.trim(), durationInBlocks, virtualLiquidity);
  }

  const durationBlocks = durationValue
    ? Math.floor(
        Number(durationValue) *
          (durationUnit === "days" ? BLOCKS_PER_HOUR * 24 : BLOCKS_PER_HOUR)
      )
    : 0;

  return (
    <main className="relative z-10 mx-auto max-w-lg px-4 py-16">
        <h1 className="mb-8 text-2xl font-bold text-white">Create Decision</h1>

        {!isConnected ? (
          <div className="rounded-lg border border-meridian-border bg-meridian-surface p-8 text-center">
            <p className="mb-4 text-sm text-neutral-400">
              Connect your wallet to create a decision.
            </p>
            <ConnectButton />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-lg border border-meridian-border bg-meridian-surface p-6"
          >
            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                Title
              </label>
              <input
                type="text"
                placeholder="What should we decide?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full rounded border border-meridian-border bg-meridian-bg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                Duration
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 24"
                  value={durationValue}
                  onChange={(e) =>
                    setDurationValue(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  className="flex-1 rounded border border-meridian-border bg-meridian-bg px-3 py-2 font-mono text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
                />
                <div className="flex rounded border border-meridian-border">
                  {(["hours", "days"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setDurationUnit(unit)}
                      className={`px-3 py-2 text-xs transition-colors ${
                        durationUnit === unit
                          ? "bg-meridian-gold/20 text-meridian-gold"
                          : "bg-meridian-bg text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
              {durationBlocks > 0 && (
                <p className="mt-1 text-xs text-neutral-600">
                  ~{durationBlocks.toLocaleString()} blocks
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                Virtual Liquidity (vMON)
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="100"
                value={liquidity}
                onChange={(e) =>
                  setLiquidity(e.target.value.replace(/[^0-9.]/g, ""))
                }
                className="w-full rounded border border-meridian-border bg-meridian-bg px-3 py-2 font-mono text-sm text-white placeholder-neutral-600 focus:border-meridian-gold focus:outline-none"
              />
              <p className="mt-1 text-xs text-neutral-600">
                Initial pool liquidity for each proposal. Higher values reduce
                price impact.
              </p>
            </div>

            <button
              type="submit"
              disabled={
                !title.trim() ||
                !durationValue ||
                !liquidity ||
                isPending ||
                isConfirming
              }
              className="w-full rounded bg-meridian-gold py-3 text-sm font-bold text-black transition-colors hover:bg-meridian-gold/90 disabled:bg-meridian-gold/30 disabled:text-black/50"
            >
              {isPending
                ? "Signing..."
                : isConfirming
                  ? "Confirming..."
                  : "Create Decision"}
            </button>

            {error && (
              <p className="text-center text-xs text-no">
                {error.message.slice(0, 120)}
              </p>
            )}
          </form>
        )}
      </main>
  );
}
