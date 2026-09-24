import type { VerificationStatus } from '../types';

interface VerificationBadgeProps {
  status: VerificationStatus;
}

export default function VerificationBadge({ status }: VerificationBadgeProps) {
  // Use bright colours that pass 4.5:1 on dark backgrounds
  // green-400 (#4ade80), amber-400 (#fbbf24), slate-400 (#94a3b8) all pass on --navy
  const config = {
    Verified:   { dot: '#22c55e', textClass: 'text-green-400',  label: 'Verified' },
    Pending:    { dot: '#f59e0b', textClass: 'text-amber-400',  label: 'Pending' },
    Unverified: { dot: '#94a3b8', textClass: 'text-neutral-400', label: 'Unverified' },
  };
  const c = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${c.textClass}`}>
      <span
        style={{ backgroundColor: c.dot, width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
      />
      {c.label}
    </span>
  );
}
