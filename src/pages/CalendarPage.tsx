import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { meets } from '../data/meets';
import { formatDate } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import FilterSelect from '../components/FilterSelect';
import FilterBar from '../components/FilterBar';

const PAGE_SIZE = 10;

// Extend meets with upcoming ones for a richer calendar
const EXTENDED_MEETS = [
  ...meets,
  {
    id: 'etdg-2026',
    name: 'European Transplant & Dialysis Games 2026',
    location: 'Vienna, Austria',
    date: '2026-09-18',
    course: 'LCM' as const,
  },
  {
    id: 'aus-natl-2026',
    name: 'Australian Transplant Games 2026',
    location: 'Brisbane, Australia',
    date: '2026-10-08',
    course: 'LCM' as const,
  },
  {
    id: 'britts-2026',
    name: 'British Transplant Swimming Championships 2026',
    location: 'Manchester, United Kingdom',
    date: '2026-11-07',
    course: 'SCM' as const,
  },
  {
    id: 'ntsc-2027',
    name: 'National Transplant Swimming Championships 2027',
    location: 'Cape Town, South Africa',
    date: '2027-02-12',
    course: 'LCM' as const,
  },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMeetStatus(dateStr: string): 'Upcoming' | 'Completed' {
  const meetDate = new Date(dateStr);
  const today = new Date();
  return meetDate >= today ? 'Upcoming' : 'Completed';
}

function getCountryFromLocation(location: string): string {
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

function getUniqueYears(meetsArr: typeof EXTENDED_MEETS): number[] {
  const years = meetsArr.map(m => new Date(m.date).getFullYear());
  return [...new Set(years)].sort((a, b) => a - b);
}

function getUniqueCountries(meetsArr: typeof EXTENDED_MEETS): string[] {
  const countries = meetsArr.map(m => getCountryFromLocation(m.location));
  return [...new Set(countries)].sort();
}

// Countdown hook
function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();
    return Math.max(0, diff);
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      setTimeLeft(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return { days, hours, mins, secs };
}

export default function CalendarPage() {
  const [yearFilter, setYearFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);

  const years = getUniqueYears(EXTENDED_MEETS);
  const countries = getUniqueCountries(EXTENDED_MEETS);

  // WTG 2027 countdown
  const wtg2027 = EXTENDED_MEETS.find(m => m.id === 'wtg-2027');
  const wtgTarget = wtg2027 ? new Date(wtg2027.date) : new Date('2027-08-01');
  const { days, hours, mins, secs } = useCountdown(wtgTarget);
  const wtgIsUpcoming = getMeetStatus(wtgTarget.toISOString()) === 'Upcoming';

  // Filtered meets
  const filtered = EXTENDED_MEETS.filter(m => {
    const d = new Date(m.date);
    if (yearFilter !== 'All' && d.getFullYear() !== parseInt(yearFilter)) return false;
    if (monthFilter !== 'All' && MONTHS[d.getMonth()] !== monthFilter) return false;
    if (countryFilter !== 'All' && getCountryFromLocation(m.location) !== countryFilter) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  useEffect(() => setPage(1), [yearFilter, monthFilter, countryFilter]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageMeets = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Group by month for list view
  const byMonth = pageMeets.reduce<Record<string, typeof filtered>>((acc, m) => {
    const d = new Date(m.date);
    const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        className="border-b"
        style={{
          backgroundColor: 'var(--navy-mid)',
          borderColor: 'var(--navy-light)',
          backgroundImage:
            'repeating-linear-gradient(-55deg, transparent, transparent 18px, rgba(255,255,255,0.015) 18px, rgba(255,255,255,0.015) 19px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-16">
          <Eyebrow color="accent" className="mb-4">Schedule</Eyebrow>
          <h1
            className="display text-4xl md:text-6xl font-black uppercase leading-tight tracking-tight"
            style={{ color: 'var(--ink-on-dark)' }}
          >
            Race Calendar
          </h1>
          <p className="mt-3 font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
            Upcoming and past transplant swimming competitions worldwide.
          </p>
        </div>
      </section>

      {/* WTG countdown feature card */}
      {wtgIsUpcoming && (
        <section className="max-w-7xl mx-auto px-4 pt-10">
          <div
            className="border p-8 md:p-10"
            style={{
              borderColor: 'var(--accent)',
              backgroundColor: 'rgba(199,243,104,0.04)',
            }}
          >
            <Eyebrow color="accent" className="mb-3">Countdown</Eyebrow>
            <h2 className="font-bold text-xl md:text-2xl" style={{ color: 'var(--ink-on-dark)' }}>
              World Transplant Games 2027 — Leuven, Belgium
            </h2>
            <p className="mt-1 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
              1–8 August 2027
            </p>

            <div className="mt-8 grid grid-cols-4 gap-4">
              {[
                { value: String(days).padStart(3, '0'), label: 'Days' },
                { value: String(hours).padStart(2, '0'), label: 'Hrs' },
                { value: String(mins).padStart(2, '0'), label: 'Min' },
                { value: String(secs).padStart(2, '0'), label: 'Sec' },
              ].map(unit => (
                <div key={unit.label} className="text-center">
                  <div
                    className="display font-black text-3xl md:text-5xl leading-none mono"
                    style={{ color: 'var(--accent)' }}
                  >
                    {unit.value}
                  </div>
                  <div className="mt-1 font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                    {unit.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link
                to="/meets/wtg-2027"
                className="inline-block font-mono text-xs uppercase tracking-widest px-5 py-2.5 transition-colors"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--navy)',
                  fontWeight: 700,
                }}
              >
                View Meet Details
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Filter bar */}
      <section className="border-b border-neutral-200" style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <FilterBar className="sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Year" value={yearFilter} options={['All', ...years.map(String)]} onChange={setYearFilter} />
              <FilterSelect label="Month" value={monthFilter} options={['All', ...MONTHS]} onChange={setMonthFilter} />
              <FilterSelect label="Country" value={countryFilter} options={['All', ...countries]} onChange={setCountryFilter} />
            </div>

          {/* View toggle */}
          <div className="flex border border-neutral-300">
            {(['list', 'grid'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors"
                style={{
                  backgroundColor: view === v ? '#1769c2' : 'transparent',
                  color: view === v ? '#fff' : '#52525b',
                }}
              >
                {v}
              </button>
            ))}
          </div>
          </FilterBar>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-16">
        <p className="mb-4 font-mono text-xs text-white/60">
          {filtered.length ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} meets` : '0 meets'}
        </p>
        {filtered.length === 0 ? (
          <div className="py-16 text-center border" style={{ borderColor: 'var(--navy-light)' }}>
            <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
              No meets match your filters
            </p>
          </div>
        ) : view === 'list' ? (
          /* List view — grouped by month */
          <div className="space-y-10">
            {Object.entries(byMonth).map(([month, meetList]) => (
              <div key={month}>
                <h2
                  className="font-mono text-xs uppercase tracking-widest mb-4 pb-3 border-b"
                  style={{ color: 'var(--accent)', borderColor: 'var(--navy-light)' }}
                >
                  {month}
                </h2>
                <div className="space-y-2">
                  {meetList.map(m => {
                    const status = getMeetStatus(m.date);
                    return (
                      <Link
                        key={m.id}
                        to={`/meets/${m.id}`}
                        className="flex flex-wrap items-center gap-4 border px-6 py-4 transition-colors group"
                        style={{
                          borderColor: 'var(--navy-light)',
                          backgroundColor: 'var(--navy-mid)',
                          textDecoration: 'none',
                        }}
                      >
                        <div
                          className="w-14 text-center flex-shrink-0"
                        >
                          <div className="font-mono font-bold text-xl" style={{ color: 'var(--ink-on-dark)' }}>
                            {new Date(m.date).getDate()}
                          </div>
                          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                            {MONTHS[new Date(m.date).getMonth()].slice(0, 3)}
                          </div>
                        </div>

                        <div
                          className="w-px self-stretch flex-shrink-0"
                          style={{ backgroundColor: 'var(--navy-light)' }}
                        />

                        <div className="flex-1 min-w-0">
                          <div
                            className="font-bold text-base leading-snug group-hover:underline"
                            style={{ color: 'var(--ink-on-dark)' }}
                          >
                            {m.name}
                          </div>
                          <div className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                            {m.location}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span
                            className="font-mono text-xs px-2 py-0.5"
                            style={{
                              color: 'var(--aqua)',
                              border: '1px solid var(--aqua)',
                              backgroundColor: 'rgba(0,194,215,0.08)',
                            }}
                          >
                            {m.course}
                          </span>
                          <span
                            className="font-mono text-xs px-2 py-0.5"
                            style={{
                              backgroundColor: status === 'Upcoming' ? 'rgba(199,243,104,0.12)' : 'rgba(143,165,181,0.12)',
                              color: status === 'Upcoming' ? 'var(--accent)' : 'var(--muted-on-dark)',
                              border: `1px solid ${status === 'Upcoming' ? 'var(--accent)' : 'var(--navy-light)'}`,
                            }}
                          >
                            {status}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageMeets.map(m => {
              const status = getMeetStatus(m.date);
              return (
                <Link
                  key={m.id}
                  to={`/meets/${m.id}`}
                  className="border p-6 flex flex-col gap-3 group transition-colors"
                  style={{
                    borderColor: status === 'Upcoming' ? 'rgba(199,243,104,0.3)' : 'var(--navy-light)',
                    backgroundColor: 'var(--navy-mid)',
                    textDecoration: 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="font-mono text-xs uppercase tracking-widest px-2 py-0.5"
                      style={{
                        backgroundColor: status === 'Upcoming' ? 'rgba(199,243,104,0.12)' : 'rgba(143,165,181,0.12)',
                        color: status === 'Upcoming' ? 'var(--accent)' : 'var(--muted-on-dark)',
                        border: `1px solid ${status === 'Upcoming' ? 'var(--accent)' : 'var(--navy-light)'}`,
                      }}
                    >
                      {status}
                    </span>
                    <span
                      className="font-mono text-xs px-2 py-0.5"
                      style={{
                        color: 'var(--aqua)',
                        border: '1px solid var(--aqua)',
                      }}
                    >
                      {m.course}
                    </span>
                  </div>
                  <div>
                    <h3
                      className="font-bold text-base leading-snug group-hover:underline"
                      style={{ color: 'var(--ink-on-dark)' }}
                    >
                      {m.name}
                    </h3>
                    <p className="mt-1 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                      {m.location}
                    </p>
                  </div>
                  <div className="mt-auto pt-3 border-t" style={{ borderColor: 'var(--navy-light)' }}>
                    <span className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                      {formatDate(m.date)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Calendar pages" />
      </div>
    </div>
  );
}
