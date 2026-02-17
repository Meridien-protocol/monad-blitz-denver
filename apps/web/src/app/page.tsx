"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { CompassRoseLogo } from "@/components/CompassRoseLogo";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-16">
        <section className="flex flex-col items-center gap-6 py-20 text-center">
          <CompassRoseLogo size={240} />
          <p className="max-w-md text-lg text-neutral-400">
            Quantum Futarchy on Monad. Capital-efficient prediction market
            governance where collective intelligence guides decisions.
          </p>

          {!isConnected ? (
            <div className="mt-8 flex flex-col items-center gap-4">
              <p className="text-sm text-neutral-500">
                Connect your wallet to view active decisions and start trading
              </p>
              <ConnectButton />
            </div>
          ) : (
            <div className="mt-8 w-full max-w-lg rounded-lg border border-meridian-border bg-meridian-surface p-8 text-center">
              <p className="text-sm text-neutral-400">
                No active decisions yet. Create a decision to get started, or
                check back when governance proposals are live.
              </p>
              <p className="mt-4 text-xs text-neutral-600">
                Decisions will appear here once they are created on-chain.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
