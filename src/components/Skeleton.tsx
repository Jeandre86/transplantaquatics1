// ─── Base Skeleton ────────────────────────────────────────────────────────────
interface SkeletonProps {
  className?: string;
  dark?: boolean;
}

export function Skeleton({ className, dark = false }: SkeletonProps) {
  return <div className={['skeleton rounded', dark ? 'skeleton-dark' : '', className].filter(Boolean).join(' ')} />;
}

// ─── SkeletonCard — matches AthleteCard dimensions ────────────────────────────
export function SkeletonCard() {
  return (
    <div
      className="p-4 flex flex-col gap-3"
      style={{ border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}
    >
      {/* Avatar placeholder */}
      <Skeleton dark className="h-40 w-full rounded-none" />
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
  columns?: number;
  dark?: boolean;
}

export function SkeletonTable({ rows = 5, columns = 6, dark = false }: SkeletonTableProps) {
  const columnCount = Math.max(1, columns);
  const gridTemplateColumns = columnCount === 1 ? 'minmax(0, 1fr)' : `minmax(7rem, 1.6fr) repeat(${columnCount - 1}, minmax(4rem, 1fr))`;

  return (
    <div className="ta-table-shell w-full overflow-hidden" role="status" aria-busy="true" aria-label="Loading table data">
      <div className="grid items-center gap-4 px-4 py-3 sm:px-5" style={{ gridTemplateColumns, backgroundColor: 'var(--navy)' }}>
        {Array.from({ length: columnCount }, (_, index) => <Skeleton key={`header-${index}`} dark className={`h-3 ${index === 0 ? 'w-3/4' : 'w-1/2'}`} />)}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="grid items-center gap-4 px-4 py-4 sm:px-5" style={{ gridTemplateColumns, backgroundColor: dark ? (rowIndex % 2 ? 'var(--navy)' : 'var(--navy-mid)') : (rowIndex % 2 ? 'var(--paper)' : 'var(--surface)') }}>
          {Array.from({ length: columnCount }, (_, columnIndex) => <Skeleton key={`${rowIndex}-${columnIndex}`} dark={dark} className={`h-3 ${columnIndex === 0 ? 'w-4/5' : columnIndex === columnCount - 1 ? 'w-2/3' : 'w-1/2'}`} />)}
        </div>
      ))}
      <span className="sr-only">Loading table data…</span>
    </div>
  );
}

export default Skeleton;
