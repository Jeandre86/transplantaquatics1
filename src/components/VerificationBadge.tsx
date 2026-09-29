import type { VerificationStatus } from '../types';

interface VerificationBadgeProps {
  status: VerificationStatus;
  dark?: boolean;
}

export default function VerificationBadge({ status, dark = false }: VerificationBadgeProps) {
  const config = {
    Verified:   { dot: dark ? '#4ade80' : '#15803d', text: dark ? '#4ade80' : '#166534', label: 'Verified' },
    Pending:    { dot: dark ? '#fbbf24' : '#b45309', text: dark ? '#fbbf24' : '#92400e', label: 'Pending' },
    Unverified: { dot: dark ? '#cbd5e1' : '#475569', text: dark ? '#cbd5e1' : '#475569', label: 'Unverified' },
  };
  const c = config[status];

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-1 font-mono text-[10px] uppercase tracking-wide" style={{ color: c.text, borderColor: dark ? `${c.dot}55` : `${c.dot}40`, backgroundColor: dark ? `${c.dot}12` : `${c.dot}08` }}>
      <span
        aria-hidden="true"
        style={{ backgroundColor: c.dot, width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
      />
      {c.label}
    </span>
  );
}
