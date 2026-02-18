import { DecisionStatus } from "@meridian/shared";

interface StatusBadgeProps {
  status: number;
}

const STATUS_CONFIG: Record<number, { label: string; className: string }> = {
  [DecisionStatus.OPEN]: {
    label: "OPEN",
    className: "border-yes/30 bg-yes/10 text-yes",
  },
  [DecisionStatus.COLLAPSED]: {
    label: "COLLAPSED",
    className: "border-meridian-gold/30 bg-meridian-gold/10 text-meridian-gold",
  },
  [DecisionStatus.SETTLED]: {
    label: "SETTLED",
    className: "border-neutral-500/30 bg-neutral-500/10 text-neutral-400",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: "UNKNOWN",
    className: "border-neutral-600/30 bg-neutral-600/10 text-neutral-500",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide ${config.className}`}
    >
      {config.label}
    </span>
  );
}
