"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

interface CompassRoseLogoProps {
  size?: number;
  className?: string;
}

export function CompassRoseLogo({ size = 26, className }: CompassRoseLogoProps) {
  const [rotation, setRotation] = useState(0);

  const handleClick = useCallback(() => {
    setRotation((prev) => prev + 360);
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`cursor-pointer bg-transparent border-none p-0 ${className ?? ""}`}
    >
      <Image
        src="/meridian-logo.svg"
        alt="Meridian"
        width={size}
        height={Math.round(size * (4011 / 4181))}
        priority
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: "transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />
    </button>
  );
}
