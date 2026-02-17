"use client";

import { useState, useEffect, useCallback } from "react";

interface LoadingCurtainProps {
  isReady: boolean;
}

export default function LoadingCurtain({ isReady }: LoadingCurtainProps) {
  const [fading, setFading] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const t = setTimeout(() => setFading(true), 100);
    return () => clearTimeout(t);
  }, [isReady]);

  const handleTransitionEnd = useCallback(() => {
    if (fading) setRemoved(true);
  }, [fading]);

  if (removed) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0A0F] transition-opacity duration-700 ease-out ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Spinning compass */}
      <div className="curtain-spin h-16 w-16 sm:h-24 sm:w-24 md:h-28 md:w-28">
        <img
          src="/meridian-logo.svg"
          alt=""
          className="h-full w-full"
          draggable={false}
        />
      </div>

      {/* Subtle label */}
      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.3em] text-neutral-500 sm:mt-6 sm:text-[10px] sm:tracking-[0.35em] md:text-[11px]">
        [ Meridian ]
      </p>
    </div>
  );
}
