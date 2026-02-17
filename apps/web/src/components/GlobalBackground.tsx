"use client";

import dynamic from "next/dynamic";

const DitheredImage = dynamic(() => import("@/components/DitheredImage"), {
  ssr: false,
});

export function GlobalBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.12]">
      <DitheredImage
        src="/revolution.png"
        colorNum={4}
        pixelSize={3}
        distortion={0.002}
        tint={[1.3, 1.05, 0.8]}
        tintStrength={0.35}
        focusX={0.5}
        focusY={0.5}
      />
    </div>
  );
}
