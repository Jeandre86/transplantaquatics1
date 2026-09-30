import type { ReactNode } from 'react';
import Eyebrow from './Eyebrow';

interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export default function PageHeading({ eyebrow, title, description, children, className = '' }: PageHeadingProps) {
  return (
    <section className={`ta-page-top border-b border-[var(--navy-light)] ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 md:py-16">
        <Eyebrow color="accent" onDark>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-5xl text-4xl font-extrabold leading-[1.08] tracking-tight text-[var(--ink-on-dark)] sm:text-5xl lg:text-6xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-on-dark)] sm:text-base">{description}</p>}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </section>
  );
}
