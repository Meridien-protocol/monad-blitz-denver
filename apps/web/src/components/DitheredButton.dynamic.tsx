"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { buttonVariants, type DitheredButtonProps } from "./DitheredButton";

const DitheredButton = dynamic(() =>
  import("./DitheredButton").then((m) => ({ default: m.DitheredButton })),
  {
    ssr: false,
    loading: ({ error }) => {
      if (error) return null;
      return (
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "gold", size: "md" }),
            "bg-meridian-surface",
          )}
          disabled
        >
          <span className="opacity-0">...</span>
        </button>
      );
    },
  },
);

export { DitheredButton };
export type { DitheredButtonProps };
