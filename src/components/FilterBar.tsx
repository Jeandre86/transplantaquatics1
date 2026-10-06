import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  search?: ReactNode;
}

/** Shared filter/search layout. Pair with SearchInput and FilterSelect to keep filter UI consistent across pages. */
export default function FilterBar({ children, className = '', collapsible = false, search }: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(true);
  if (!collapsible) return <div className={`ta-filter-bar flex flex-col gap-4 ${className}`}>{children}</div>;

  return <div className={`ta-filter-bar flex flex-col gap-4 ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      {search}
      <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)} className="inline-flex shrink-0 items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--blue)]">
        <SlidersHorizontal size={15} aria-hidden="true" />{filtersOpen ? 'Hide filters' : 'Show filters'}
      </button>
    </div>
    {filtersOpen && <div className="flex flex-col gap-4">{children}</div>}
  </div>;
}
