import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AGE_GROUPS, COURSES, EVENTS } from '../types';
import type { Course, Event, Gender, Ranking, TransplantType } from '../types';
import { getCountryAlpha3, getFlagEmoji, timeToSeconds } from '../lib/utils';
import { getSavedAvatar } from '../lib/avatars';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';

const TYPE_LABELS: Record<TransplantType, string> = {
  Kidney: 'Kidney', Liver: 'Liver', Heart: 'Heart', Lung: 'Lung',
  Pancreas: 'Pancreas', 'Bone Marrow': 'Bone marrow', Donor: 'Living donor',
};
const TYPES: TransplantType[] = ['Kidney', 'Liver', 'Heart', 'Lung', 'Pancreas', 'Bone Marrow', 'Donor'];
const INITIAL_EVENT = '100m Backstroke' as Event;

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
  const [event, setEvent] = useState<Event>(INITIAL_EVENT);
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

  const bestByAthlete = new Map<string, Ranking>();
  rankings
    .filter(row => row.transplantType === transplantType && row.gender === gender
      && row.event === event && row.course === course
      && (ageGroup === 'All' || row.ageGroup === ageGroup))
    .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time)
      || String(a.athleteName ?? '').localeCompare(String(b.athleteName ?? '')))
    .forEach(row => {
      if (!bestByAthlete.has(row.athleteId)) bestByAthlete.set(row.athleteId, row);
    });
  const results = [...bestByAthlete.values()].map((row, index) => ({ ...row, rank: index + 1 }));
  const leaderSeconds = results.length ? timeToSeconds(results[0].time) : 0;
  const ageGroupOptions = [...new Set([...AGE_GROUPS, ...rankings.map(row => row.ageGroup)])]
    .sort((a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));
  const eventOptions = [...new Set([...EVENTS, ...rankings.map(row => row.event)])]
    .sort((a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));

  return (
    <div className="bg-[var(--paper)]">
      <header className="bg-[var(--navy)] text-white">
        <div className="mx-auto max-w-7xl px-4 pb-5 pt-6 sm:pb-6">
          <nav aria-label="Breadcrumb" className="mb-2 font-mono text-[10px] text-white/65">
            <Link to="/rankings" className="hover:text-[var(--accent)]">Rankings</Link><span className="px-2">/</span><span>By transplant type</span>
          </nav>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Rank by transplant type</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">See how you compare with swimmers who’ve had the same transplant. Pick a type, then an event.</p>
          <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Transplant type">
            {TYPES.map(type => {
              const selected = transplantType === type;
              const count = typeCounts.get(type)?.size ?? 0;
              return <button key={type} type="button" aria-pressed={selected} onClick={() => setTransplantType(type)} className={`inline-flex items-center gap-2 border px-2.5 py-1.5 text-[10px] transition-colors ${selected ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--navy)]' : count ? 'border-white/25 text-white hover:border-white/60' : 'border-white/10 text-white/35'}`}>
                <span>{TYPE_LABELS[type]}</span><span className="font-mono">{count}</span>
              </button>;
            })}
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5 px-4 py-2">
          <label className="flex items-center gap-1.5 border border-[var(--accent-dark)] bg-[var(--ice)] px-2 py-1 text-[10px] text-[var(--muted)]">Event:
            <select value={event} onChange={e => setEvent(e.target.value as Event)} className="bg-transparent py-0.5 text-[10px] font-semibold text-[var(--ink)] outline-none">
              {eventOptions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="inline-flex border border-[var(--border)] p-0.5" role="group" aria-label="Gender">
            {(['Men', 'Women'] as const).map(item => <button key={item} type="button" aria-pressed={gender === item} onClick={() => setGender(item)} className={`px-3 py-1 text-[10px] ${gender === item ? 'bg-[var(--navy)] font-semibold text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item}</button>)}
          </div>
          <label className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)]">Age group:
            <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className="bg-transparent py-0.5 text-[10px] font-semibold text-[var(--ink)] outline-none">
              {['All', ...ageGroupOptions].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 border border-[var(--accent-dark)] bg-[var(--ice)] px-2 py-1 text-[10px] text-[var(--muted)]">Course:
            <select value={course} onChange={e => setCourse(e.target.value as Course)} className="bg-transparent py-0.5 text-[10px] font-semibold text-[var(--ink)] outline-none">
              {COURSES.map(item => <option key={item} value={item}>{item === 'LCM' ? 'Long course' : 'Short course'}</option>)}
            </select>
          </label>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">{transplantType} · {gender} · {event}</h2>
          {!loading && !loadError && <p className="text-[10px] text-[var(--muted)]">{results.length} swimmers · each athlete’s best verified time</p>}
        </div>
        {loading ? <SkeletonTable rows={6} columns={6} />
          : loadError ? <div role="alert" className="border border-red-300 bg-red-50 px-5 py-6 text-sm text-red-800">Athlete rankings could not be loaded from the database. {loadError}</div>
            : results.length ? <div className="overflow-x-auto border-t border-[var(--muted)] bg-white">
              <table className="w-full min-w-[650px] border-collapse">
                <thead><tr className="bg-[var(--navy)] text-white">
                  {['Rank', 'Athlete', 'Age group', 'Set at', 'Behind leader', 'Time', ''].map((label, index) => <th key={`${label}-${index}`} className={`px-3 py-2 text-[9px] font-medium ${index === 0 || index === 1 || index === 2 || index === 3 ? 'text-left' : 'text-right'} ${index === 0 ? 'w-10' : ''}`}>{label}</th>)}
                </tr></thead>
                <tbody>{results.map((row, index) => {
                  const nameParts = row.athleteName.trim().split(/\s+/);
                  const lastName = nameParts.length > 1 ? nameParts.pop()! : '';
                  const firstName = nameParts.join(' ');
                  const initials = `${firstName[0] ?? row.athleteName[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase();
                  const avatar = getSavedAvatar(firstName, lastName);
                  const countryFlag = row.countryCode ? getFlagEmoji(row.countryCode) : '';
                  const behind = formatBehind(timeToSeconds(row.time) - leaderSeconds);
                  return <tr key={`${row.athleteId}-${row.rank}`} className="border-b border-[var(--border)] hover:bg-[var(--paper)]">
                    <td className="px-3 py-2.5 text-[10px] font-mono text-[var(--accent-dark)]">{index + 1}</td>
                    <td className="px-3 py-2.5">
                      <Link to={`/athletes/${row.athleteId}`} className="flex items-center gap-2 hover:underline">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ice)] text-[9px] font-semibold text-[var(--navy)]">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}</span>
                        <span className="min-w-0"><span className="block truncate text-[10px] font-semibold text-[var(--ink)]">{row.athleteName}</span><span className="block text-[9px] text-[var(--muted)]">{countryFlag} {row.countryCode ? getCountryAlpha3(row.countryCode) : '—'}</span></span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[9px] text-[var(--muted)]">{row.ageGroup || 'Not given'}</td>
                    <td className="px-3 py-2.5 text-[9px] text-[var(--muted)]">{meetLabel(row)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[9px] text-[var(--muted)]">{behind}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-[var(--navy)]">{row.time}</td>
                    <td className="px-3 py-2.5 text-right"><ChevronRight size={13} className="inline text-[var(--muted)]" aria-hidden="true" /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div> : <div className="border-t border-[var(--muted)] bg-white px-4 py-8 text-sm text-[var(--muted)]">No swimmers match these filters yet.</div>}
      </main>
    </div>
  );
}
