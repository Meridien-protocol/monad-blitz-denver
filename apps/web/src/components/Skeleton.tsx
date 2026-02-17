interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-meridian-surface ${className}`}
    />
  );
}

export function DecisionSkeleton() {
  return (
    <div className="rounded-lg border border-meridian-border bg-meridian-surface p-6">
      <Skeleton className="mb-3 h-5 w-24" />
      <Skeleton className="mb-2 h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function ProposalSkeleton() {
  return (
    <div className="rounded-lg border border-meridian-border bg-meridian-surface p-5">
      <Skeleton className="mb-3 h-5 w-2/3" />
      <Skeleton className="mb-2 h-2 w-full" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
