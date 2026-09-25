interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label: string;
}

export default function Pagination({ page, pageCount, onPageChange, label }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label={label}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="border border-neutral-300 px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span className="font-mono text-xs text-neutral-600">Page {page} of {pageCount}</span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        className="border border-neutral-300 px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
