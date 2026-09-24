import type { TransplantType } from '../types';
import { getTransplantColor } from '../lib/utils';

interface TransplantBadgeProps {
  type: TransplantType;
  size?: 'sm' | 'md';
  /** onDark = true when badge sits on dark navy */
  onDark?: boolean;
}

export default function TransplantBadge({ type, size = 'sm', onDark }: TransplantBadgeProps) {
  const color = getTransplantColor(type);
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
      style={{ color: onDark ? 'var(--muted-on-dark)' : 'var(--muted)' }}
    >
      <span
        style={{
          backgroundColor: color,
          width: size === 'sm' ? 7 : 9,
          height: size === 'sm' ? 7 : 9,
          borderRadius: '50%',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {type}
    </span>
  );
}
