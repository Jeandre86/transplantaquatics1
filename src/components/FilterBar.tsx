import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

/** Shared filter/search layout. Pair with SearchInput and FilterSelect to keep filter UI consistent across pages. */
export default function FilterBar({ children, className = '' }: FilterBarProps) {
  return <div className={`flex flex-col gap-4 ${className}`}>{children}</div>;
}
