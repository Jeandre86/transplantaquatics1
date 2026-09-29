import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { meets } from '../data/meets';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <PageHeading eyebrow="Schedule" title="Meet calendar" description="Browse transplant swimming competitions and add your meet results." />
      <section className="mx-auto max-w-7xl px-4 py-12">
        {meets.length ? (
          <div className="space-y-3">
            {meets.map(meet => <Link key={meet.id} to={`/meets/${meet.id}`} className="flex items-center gap-4 border-b border-[var(--border)] py-5 text-[var(--ink)] hover:text-[var(--blue)]"><CalendarDays size={20} /><span className="font-semibold">{meet.name}</span><span className="ml-auto text-sm text-[var(--muted)]">{meet.date} · {meet.location}</span></Link>)}
          </div>
        ) : (
          <EmptyState title="No meets listed yet" subtitle="The calendar is ready. Meets will appear here when verified event details are added." />
        )}
      </section>
    </div>
  );
}
