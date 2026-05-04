export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 ${className}`} />;
}

export function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-neutral-200" style={{ width: `${60 + (i % 3) * 15}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-surface-raised p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-5 w-2/5 rounded bg-neutral-200" />
        <div className="h-5 w-16 rounded-full bg-neutral-200" />
      </div>
      <div className="h-4 w-1/4 rounded bg-neutral-200" />
      <div className="h-8 w-40 rounded bg-neutral-100" />
    </div>
  );
}
