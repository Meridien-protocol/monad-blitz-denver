"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { Header } from "@/components/Header";
import { CompassRoseLogo } from "@/components/CompassRoseLogo";
import { StatusBadge } from "@/components/StatusBadge";
import { useNextDecisionId, useDecisions } from "@/hooks/useContract";

export default function Home() {
  const { isConnected } = useAccount();
  const { data: nextId } = useNextDecisionId();
  const count = nextId ? Number(nextId) : 0;
  const { data: decisionsData, isLoading } = useDecisions(count);

  const decisions =
    decisionsData
      ?.map((d, i) => {
        if (d.status !== "success" || !d.result) return null;
        const [creator, deadline, , totalDeposits, proposalCount, status, , , title] = d.result;
        return { id: i, creator, deadline, totalDeposits, proposalCount: Number(proposalCount), status, title };
      })
      .filter(Boolean) ?? [];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-16">
        <section className="flex flex-col items-center gap-6 py-12 text-center">
          <CompassRoseLogo size={120} />
          <p className="max-w-md text-lg text-neutral-400">
            Quantum Futarchy on Monad. Capital-efficient prediction market
            governance where collective intelligence guides decisions.
          </p>

          {!isConnected && (
            <div className="mt-4 flex flex-col items-center gap-4">
              <p className="text-sm text-neutral-500">
                Connect your wallet to view active decisions and start trading
              </p>
              <ConnectButton />
            </div>
          )}
        </section>

        {isConnected && (
          <section className="mt-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-300">
                Decisions{count > 0 ? ` (${count})` : ""}
              </h2>
              <Link
                href="/decisions/create"
                className="rounded bg-meridian-gold px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-meridian-gold/90"
              >
                Create Decision
              </Link>
            </div>

            {isLoading ? (
              <div className="animate-pulse text-neutral-500">
                Loading decisions...
              </div>
            ) : decisions.length === 0 ? (
              <div className="rounded-lg border border-meridian-border bg-meridian-surface p-8 text-center">
                <p className="text-sm text-neutral-400">
                  No decisions yet. Create the first one to get started.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {decisions.map((d) => (
                  <Link
                    key={d!.id}
                    href={`/decisions/${d!.id}`}
                    className="group rounded-lg border border-meridian-border bg-meridian-surface p-5 transition-colors hover:border-meridian-gold/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-white group-hover:text-meridian-gold">
                          {d!.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
                          <span>
                            {d!.proposalCount} proposal
                            {d!.proposalCount !== 1 ? "s" : ""}
                          </span>
                          <span>
                            {formatEther(d!.totalDeposits)} MON deposited
                          </span>
                          <span>
                            Deadline block: {d!.deadline.toString()}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={d!.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
