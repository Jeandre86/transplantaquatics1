interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label: string;
  totalCount?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

function pageItems(page: number, pageCount: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis-end', pageCount];
  if (page >= pageCount - 3) return [1, 'ellipsis-start', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  return [1, 'ellipsis-start', page - 1, page, page + 1, 'ellipsis-end', pageCount];
}

export default function Pagination({ page, pageCount, onPageChange, label, totalCount, pageSize, pageSizeOptions, onPageSizeChange }: PaginationProps) {
  if (pageCount <= 1 && totalCount === undefined && !(pageSizeOptions && onPageSizeChange)) return null;
  const pages = pageItems(page, pageCount);
  const first = totalCount === undefined || pageSize === undefined ? undefined : Math.min((page - 1) * pageSize + 1, totalCount);
  const last = totalCount === undefined || pageSize === undefined ? undefined : Math.min(page * pageSize, totalCount);

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-between gap-3" aria-label={label}>
      {first !== undefined && last !== undefined && <p className="text-sm text-[var(--muted)]" aria-live="polite">Showing {first}–{last} of {totalCount?.toLocaleString()}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="ta-pagination-button border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent-dark)] hover:bg-[var(--ice)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      {pages.map(item => item === 'ellipsis-start' || item === 'ellipsis-end'
        ? <span key={item} className="px-1 text-[var(--muted)]" aria-hidden="true">…</span>
        : <button key={item} type="button" onClick={() => onPageChange(item)} aria-current={page === item ? 'page' : undefined} aria-label={`Page ${item}`} className={`min-w-9 border px-3 py-2 font-sans text-sm transition-colors ${page === item ? 'border-[var(--navy)] bg-[var(--navy)] font-semibold text-white' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent-dark)] hover:bg-[var(--ice)]'}`}>{item}</button>)}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        className="ta-pagination-button border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-sans text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent-dark)] hover:bg-[var(--ice)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
      </div>
      {pageSizeOptions && onPageSizeChange && pageSize !== undefined && <label className="flex items-center gap-2 text-sm text-[var(--muted)]">Rows per page
        <select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))} className="border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--ink)]">
          {pageSizeOptions.map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>}
    </nav>
  );
}
