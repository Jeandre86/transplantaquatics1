import type { ReactNode } from 'react';
import Eyebrow from './Eyebrow';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  light?: boolean;
  className?: string;
}

export default function SectionHeader({ eyebrow, title, subtitle, action, light = false, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-end md:justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && <Eyebrow light={light} className="mb-2">{eyebrow}</Eyebrow>}
        <h2 className={`text-2xl font-extrabold tracking-tight leading-tight sm:text-3xl md:text-4xl ${light ? 'text-[var(--ink-on-dark)]' : 'text-[var(--ink)]'}`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${light ? 'text-[var(--muted-on-dark)]' : 'text-[var(--muted)]'}`}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
