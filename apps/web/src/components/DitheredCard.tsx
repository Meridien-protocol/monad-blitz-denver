"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant = "gold" | "neutral" | "yes" | "no" | "cyan" | "violet" | "amber";

const BORDER_COLORS: Record<Variant, string> = {
  gold: "#D4A853",
  yes: "#8BAA6E",
  no: "#C4604A",
  neutral: "#3C3C4A",
  cyan: "#67E8F9",
  violet: "#A78BFA",
  amber: "#F59E0B",
};

interface DitheredCardProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  innerClassName?: string;
}

export function DitheredCard({
  children,
  variant = "neutral",
  className,
  innerClassName,
}: DitheredCardProps) {
  const color = BORDER_COLORS[variant];

  return (
    <div
      className={cn("rounded-lg p-px overflow-hidden", className)}
      style={{
        backgroundImage: `repeating-conic-gradient(${color} 0% 25%, #0A0A0F 0% 50%)`,
        backgroundSize: "2px 2px",
      }}
    >
      <div
        className={cn(
          "rounded-[calc(0.5rem-1px)] bg-meridian-surface",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
