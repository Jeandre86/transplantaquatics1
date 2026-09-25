import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onDark?: boolean;
}

export default function EmptyState({ title, subtitle, icon, onDark = false }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && <div className="text-neutral-400 mb-4">{icon}</div>}
      {!icon && (
        <div className="w-12 h-12 border-2 border-neutral-400 flex items-center justify-center mb-4">
          <div className="w-4 h-0.5 bg-neutral-400" />
        </div>
      )}
      <h3 className={`font-bold text-lg ${onDark ? 'text-white' : 'text-neutral-900'}`}>{title}</h3>
      {subtitle && <p className={`mt-1 text-sm max-w-xs ${onDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{subtitle}</p>}
    </div>
  );
}
