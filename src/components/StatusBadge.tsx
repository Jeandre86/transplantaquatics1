import type { VerificationStatus } from '../types';

interface StatusBadgeProps {
  status: VerificationStatus;
  className?: string;
}

const STYLE: Record<VerificationStatus, string> = {
  Verified: 'border-emerald-700/20 bg-emerald-50 text-emerald-800',
  Pending: 'border-amber-700/20 bg-amber-50 text-amber-800',
  Unverified: 'border-slate-500/20 bg-slate-100 text-slate-700',
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-sans text-xs font-medium ${STYLE[status]} ${className}`}>{status}</span>;
}
