import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export interface SortableHeaderProps {
  label: ReactNode;
  columnKey?: string;
  sortKey?: string;
  direction?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  /** Keep false unless the current data source supports sorting by this column. */
  sortable?: boolean;
  className?: string;
}

export default function SortableHeader({ label, columnKey, sortKey, direction = 'asc', onSort, sortable = false, className = '' }: SortableHeaderProps) {
  const enabled = sortable && Boolean(columnKey) && Boolean(onSort);
  const active = enabled && sortKey === columnKey;
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';

  return <th scope="col" aria-sort={enabled ? ariaSort : undefined} className={`px-4 py-3 text-left font-sans text-sm font-semibold text-[var(--muted)] ${className}`}>
    {enabled ? <button type="button" onClick={() => onSort?.(columnKey!)} className="inline-flex items-center gap-2 text-left text-[var(--ink)] hover:text-[var(--blue)]">
      {label}
      {active ? direction === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" /> : <ArrowUpDown size={14} className="text-[var(--muted)]" aria-hidden="true" />}
    </button> : label}
  </th>;
}
