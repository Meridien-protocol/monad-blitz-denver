"use client";

import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/components/StatusBadge";
import { useNextDecisionId, useDecisions } from "@/hooks/useContract";
import dynamic from "next/dynamic";

const LiquidChrome = dynamic(() => import("@/components/LiquidChrome"), { ssr: false });

function Crosshair({ className }: { className?: string }) {
  return (
    <span className={`absolute select-none text-[10px] text-white/30 ${className ?? ""}`}>
      +
    </span>
  );
}

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
      <div className="pointer-events-none fixed inset-0 -z-10">
        <LiquidChrome
          baseColor={[0.02, 0.008, 0.001]}
          speed={0.35}
          amplitude={0.4}
          frequencyX={4}
          frequencyY={4}
          interactive
        />
      </div>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-16">
        {/* Hero Section */}
        <section className="flex flex-col items-center pt-8 pb-0">
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            [ Meridian ]
          </p>

          <h1 className="mt-5 text-center text-5xl leading-[1.1] text-white md:text-7xl lg:text-8xl">
            <span className="font-serif italic text-meridian-gold">Vote</span>{" "}
            the Future
            <br />
            into Being
          </h1>

          {/* Image container */}
          <div className="relative mt-12 w-full overflow-hidden rounded-sm border border-white/5">
            <Image
              src="/revolution.png"
              alt="Liberty Leading the People"
              width={1200}
              height={675}
              className="block w-full object-cover"
              priority
            />

            {/* Gradient overlay at bottom */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-meridian-bg/80 via-transparent to-transparent" />

            {/* Crosshair markers */}
            <Crosshair className="left-[8%] top-[12%]" />
            <Crosshair className="right-[10%] top-[15%]" />
            <Crosshair className="left-[15%] bottom-[25%]" />
            <Crosshair className="right-[12%] bottom-[30%]" />
            <Crosshair className="left-[50%] top-[8%]" />
            <Crosshair className="right-[35%] bottom-[18%]" />

            {/* Bottom-left monospace overlay */}
            <div className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-wider text-white/70 md:bottom-6 md:left-6 md:text-xs">
              <span className="text-white/50">[ Quantum Futarchy ]</span>{" "}
              <span className="text-meridian-gold/80">on Monad</span>
            </div>
          </div>

          {/* Tagline below image */}
          <p className="mt-8 max-w-lg text-center text-sm leading-relaxed text-neutral-500">
            Capital-efficient prediction market governance where
            collective intelligence guides every decision.
          </p>

          {!isConnected && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <ConnectButton />
            </div>
          )}
        </section>

        {/* Thin separator line */}
        <div className="mx-auto my-16 h-px w-full max-w-md bg-gradient-to-r from-transparent via-meridian-gold/30 to-transparent" />

        {/* Decisions Section */}
        {isConnected && (
          <section>
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
