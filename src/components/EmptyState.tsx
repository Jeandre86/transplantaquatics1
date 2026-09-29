import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onDark?: boolean;
  action?: ReactNode;
}

export default function EmptyState({ title, subtitle, icon, onDark = false, action }: EmptyStateProps) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center border border-dashed px-6 py-14 text-center ${onDark ? 'border-[var(--navy-light)] bg-[var(--navy-mid)]' : 'border-[var(--border)] bg-[var(--paper-dark)]'}`}>
      {icon && <div className={`mb-4 ${onDark ? 'text-[var(--accent)]' : 'text-[var(--accent-dark)]'}`}>{icon}</div>}
      {!icon && (
        <div className={`mb-4 flex size-11 items-center justify-center border ${onDark ? 'border-[var(--navy-light)]' : 'border-[var(--border)]'}`} aria-hidden="true">
          <div className={`h-0.5 w-4 ${onDark ? 'bg-[var(--muted-on-dark)]' : 'bg-[var(--muted)]'}`} />
        </div>
      )}
      <h3 className={`text-lg font-bold ${onDark ? 'text-[var(--ink-on-dark)]' : 'text-[var(--ink)]'}`}>{title}</h3>
      {subtitle && <p className={`mt-2 max-w-md text-sm leading-relaxed ${onDark ? 'text-[var(--muted-on-dark)]' : 'text-[var(--muted)]'}`}>{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
