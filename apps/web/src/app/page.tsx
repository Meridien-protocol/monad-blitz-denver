"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { StatusBadge } from "@/components/StatusBadge";
import { useNextDecisionId, useDecisions } from "@/hooks/useContract";
import dynamic from "next/dynamic";

const DitheredImage = dynamic(() => import("@/components/DitheredImage"), { ssr: false });

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}

function Crosshair({ className }: { className?: string }) {
  return (
    <span className={`absolute select-none text-[10px] text-white/30 ${className ?? ""}`}>
      +
    </span>
  );
}

export default function Home() {
  const isMobile = useIsMobile();
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
      {/* Full-screen dithered background */}
      <div className="fixed inset-0 z-0">
        <DitheredImage
          src="/revolution.png"
          colorNum={4}
          pixelSize={isMobile ? 2 : 3}
          distortion={0.003}
          tint={[1.3, 1.05, 0.8]}
          tintStrength={0.35}
          focusX={isMobile ? 0.55 : 0.5}
          focusY={isMobile ? 0.35 : 0.5}
        />
        {/* Darkening overlay for readability */}
        <div className="pointer-events-none absolute inset-0 bg-meridian-bg/60" />
        {/* Bottom gradient fade */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-meridian-bg via-transparent to-meridian-bg/40" />

        {/* Crosshair markers -- hidden on small screens to reduce clutter */}
        <Crosshair className="hidden sm:block left-[8%] top-[12%]" />
        <Crosshair className="hidden sm:block right-[10%] top-[15%]" />
        <Crosshair className="left-[15%] bottom-[25%]" />
        <Crosshair className="right-[12%] bottom-[30%]" />
        <Crosshair className="hidden sm:block left-[50%] top-[8%]" />
        <Crosshair className="hidden sm:block right-[35%] bottom-[18%]" />
      </div>

      <main className="relative z-10 mx-auto max-w-5xl px-3 py-8 sm:px-4 sm:py-16">
        {/* Hero Section */}
        <section className="flex flex-col items-center pt-10 pb-0 sm:pt-24">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 sm:text-[11px] sm:tracking-[0.35em]">
            [ Meridian ]
          </p>

          <h1 className="mt-4 text-center text-4xl leading-[1.1] text-white sm:mt-5 sm:text-5xl md:text-7xl lg:text-8xl">
            <span className="font-serif italic text-meridian-gold">Vote</span>{" "}
            the Future
            <br />
            into Being
          </h1>

          <div className="mt-4 font-mono text-[9px] uppercase tracking-wider text-white/70 sm:mt-6 sm:text-[10px] md:text-xs">
            <span className="text-white/50">[ Quantum Futarchy ]</span>{" "}
            <span className="text-meridian-gold/80">on Monad</span>
          </div>

          <p className="mt-6 max-w-lg px-2 text-center text-xs leading-relaxed text-neutral-400 sm:mt-8 sm:px-0 sm:text-sm">
            Capital-efficient prediction market governance where
            collective intelligence guides every decision.
          </p>

          {!isConnected && (
            <div className="mt-5 flex flex-col items-center gap-4 sm:mt-6">
              <ConnectButton />
            </div>
          )}
        </section>

        {/* Thin separator line */}
        <div className="mx-auto my-10 h-px w-full max-w-md bg-gradient-to-r from-transparent via-meridian-gold/30 to-transparent sm:my-16" />

        {/* Decisions Section */}
        {isConnected && (
          <section>
            <div className="mb-4 flex items-center justify-between sm:mb-6">
              <h2 className="text-base font-semibold text-neutral-300 sm:text-lg">
                Decisions{count > 0 ? ` (${count})` : ""}
              </h2>
              <Link
                href="/decisions/create"
                className="rounded bg-meridian-gold px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-meridian-gold/90 sm:px-4 sm:py-2 sm:text-sm"
              >
                Create Decision
              </Link>
            </div>

            {isLoading ? (
              <div className="animate-pulse text-neutral-500">
                Loading decisions...
              </div>
            ) : decisions.length === 0 ? (
              <div className="rounded-lg border border-meridian-border bg-meridian-surface/80 backdrop-blur-sm p-6 text-center sm:p-8">
                <p className="text-xs text-neutral-400 sm:text-sm">
                  No decisions yet. Create the first one to get started.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {decisions.map((d) => (
                  <Link
                    key={d!.id}
                    href={`/decisions/${d!.id}`}
                    className="group rounded-lg border border-meridian-border bg-meridian-surface/80 backdrop-blur-sm p-3.5 transition-colors hover:border-meridian-gold/40 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-white group-hover:text-meridian-gold sm:text-base">
                          {d!.title}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500 sm:mt-2 sm:gap-4 sm:text-xs">
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
