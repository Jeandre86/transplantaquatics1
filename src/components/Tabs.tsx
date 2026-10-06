import { useSearchParams } from 'react-router-dom';

export interface TabOption {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabOption[];
  defaultValue: string;
  queryParam?: string;
  label?: string;
  className?: string;
  replaceHistory?: boolean;
}

export default function Tabs({ tabs, defaultValue, queryParam = 'tab', label = 'Sections', className = '', replaceHistory = false }: TabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(queryParam);
  const activeValue = tabs.some(tab => tab.value === requested && !tab.disabled) ? requested! : defaultValue;

  const selectTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue) next.delete(queryParam);
    else next.set(queryParam, value);
    setSearchParams(next, { replace: replaceHistory });
  };

  return <div role="tablist" aria-label={label} className={`flex flex-wrap gap-1 border-b border-[var(--border)] ${className}`}>
    {tabs.map(tab => <button key={tab.value} type="button" role="tab" aria-selected={activeValue === tab.value} disabled={tab.disabled} onClick={() => selectTab(tab.value)} className={`border-b-2 px-4 py-3 font-sans text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${activeValue === tab.value ? 'border-[var(--blue)] font-semibold text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
      {tab.label}{tab.count !== undefined && <span className="ml-2 text-xs text-[var(--muted)]">{tab.count}</span>}
    </button>)}
  </div>;
}
