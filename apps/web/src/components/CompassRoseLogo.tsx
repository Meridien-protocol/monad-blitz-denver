"use client";

import { useEffect, useRef, useState } from "react";

interface CompassRoseLogoProps {
  size?: number;
}

export function CompassRoseLogo({ size = 26 }: CompassRoseLogoProps) {
  const needleRef = useRef<SVGGElement>(null);
  const [mounted, setMounted] = useState(false);
  const initialRotation = useRef(Math.floor(Math.random() * 270) + 45);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rotation = mounted ? 0 : initialRotation.current;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Meridian compass rose"
    >
      <circle
        cx="13"
        cy="13"
        r="12"
        stroke="rgba(212,168,83,0.4)"
        strokeWidth="1"
      />
      <circle
        cx="13"
        cy="13"
        r="8"
        stroke="rgba(212,168,83,0.2)"
        strokeWidth="0.5"
      />
      <path
        d="M13 1 L13 25"
        stroke="rgba(212,168,83,0.15)"
        strokeWidth="0.5"
      />
      <path
        d="M1 13 L25 13"
        stroke="rgba(212,168,83,0.15)"
        strokeWidth="0.5"
      />
      <g
        ref={needleRef}
        style={{
          transformOrigin: "13px 13px",
          transform: `rotate(${rotation}deg)`,
          transition: mounted ? "transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
        }}
      >
        <path
          d="M13 5 L15 13 L13 21 L11 13 Z"
          fill="#D4A853"
          fillOpacity="0.8"
        />
        <path
          d="M5 13 L13 11 L21 13 L13 15 Z"
          fill="#D4A853"
          fillOpacity="0.3"
        />
      </g>
      <circle cx="13" cy="13" r="1.5" fill="#D4A853" />
    </svg>
  );
}
