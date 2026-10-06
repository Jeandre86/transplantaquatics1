import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, RotateCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { loadMeetCatalog, type MeetCatalogCategory, type MeetCatalogEdition } from '../lib/meetCatalog';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';

const CATEGORIES: MeetCatalogCategory[] = [
  'World Transplant Games',
  'National Transplant Games',
];

function formatDate(date: string | null, endDate: string | null): string {
  if (!date) return 'Dates to be confirmed';
  const start = new Date(`${date}T00:00:00`);
  if (!endDate || endDate === date) return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(start);
  const end = new Date(`${endDate}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(start);
  const endLabel = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);
  return `${startLabel} – ${endLabel}`;
}

function statusLabel(status: MeetCatalogEdition['status']): string {
  if (status === 'date_unconfirmed') return 'Dates to be confirmed';
  return status.replace('_', ' ');
}

function MeetRow({ meet }: { meet: MeetCatalogEdition }) {
  const location = [meet.host_city, meet.host_country].filter(Boolean).join(', ');
  return <article className="grid gap-3 border-b border-[var(--border)] px-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center bg-[var(--ice)] text-[var(--blue)]"><CalendarDays size={18} /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">{meet.name}</h3>
          <span className={`font-mono text-[10px] uppercase tracking-wider ${meet.status === 'upcoming' || meet.status === 'in_progress' ? 'text-[var(--accent-dark)]' : 'text-[var(--muted)]'}`}>{statusLabel(meet.status)}</span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-[var(--muted)]">
          <span>{meet.year}</span>
          {location && <><span aria-hidden="true">·</span><MapPin size={13} aria-hidden="true" /><span>{location}</span></>}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-4 pl-[52px] sm:pl-0">
      <span className="text-sm text-[var(--ink)]">{formatDate(meet.meet_date, meet.end_date)}</span>
      {meet.source_url && <a href={meet.source_url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-[var(--blue)] hover:underline">Official details</a>}
    </div>
  </article>;
}

export default function CalendarPage() {
  const [meets, setMeets] = useState<MeetCatalogEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<'All' | MeetCatalogCategory>('All');
  const [year, setYear] = useState('All');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [pages, setPages] = useState<Record<MeetCatalogCategory, number>>({
    'World Transplant Games': 1,
    'National Transplant Games': 1,
  });

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    loadMeetCatalog()
      .then(setMeets)
      .catch(() => setError('The meet calendar could not be loaded. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const years = useMemo(() => [...new Set(meets.map(meet => String(meet.year)))].sort((a, b) => Number(b) - Number(a)), [meets]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return meets.filter(meet => {
      const matchesCategory = category === 'All' || meet.category === category;
      const matchesYear = year === 'All' || String(meet.year) === year;
      const searchable = [meet.name, meet.series_name, meet.year, meet.host_city, meet.host_country, meet.category].filter(Boolean).join(' ').toLocaleLowerCase();
      return matchesCategory && matchesYear && (!query || searchable.includes(query));
    });
  }, [meets, category, year, search]);
  const pageSize = 5;

  useEffect(() => {
    setPages({ 'World Transplant Games': 1, 'National Transplant Games': 1 });
  }, [category, year, search]);

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <PageHeading eyebrow="Schedule" title="Meet calendar" description="Browse World and National Transplant Games, see where and when they take place, and link your results to an official edition." />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col items-start gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Search meets
              <span className="flex min-w-56 items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--muted)] focus-within:border-[var(--blue)] sm:min-w-64">
                <Search size={15} aria-hidden="true" />
                <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, year, or location" className="h-10 min-w-0 flex-1 bg-transparent font-sans text-sm normal-case tracking-normal text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
                {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear meet search" className="text-[var(--muted)] hover:text-[var(--ink)]"><X size={14} /></button>}
              </span>
            </label>
            <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)} className="inline-flex h-10 items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--blue)]"><SlidersHorizontal size={15} aria-hidden="true" />{filtersOpen ? 'Hide filters' : 'Show filters'}</button>
            {filtersOpen && <>
            <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Competition
              <select value={category} onChange={event => setCategory(event.target.value as 'All' | MeetCatalogCategory)} className="min-w-48 border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-sans text-sm normal-case tracking-normal text-[var(--ink)]">
                <option value="All">All competitions</option>
                {CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Year
              <select value={year} onChange={event => setYear(event.target.value)} className="min-w-28 border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-sans text-sm normal-case tracking-normal text-[var(--ink)]">
                <option value="All">All years</option>
                {years.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            </>}
          </div>
        </div>

        {loading ? <div className="space-y-3" role="status" aria-label="Loading meet calendar">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-5"><Skeleton className="size-10 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div><Skeleton className="h-4 w-32" /></div>)}</div>
          : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-500 bg-white px-4 py-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={load} className="inline-flex items-center gap-2 font-semibold text-[var(--blue)]"><RotateCw size={14} /> Try again</button></div>
            : filtered.length ? <div className="space-y-8">{CATEGORIES.filter(item => category === 'All' || item === category).map(item => {
              const group = filtered.filter(meet => meet.category === item);
              if (!group.length) return null;
              const page = pages[item] ?? 1;
              const pageCount = Math.ceil(group.length / pageSize);
              const pageGroup = group.slice((page - 1) * pageSize, page * pageSize);
              return <section key={item}>
                <div className="flex items-baseline justify-between border-b-2 border-[var(--navy)] pb-2">
                  <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-[var(--navy)]">{item}</h3>
                  <span className="font-mono text-xs text-[var(--muted)]">{group.length} {group.length === 1 ? 'edition' : 'editions'}</span>
                </div>
                <div className="bg-[var(--surface)]">{pageGroup.map(meet => <MeetRow key={meet.id} meet={meet} />)}</div>
                {pageCount > 1 && <nav aria-label={`${item} pagination`} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <p className="text-xs text-[var(--muted)]">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, group.length)} of {group.length} editions</p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPages(current => ({ ...current, [item]: Math.max(1, page - 1) }))} disabled={page === 1} className="px-3 py-2 text-sm font-semibold text-[var(--blue)] hover:bg-[var(--ice)] disabled:cursor-not-allowed disabled:text-[var(--muted)]">Previous</button>
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => <button key={pageNumber} type="button" onClick={() => setPages(current => ({ ...current, [item]: pageNumber }))} aria-label={`Go to ${item} page ${pageNumber}`} aria-current={page === pageNumber ? 'page' : undefined} className={`size-9 font-mono text-sm ${page === pageNumber ? 'bg-[var(--navy)] font-bold text-white' : 'text-[var(--ink)] hover:bg-[var(--ice)]'}`}>{pageNumber}</button>)}
                    <button type="button" onClick={() => setPages(current => ({ ...current, [item]: Math.min(pageCount, page + 1) }))} disabled={page === pageCount} className="px-3 py-2 text-sm font-semibold text-[var(--blue)] hover:bg-[var(--ice)] disabled:cursor-not-allowed disabled:text-[var(--muted)]">Next</button>
                  </div>
                </nav>}
              </section>;
            })}</div> : <EmptyState title="No meets found" subtitle="Try a different competition or year filter." />}

        <div className="mt-8 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
          Have results from one of these events? <Link to="/submit" className="font-semibold text-[var(--blue)] hover:underline">Submit a result and link it to the Games edition</Link>.
        </div>
      </section>
    </div>
  );
}
