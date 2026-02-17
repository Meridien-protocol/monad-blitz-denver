"use client";

import { useState, useEffect, useCallback } from "react";

const CURTAIN_SESSION_KEY = "meridian_curtain_shown";

interface LoadingCurtainProps {
  isReady: boolean;
}

export default function LoadingCurtain({ isReady }: LoadingCurtainProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [fading, setFading] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(CURTAIN_SESSION_KEY)) {
        setShouldShow(true);
      } else {
        setRemoved(true);
      }
    } catch {
      setRemoved(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !shouldShow) return;
    // Mark session so curtain doesn't show again
    try {
      sessionStorage.setItem(CURTAIN_SESSION_KEY, "1");
    } catch {}
    // Small delay so the background has a frame painted
    const t = setTimeout(() => setFading(true), 100);
    return () => clearTimeout(t);
  }, [isReady, shouldShow]);

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
      <div className="curtain-spin h-20 w-20 sm:h-28 sm:w-28">
        <img
          src="/meridian-logo.svg"
          alt=""
          className="h-full w-full"
          draggable={false}
        />
      </div>

      {/* Subtle label */}
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.35em] text-neutral-500 sm:text-[11px]">
        [ Meridian ]
      </p>
    </div>
  );
}
