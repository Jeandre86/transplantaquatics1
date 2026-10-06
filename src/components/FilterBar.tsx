import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';

export interface FilterBarActiveFilter {
  key: string;
  label: string;
  value: string;
  defaultValue?: string;
  queryParam?: string;
  onRemove?: () => void;
}

export interface FilterBarResultCount {
  total: number;
  noun?: string;
}

interface FilterBarProps {
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  search?: ReactNode;
  compact?: boolean;
  activeFilters?: FilterBarActiveFilter[];
  onClearAll?: () => void;
  resultCount?: FilterBarResultCount;
}

/** Shared filter/search layout. Pair with SearchInput and FilterSelect to keep filter UI consistent across pages. */
export default function FilterBar({ children, className = '', collapsible = false, search, compact = false, activeFilters = [], onClearAll, resultCount }: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const visibleFilters = activeFilters.filter(filter => filter.value !== (filter.defaultValue ?? ''));

  const removeFilter = (filter: FilterBarActiveFilter) => {
    filter.onRemove?.();
    if (!filter.queryParam) return;
    const next = new URLSearchParams(searchParams);
    next.delete(filter.queryParam);
    setSearchParams(next);
  };

  const clearFilters = () => {
    onClearAll?.();
    const params = activeFilters.map(filter => filter.queryParam).filter((key): key is string => Boolean(key));
    if (!params.length) return;
    const next = new URLSearchParams(searchParams);
    params.forEach(key => next.delete(key));
    setSearchParams(next);
  };

  const filters = <div className={`flex ${compact ? 'flex-wrap items-end gap-3' : 'flex-col gap-4'}`}>{children}</div>;
  const extras = <>
    {visibleFilters.length > 0 && <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {visibleFilters.map(filter => <span key={filter.key} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink)]">
        <span>{filter.label}: {filter.value}</span>
        <button type="button" aria-label={`Remove ${filter.label} filter`} onClick={() => removeFilter(filter)} className="rounded-full p-0.5 text-[var(--muted)] hover:text-[var(--ink)]"><X size={13} aria-hidden="true" /></button>
      </span>)}
      <button type="button" onClick={clearFilters} className="px-2 py-1 text-xs font-semibold text-[var(--blue)] hover:underline">Clear all</button>
    </div>}
    {resultCount && <p className="text-xs text-[var(--muted)]" aria-live="polite">{resultCount.total.toLocaleString()} {resultCount.noun ?? 'results'}</p>}
  </>;

  if (!collapsible) return <div className={`ta-filter-bar flex flex-col gap-4 ${className}`}>
    {compact ? <div className="flex flex-wrap items-end gap-3">{search}{filters}</div> : <>{filters}{search}</>}
    {extras}
  </div>;

  return <div className={`ta-filter-bar flex flex-col gap-4 ${className}`}>
    <div className={`flex flex-wrap ${compact ? 'items-end' : 'items-center justify-between'} gap-3`}>
      {search}
      <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)} className="inline-flex shrink-0 items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--blue)]">
        <SlidersHorizontal size={15} aria-hidden="true" />{filtersOpen ? 'Hide filters' : 'Show filters'}
      </button>
    </div>
    {filtersOpen && filters}
    {extras}
  </div>;
}
