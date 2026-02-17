"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CompassRoseLogo } from "@/components/CompassRoseLogo";
import { BlockHeartbeat } from "@/components/BlockHeartbeat";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-meridian-border bg-meridian-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <CompassRoseLogo size={28} />
          <span className="text-lg font-semibold tracking-tight text-meridian-gold">
            Meridian
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <BlockHeartbeat />
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </div>
    </header>
  );
}
