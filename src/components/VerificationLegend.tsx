import type { VerificationStatus } from '../types';
import VerificationBadge from './VerificationBadge';

const STATUSES: VerificationStatus[] = ['Verified', 'Pending', 'Unverified'];

export default function VerificationLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Result verification status key">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Status key</span>
      {STATUSES.map(status => <VerificationBadge key={status} status={status} />)}
    </div>
  );
}
