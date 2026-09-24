// ─── Base Skeleton ────────────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={['skeleton rounded', className].filter(Boolean).join(' ')} />;
}

// ─── SkeletonCard — matches AthleteCard dimensions ────────────────────────────
export function SkeletonCard() {
  return (
    <div
      className="p-4 flex flex-col gap-3"
      style={{ border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}
    >
      {/* Avatar placeholder */}
      <Skeleton className="h-40 w-full rounded-none" />
      {/* Name */}
      <Skeleton className="h-4 w-3/4" />
      {/* Country / event line */}
      <Skeleton className="h-3 w-1/2" />
      {/* Time chip */}
      <Skeleton className="h-6 w-24 mt-1" />
    </div>
  );
}

// ─── SkeletonTable — N rows of skeleton data rows ─────────────────────────────
interface SkeletonTableProps {
  rows?: number;
}

export function SkeletonTable({ rows = 5 }: SkeletonTableProps) {
  return (
    <div className="flex flex-col" style={{ border: '1px solid var(--navy-light)' }}>
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-4 py-2"
        style={{ borderBottom: '1px solid var(--navy-light)', backgroundColor: 'var(--navy)' }}
      >
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20 ml-auto" />
        <Skeleton className="h-3 w-16" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3"
          style={{
            borderBottom: i < rows - 1 ? '1px solid var(--navy-light)' : 'none',
            backgroundColor: i % 2 === 0 ? 'var(--navy-mid)' : 'var(--navy)',
          }}
        >
          <Skeleton className="h-3 w-6 shrink-0" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-10 ml-auto shrink-0" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
