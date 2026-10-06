import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AGE_GROUPS, COURSES, EVENTS } from '../types';
import type { Course, Event, Gender, Ranking, TransplantType } from '../types';
import { formatDate, getCountryAlpha3, getFlagEmoji, is25mEvent, timeToSeconds } from '../lib/utils';
import { getSavedAvatar } from '../lib/avatars';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';
import PageHeading from '../components/PageHeading';

const TYPE_LABELS: Record<TransplantType, string> = {
  Kidney: 'Kidney', Liver: 'Liver', Heart: 'Heart', Lung: 'Lung',
  Pancreas: 'Pancreas', 'Bone Marrow': 'Bone marrow', Donor: 'Living donor',
};
const TYPES: TransplantType[] = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Bone Marrow', 'Donor'];
const ALL_EVENTS = 'All';

function meetLabel(row: Ranking) {
  const year = row.date ? new Date(row.date).getUTCFullYear() : NaN;
  const yearText = Number.isFinite(year) ? String(year) : '';
  const name = row.meetName?.trim() || '';
  if (name && yearText && !name.includes(yearText)) return `${name} ${yearText}`;
  return name || yearText || '—';
}

function formatBehind(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Leader';
  if (seconds < 60) return `+${seconds.toFixed(2)}`;
  const minutes = Math.floor(seconds / 60);
  return `+${minutes}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
}

export default function TransplantTypeRankingsPage() {
  const [transplantType, setTransplantType] = useState<TransplantType>('Kidney');
  const [ageGroup, setAgeGroup] = useState('All');
  const [gender, setGender] = useState<Gender>('Men');
  const [event, setEvent] = useState<Event | typeof ALL_EVENTS>(ALL_EVENTS);
  const [course, setCourse] = useState<Course>('LCM');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadDatabaseRankings()
      .then(rows => { if (active) setRankings(rows); })
      .catch(error => { if (active) setLoadError(describeSupabaseError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const typeCounts = new Map<TransplantType, Set<string>>();
  for (const type of TYPES) typeCounts.set(type, new Set());
  rankings.forEach(row => typeCounts.get(row.transplantType)?.add(row.athleteId));

  const bestByAthleteEvent = new Map<string, Ranking>();
  rankings
    .filter(row => row.transplantType === transplantType && row.gender === gender
      && (event === ALL_EVENTS || row.event === event) && !is25mEvent(row.event) && row.course === course
      && (ageGroup === 'All' || row.ageGroup === ageGroup))
    .sort((a, b) => (event === ALL_EVENTS
      ? String(a.event ?? '').localeCompare(String(b.event ?? ''), undefined, { numeric: true })
      : 0)
      || timeToSeconds(a.time) - timeToSeconds(b.time)
      || String(a.athleteName ?? '').localeCompare(String(b.athleteName ?? '')))
    .forEach(row => {
      const key = event === ALL_EVENTS ? `${row.athleteId}|${row.event}` : row.athleteId;
      if (!bestByAthleteEvent.has(key)) bestByAthleteEvent.set(key, row);
    });
  const sortedResults = [...bestByAthleteEvent.values()].sort((a, b) =>
    (event === ALL_EVENTS ? String(a.event ?? '').localeCompare(String(b.event ?? ''), undefined, { numeric: true }) : 0)
    || timeToSeconds(a.time) - timeToSeconds(b.time)
    || String(a.athleteName ?? '').localeCompare(String(b.athleteName ?? '')));
  const leaders = new Map<string, number>();
  const ranks = new Map<string, number>();
  const results = sortedResults.map(row => {
    const category = event === ALL_EVENTS ? row.event : ALL_EVENTS;
    const rank = (ranks.get(category) ?? 0) + 1;
    ranks.set(category, rank);
    if (!leaders.has(category)) leaders.set(category, timeToSeconds(row.time));
    return { ...row, rank };
  });
  const ageGroupOptions = AGE_GROUPS;
  const eventOptions = [...new Set([...EVENTS, ...rankings.map(row => row.event)])]
    .filter(item => !is25mEvent(item))
    .sort((a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));

  return (
    <div className="bg-[var(--paper)]">
      <PageHeading eyebrow="Rankings / By transplant type" title="Rank by transplant type" description="See how you compare with swimmers who’ve had the same transplant. Pick a type, then an event.">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Transplant type">
            {TYPES.map(type => {
              const selected = transplantType === type;
              const count = typeCounts.get(type)?.size ?? 0;
              return <button key={type} type="button" aria-pressed={selected} onClick={() => setTransplantType(type)} className={`inline-flex items-center gap-2 border px-2.5 py-1.5 text-[10px] transition-colors ${selected ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--navy)]' : count ? 'border-white/25 text-white hover:border-white/60' : 'border-white/10 text-white/55 hover:border-white/40'}`}>
                <span>{TYPE_LABELS[type]}</span><span className="font-mono">{count}</span>
              </button>;
            })}
          </div>
      </PageHeading>

      <div className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5 px-4 py-2">
          <label className="flex items-center gap-1.5 border border-[var(--accent-dark)] bg-[var(--ice)] px-2 py-1 text-[10px] text-[var(--muted)]">Event:
            <select value={event} onChange={e => setEvent(e.target.value as Event)} className="ta-filter-select appearance-none bg-transparent py-0.5 pr-6 text-[10px] font-semibold text-[var(--ink)] outline-none">
              <option value={ALL_EVENTS}>All</option>
              {eventOptions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="inline-flex border border-[var(--border)] p-0.5" role="group" aria-label="Gender">
            {(['Men', 'Women'] as const).map(item => <button key={item} type="button" aria-pressed={gender === item} onClick={() => setGender(item)} className={`px-3 py-1 text-[10px] ${gender === item ? 'bg-[var(--navy)] font-semibold text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item}</button>)}
          </div>
          <label className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)]">Age group:
            <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className="ta-filter-select appearance-none bg-transparent py-0.5 pr-6 text-[10px] font-semibold text-[var(--ink)] outline-none">
              {['All', ...ageGroupOptions].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 border border-[var(--accent-dark)] bg-[var(--ice)] px-2 py-1 text-[10px] text-[var(--muted)]">Course:
            <select value={course} onChange={e => setCourse(e.target.value as Course)} className="ta-filter-select appearance-none bg-transparent py-0.5 pr-6 text-[10px] font-semibold text-[var(--ink)] outline-none">
              {COURSES.map(item => <option key={item} value={item}>{item === 'LCM' ? 'Long course' : 'Short course'}</option>)}
            </select>
          </label>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">{transplantType} · {gender} · {event === ALL_EVENTS ? 'All events' : event}</h2>
          {!loading && !loadError && <p className="text-[10px] text-[var(--muted)]">{results.length} swims · {event === ALL_EVENTS ? 'each athlete’s best time per event' : 'each athlete’s best verified time'}</p>}
        </div>
        {loading ? <SkeletonTable rows={6} columns={event === ALL_EVENTS ? 8 : 7} />
          : loadError ? <div role="alert" className="border border-red-300 bg-red-50 px-5 py-6 text-sm text-red-800">Athlete rankings could not be loaded from the database. {loadError}</div>
            : results.length ? <div className="ta-table-shell">
              <table className={`border-collapse text-sm ${event === ALL_EVENTS ? 'min-w-[900px]' : 'min-w-[780px]'}`}>
                <thead><tr className="ta-table-header">
                  {['Rank', 'Athlete', ...(event === ALL_EVENTS ? ['Event'] : []), 'Age group', 'Date / meet', 'Behind leader', 'Time', ''].map((label, index) => <th key={`${label}-${index}`} className={`whitespace-nowrap px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 ${label === 'Time' || label === 'Behind leader' || label === '' ? 'text-right' : 'text-left'} ${index === 0 ? 'w-12' : ''}`}>{label}</th>)}
                </tr></thead>
                <tbody>{results.map(row => {
                  const nameParts = row.athleteName.trim().split(/\s+/);
                  const lastName = nameParts.length > 1 ? nameParts.pop()! : '';
                  const firstName = nameParts.join(' ');
                  const initials = `${firstName[0] ?? row.athleteName[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase();
                  const avatar = getSavedAvatar(firstName, lastName);
                  const countryFlag = row.countryCode ? getFlagEmoji(row.countryCode) : '';
                  const category = event === ALL_EVENTS ? row.event : ALL_EVENTS;
                  const behind = formatBehind(timeToSeconds(row.time) - (leaders.get(category) ?? timeToSeconds(row.time)));
                  return <tr key={`${row.athleteId}-${row.rank}`} className="ta-table-row">
                    <td className="whitespace-nowrap px-3 py-4 font-mono text-base font-bold text-[var(--accent-dark)] sm:px-5">{row.rank}</td>
                    <td className="px-3 py-4 sm:px-5">
                      <Link to={`/athletes/${row.athleteId}`} className="flex min-w-48 items-center gap-2.5 hover:underline">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ice)] text-[10px] font-semibold text-[var(--navy)] sm:h-11 sm:w-11">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--ink)]">{row.athleteName}</span><span className="mt-1 block text-xs text-[var(--muted)]">{countryFlag} {row.countryCode ? getCountryAlpha3(row.countryCode) : '—'}</span></span>
                      </Link>
                    </td>
                    {event === ALL_EVENTS && <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--ink)] sm:px-5">{row.event}</td>}
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{row.ageGroup || 'Not given'}</td>
                    <td className="px-3 py-4 text-sm text-[var(--muted)] sm:px-5"><span className="block whitespace-nowrap text-[var(--ink)]">{formatDate(row.date)}</span><span className="mt-1 block text-xs text-[var(--muted)]">{meetLabel(row)}</span></td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-xs text-[var(--muted)] sm:px-5">{behind}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-base font-bold text-[var(--navy)] sm:px-5">{row.time}</td>
                    <td className="px-2 py-4 text-right sm:px-4"><ChevronRight size={15} className="inline text-[var(--muted)]" aria-hidden="true" /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div> : <div className="border-t border-[var(--muted)] bg-white px-4 py-8 text-sm text-[var(--muted)]">No swimmers match these filters yet.</div>}
      </main>
    </div>
  );
}
