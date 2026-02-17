interface DeltaDisplayProps {
  proposals: Array<{ title: string; welfare: number }>;
}

export function DeltaDisplay({ proposals }: DeltaDisplayProps) {
  if (proposals.length < 2) {
    return null;
  }

  const sorted = [...proposals].sort((a, b) => b.welfare - a.welfare);
  const leader = sorted[0];
  const runner = sorted[1];
  const delta = ((leader.welfare - runner.welfare) / 100).toFixed(1);

  if (leader.welfare === runner.welfare) {
    return (
      <div className="rounded-md border border-meridian-border bg-meridian-surface/50 px-4 py-3 text-sm text-neutral-400">
        <span className="font-medium text-neutral-200">{leader.title}</span>
        {" and "}
        <span className="font-medium text-neutral-200">{runner.title}</span>
        {" are tied"}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-meridian-border bg-meridian-surface/50 px-4 py-3 text-sm text-neutral-400">
      <span className="font-medium text-meridian-gold">{leader.title}</span>
      {" leads "}
      <span className="font-medium text-neutral-200">{runner.title}</span>
      {" by "}
      <span className="font-mono font-semibold text-white">{delta}</span>
      {" points"}
    </div>
  );
}
