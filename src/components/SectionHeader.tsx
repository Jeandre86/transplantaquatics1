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
        <h2 className={`text-3xl md:text-4xl font-black tracking-tight leading-tight ${light ? 'text-white' : 'text-black'}`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`mt-2 text-sm leading-relaxed ${light ? 'text-neutral-400' : 'text-neutral-600'}`}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
