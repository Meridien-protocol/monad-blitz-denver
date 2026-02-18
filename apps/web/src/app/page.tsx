"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DitheredConnectButton } from "@/components/DitheredConnectButton";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { StatusBadge } from "@/components/StatusBadge";
import { useNextDecisionId, useDecisions } from "@/hooks/useContract";
import dynamic from "next/dynamic";
import { DitheredCard } from "@/components/DitheredCard";

const DitheredImage = dynamic(() => import("@/components/DitheredImage"), { ssr: false });
const SplitText = dynamic(() => import("@/components/SplitText"), { ssr: false });
const LoadingCurtain = dynamic(() => import("@/components/LoadingCurtain"), { ssr: false });

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

interface DecisionItem {
  id: number;
  creator: string;
  deadline: number | bigint;
  totalDeposits: bigint;
  proposalCount: number;
  status: number;
  title: string;
}

function DecisionCard({ decision: d }: { decision: DecisionItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <DitheredCard variant="gold">
    <Link
      href={`/decisions/${d.id}`}
      className="block rounded-[calc(0.5rem-2px)] bg-meridian-surface/80 backdrop-blur-sm p-3.5 transition-colors sm:p-5"
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-white sm:text-base">
            {d.title}
          </span>
          <div className="mt-1.5 flex items-center gap-2 sm:mt-2">
            <span className="text-[11px] text-neutral-500 sm:text-xs">
              {d.proposalCount} proposal{d.proposalCount !== 1 ? "s" : ""}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              className="rounded border border-meridian-border px-2 py-0.5 text-[10px] text-neutral-400 transition-colors hover:border-meridian-gold/40 hover:text-meridian-gold sm:text-[11px]"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          </div>
        </div>
        <StatusBadge status={d.status} />
      </div>

      {expanded && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-meridian-border/50 pt-3 text-[11px] text-neutral-500 sm:text-xs">
          <span>Deadline block: {d.deadline.toString()}</span>
          <span>Deposits: {formatEther(d.totalDeposits)} MON</span>
          <span>Creator: {d.creator.slice(0, 6)}...{d.creator.slice(-4)}</span>
        </div>
      )}
    </Link>
  </DitheredCard>
  );
}

export default function Home() {
  const isMobile = useIsMobile();
  const [bgReady, setBgReady] = useState(false);
  const handleBgReady = useCallback(() => setBgReady(true), []);
  const { isConnected } = useAccount();
  const { data: nextId } = useNextDecisionId();
  const count = nextId ? Number(nextId) : 0;
  const { data: decisionsData, isLoading } = useDecisions(count);

  // Decision tuple: [creator, title, deadline, createdAtBlock, proposalCount, totalDeposits, totalLPLiquidity, collectedFees, status, winningProposalId]
  const decisions =
    decisionsData
      ?.map((d, i) => {
        if (d.status !== "success" || !d.result) return null;
        const [creator, title, deadline, , proposalCount, totalDeposits, , , status] = d.result;
        return { id: i, creator: creator as string, deadline, totalDeposits: totalDeposits as bigint, proposalCount: Number(proposalCount), status: status as number, title: title as string };
      })
      .filter(Boolean) ?? [];

  return (
    <>
      <LoadingCurtain isReady={bgReady} />

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
          onReady={handleBgReady}
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

          <SplitText
            text="Vote the Future into Being"
            className="mt-4 text-4xl leading-[1.1] text-white sm:mt-5 sm:text-5xl md:text-7xl lg:text-8xl"
            tag="h1"
            splitType="words"
            delay={80}
            duration={0.8}
            ease="power3.out"
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            textAlign="center"
            threshold={0.1}
            rootMargin="-50px"
          />

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
              <DitheredConnectButton />
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
              <Link href="/decisions/create" className="cta-link">
                <span className="cta-text">Create Decision</span>
                <svg xmlns="http://www.w3.org/2000/svg" width={30} height={10} viewBox="0 0 46 16">
                  <path d="M8,0,6.545,1.455l5.506,5.506H-30V9.039H12.052L6.545,14.545,8,16l8-8Z" transform="translate(30)" />
                </svg>
              </Link>
            </div>

            {isLoading ? (
              <div className="animate-pulse text-neutral-500">
                Loading decisions...
              </div>
            ) : decisions.length === 0 ? (
              <DitheredCard variant="gold" innerClassName="bg-meridian-surface/80 backdrop-blur-sm p-6 text-center sm:p-8">
                <p className="text-xs text-neutral-400 sm:text-sm">
                  No decisions yet. Create the first one to get started.
                </p>
              </DitheredCard>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {decisions.map((d) => (
                  <DecisionCard key={d!.id} decision={d!} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
