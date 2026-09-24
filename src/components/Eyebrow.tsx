import type { ReactNode } from 'react';

interface EyebrowProps {
  children: ReactNode;
  /** Pass `onDark` when the eyebrow sits on a dark navy / hero section */
  onDark?: boolean;
  /** Pass `light` (legacy alias for onDark) — kept for backwards compatibility */
  light?: boolean;
  color?: 'default' | 'accent';
  className?: string;
}

export default function Eyebrow({ children, onDark, light, color, className = '' }: EyebrowProps) {
  const isDark = onDark || light;
  const textColor = color === 'accent'
    ? 'var(--accent)'
    : isDark
      ? 'var(--muted-on-dark)'
      : 'var(--muted)';

  return (
    <p
      className={`font-mono text-xs tracking-widest uppercase ${className}`}
      style={{ color: textColor }}
    >
      {children}
    </p>
  );
}
