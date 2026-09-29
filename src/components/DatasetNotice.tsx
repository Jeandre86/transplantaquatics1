import { Info } from 'lucide-react';

export default function DatasetNotice() {
  return (
    <div className="inline-flex max-w-full items-start gap-2 border border-[var(--border)] bg-[var(--paper-dark)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]" role="note">
      <Info size={14} className="mt-0.5 shrink-0 text-[var(--accent-dark)]" aria-hidden="true" />
      <span><strong className="font-semibold text-[var(--ink)]">Illustrative data.</strong> This demo uses sample entries and is not a live feed.</span>
    </div>
  );
}
