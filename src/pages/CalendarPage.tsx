import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus, ExternalLink, MapPin, Search, X } from 'lucide-react';
import { loadMeetCatalog, type MeetCatalogCategory, type MeetCatalogEdition } from '../lib/meetCatalog';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { countries } from '../data/countries';
import { getFlagEmoji } from '../lib/utils';

const PAGE_SIZE = 5;

function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatDate(date: string | null, endDate: string | null): string {
  if (!date) return 'Dates to be confirmed';
  const start = parseLocalDate(date);
  if (!endDate || endDate === date) return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(start);
  const end = parseLocalDate(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(start);
  const endLabel = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);
  return `${startLabel} – ${endLabel}`;
}

function isUpcoming(meet: MeetCatalogEdition): boolean {
  if (meet.status === 'cancelled') return false;
  const today = new Date(new Date().toDateString()).getTime();
  const lastDate = meet.end_date || meet.meet_date;
  if (lastDate) return parseLocalDate(lastDate).getTime() >= today;
  return meet.status === 'upcoming' || meet.status === 'in_progress' || meet.status === 'date_unconfirmed';
}

function displayMeetName(meet: MeetCatalogEdition): string {
  return meet.category === 'World Transplant Games' ? meet.name.replace(/^Summer\s+/i, '') : meet.name;
}

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((parseLocalDate(date).getTime() - today.getTime()) / 86_400_000));
}

function calendarFile(meet: MeetCatalogEdition): string | null {
  if (!meet.meet_date) return null;
  const startDate = meet.meet_date.replaceAll('-', '');
  const end = meet.end_date ? parseLocalDate(meet.end_date) : parseLocalDate(meet.meet_date);
  end.setDate(end.getDate() + 1);
  const endDate = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}`;
  const summary = meet.name.replace(/[\\,;]/g, ' ');
  const location = [meet.host_city, meet.host_country].filter(Boolean).join(', ').replace(/[\\,;]/g, ' ');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Transplant Aquatics//Meet Calendar//EN', 'BEGIN:VEVENT', `UID:${meet.id}@transplantaquatics.org`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART;VALUE=DATE:${startDate}`, `DTEND;VALUE=DATE:${endDate}`, `SUMMARY:${summary}`, ...(location ? [`LOCATION:${location}`] : []), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function getCountryCode(name: string | null): string {
  if (!name) return '';
  return countries.find(country => country.name.toLocaleLowerCase() === name.toLocaleLowerCase())?.code ?? '';
}

function DateTile({ date }: { date: string | null }) {
  if (!date) return <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border border-[var(--navy)] text-center text-[var(--navy)]"><span className="text-[10px] font-semibold uppercase tracking-wide">TBD</span><span className="font-mono text-xs">—</span></span>;
  const value = parseLocalDate(date);
  return <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border border-[var(--navy)] text-center text-[var(--navy)]"><span className="text-[10px] font-semibold uppercase">{new Intl.DateTimeFormat('en', { month: 'short' }).format(value)}</span><span className="font-mono text-2xl font-bold leading-tight">{value.getDate()}</span></span>;
}

function MeetRow({ meet }: { meet: MeetCatalogEdition }) {
  const location = [meet.host_city, meet.host_country].filter(Boolean).join(', ');
  const countryCode = getCountryCode(meet.host_country);
  const level = meet.category === 'World Transplant Games' ? 'World' : 'National';
  return <article className="grid gap-3 border-b border-[var(--border)] py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
    <div className="flex min-w-0 items-center gap-4">
      <DateTile date={meet.meet_date} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">{displayMeetName(meet)}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${level === 'World' ? 'bg-[var(--navy)] text-white' : 'bg-[#e6ebf8] text-[var(--navy)]'}`}>{level}</span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]"><MapPin size={14} aria-hidden="true" />{location || 'Location to be confirmed'}{countryCode && <span className="ml-1" aria-label={meet.host_country ?? undefined}>{getFlagEmoji(countryCode)}</span>}</p>
      </div>
    </div>
    <p className="pl-20 text-sm text-[var(--muted)] sm:pl-0 sm:text-right">{formatDate(meet.meet_date, meet.end_date)}</p>
    {meet.source_url ? <a href={meet.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 pl-20 text-sm font-semibold text-[var(--accent-dark)] hover:underline sm:pl-0">Event details <ArrowRight size={15} /></a> : <span className="pl-20 text-sm text-[var(--muted)] sm:pl-0">Details coming soon</span>}
  </article>;
}

export default function CalendarPage() {
  const [meets, setMeets] = useState<MeetCatalogEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'Upcoming' | 'Past'>('Upcoming');
  const [category, setCategory] = useState<'All' | MeetCatalogCategory>('All');
  const [country, setCountry] = useState('All');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    loadMeetCatalog().then(setMeets).catch(() => setError('The meet calendar could not be loaded. Please try again.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const upcomingMeets = useMemo(() => meets.filter(isUpcoming).sort((a, b) => (a.meet_date ?? '9999').localeCompare(b.meet_date ?? '9999')), [meets]);
  const featuredMeet = upcomingMeets.find(meet => meet.category === 'World Transplant Games' && meet.meet_date) ?? null;
  const countriesInCalendar = useMemo(() => [...new Set(meets.map(meet => meet.host_country).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b)), [meets]);
  const visibleMeets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return meets.filter(meet => {
      if (period === 'Upcoming' ? !isUpcoming(meet) : isUpcoming(meet)) return false;
      if (category !== 'All' && meet.category !== category) return false;
      if (country !== 'All' && meet.host_country !== country) return false;
      const searchable = [meet.name, meet.series_name, meet.year, meet.host_city, meet.host_country].filter(Boolean).join(' ').toLocaleLowerCase();
      return !query || searchable.includes(query);
    }).sort((a, b) => {
      const dateOrder = (a.meet_date ?? '').localeCompare(b.meet_date ?? '');
      return period === 'Upcoming' ? dateOrder : -dateOrder;
    });
  }, [meets, period, category, country, search]);
  const pageCount = Math.max(1, Math.ceil(visibleMeets.length / PAGE_SIZE));
  const pageMeets = visibleMeets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const calendarUrl = featuredMeet ? calendarFile(featuredMeet) : null;

  useEffect(() => { setPage(1); }, [period, category, country, search]);

  return <div className="min-h-screen bg-[var(--paper)]">
    <section className="ta-page-top border-b border-[var(--navy-light)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">Meet calendar</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/75">World and national Transplant Games: where and when they happen, and the results from each one.</p>
      </div>
    </section>

    {featuredMeet && <section className="border-b border-[var(--border)] bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center bg-[var(--navy)] text-white">
          <span className="font-mono text-3xl font-bold leading-none">{daysUntil(featuredMeet.meet_date!)}</span><span className="mt-2 text-xs text-white/65">days to go</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--accent-dark)]">Next World Games</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">{displayMeetName(featuredMeet)}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]"><span aria-hidden="true">{getCountryCode(featuredMeet.host_country) ? getFlagEmoji(getCountryCode(featuredMeet.host_country)) : ''}</span>{[featuredMeet.host_city, featuredMeet.host_country].filter(Boolean).join(', ')} · {formatDate(featuredMeet.meet_date, featuredMeet.end_date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {featuredMeet.source_url && <a href={featuredMeet.source_url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 border border-[var(--border)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--paper)]">Official site <ExternalLink size={14} /></a>}
          {calendarUrl && <a href={calendarUrl} download={`${featuredMeet.year}-world-transplant-games.ics`} className="inline-flex h-11 items-center gap-2 bg-[var(--navy)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--navy-mid)]"><CalendarPlus size={16} /> Add to calendar</a>}
        </div>
      </div>
    </section>}

    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-6" role="tablist" aria-label="Meet calendar period">
          {(['Upcoming', 'Past'] as const).map(item => <button key={item} type="button" role="tab" aria-selected={period === item} onClick={() => setPeriod(item)} className={`border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${period === item ? 'border-[var(--accent-dark)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item}<span className="ml-2 text-xs font-normal">{loading ? '' : item === 'Upcoming' ? upcomingMeets.length : meets.filter(meet => !isUpcoming(meet)).length}</span></button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <label className="inline-flex h-10 items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-xs text-[var(--muted)]">Level:
            <select value={category} onChange={event => setCategory(event.target.value as 'All' | MeetCatalogCategory)} className="bg-transparent font-semibold text-[var(--ink)] outline-none"><option value="All">All</option><option value="National Transplant Games">National</option><option value="World Transplant Games">World</option></select>
          </label>
          <label className="inline-flex h-10 items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-xs text-[var(--muted)]">Country:
            <select value={country} onChange={event => setCountry(event.target.value)} className="max-w-36 bg-transparent font-semibold text-[var(--ink)] outline-none"><option value="All">All</option>{countriesInCalendar.map(item => <option key={item} value={item}>{item}</option>)}</select>
          </label>
          <button type="button" onClick={() => setSearchOpen(open => !open)} aria-label={searchOpen ? 'Hide meet search' : 'Search meets'} aria-expanded={searchOpen} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"><Search size={16} /></button>
        </div>
      </div>
      {searchOpen && <div className="flex items-center gap-2 border-b border-[var(--border)] bg-white px-3 py-2"><Search size={16} className="text-[var(--muted)]" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search meets, year, or location" className="h-9 min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear meet search" className="text-[var(--muted)]"><X size={15} /></button>}</div>}

      {loading ? <div className="space-y-3 py-5" role="status" aria-label="Loading meet calendar">{Array.from({ length: 3 }, (_, index) => <div key={index} className="flex items-center gap-4 border-b border-[var(--border)] py-5"><Skeleton className="size-16 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div><Skeleton className="h-4 w-32" /></div>)}</div>
        : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-500 bg-white px-4 py-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={load} className="font-semibold text-[var(--accent-dark)]">Try again</button></div>
          : pageMeets.length ? <div>{pageMeets.map(meet => <MeetRow key={meet.id} meet={meet} />)}</div> : <div className="py-10"><EmptyState title={`No ${period.toLowerCase()} meets found`} subtitle="Try another level or country filter." /></div>}

      {visibleMeets.length > PAGE_SIZE && <nav aria-label={`${period} meet pages`} className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <p className="text-xs text-[var(--muted)]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleMeets.length)} of {visibleMeets.length} meets</p>
        <div className="flex items-center gap-1"><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="px-3 py-2 text-sm text-[var(--muted)] disabled:opacity-40">Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button key={number} type="button" onClick={() => setPage(number)} aria-current={page === number ? 'page' : undefined} className={`size-9 font-mono text-sm ${page === number ? 'bg-[var(--navy)] font-bold text-white' : 'text-[var(--ink)] hover:bg-white'}`}>{number}</button>)}<button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="px-3 py-2 text-sm text-[var(--muted)] disabled:opacity-40">Next</button></div>
      </nav>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 bg-[var(--navy)] px-6 py-5 text-sm text-white">
        <p><strong>Swam at one of these meets?</strong> <span className="text-white/70">Submit your times and we’ll link them to the right Games.</span></p>
        <Link to="/submit" className="inline-flex h-11 items-center gap-2 bg-[var(--accent)] px-4 font-semibold text-[var(--navy)] transition-colors hover:bg-cyan-300">Submit a result <ArrowRight size={16} /></Link>
      </div>
    </section>
  </div>;
}
