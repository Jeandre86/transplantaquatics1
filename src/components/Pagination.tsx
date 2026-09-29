interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label: string;
}

export default function Pagination({ page, pageCount, onPageChange, label }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-3" aria-label={label}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="ta-pagination-button border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--ink)] transition-colors hover:border-[var(--accent-dark)] hover:bg-[var(--ice)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span className="px-2 font-mono text-xs text-[var(--muted)]" aria-live="polite">Page {page} of {pageCount}</span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        className="ta-pagination-button border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--ink)] transition-colors hover:border-[var(--accent-dark)] hover:bg-[var(--ice)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
