import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}

export default function EmptyState({ title, subtitle, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && <div className="text-neutral-400 mb-4">{icon}</div>}
      {!icon && (
        <div className="w-12 h-12 border-2 border-neutral-400 flex items-center justify-center mb-4">
          <div className="w-4 h-0.5 bg-neutral-400" />
        </div>
      )}
      {/* text-white — clear heading on dark bg */}
      <h3 className="font-bold text-lg text-white">{title}</h3>
      {/* neutral-400 (#8fa5b5) — passes 4.5:1 on dark bg */}
      {subtitle && <p className="mt-1 text-sm text-neutral-400 max-w-xs">{subtitle}</p>}
    </div>
  );
}
