import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { Ranking } from '../types';
import { AGE_GROUPS, COURSES, EVENTS, type Course, type Event } from '../types';
import RankingTable from '../components/RankingTable';
import Pagination from '../components/Pagination';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { is25mEvent, timeToSeconds } from '../lib/utils';
import { SkeletonTable } from '../components/Skeleton';

const ALL = 'All';
const PAGE_SIZE = 25;
const GENDER_PREVIEW_SIZE = 5;
const compareNames = (a: Ranking['athleteName'], b: Ranking['athleteName']) =>
  String(a ?? '').localeCompare(String(b ?? ''));

export default function GenderRankingsPage() {
  const { gender: genderParam } = useParams<{ gender: string }>();
  const gender = genderParam?.toLowerCase() === 'men' ? 'Men' : genderParam?.toLowerCase() === 'women' ? 'Women' : null;
  const [searchParams] = useSearchParams();
  const initialEvent = searchParams.get('event');
  const [ageGroup, setAgeGroup] = useState(searchParams.get('ageGroup') || ALL);
  const [event, setEvent] = useState<Event>(initialEvent && EVENTS.includes(initialEvent as Event) && !is25mEvent(initialEvent)
    ? initialEvent as Event
    : '50m Freestyle');
  const [course, setCourse] = useState<Course>(searchParams.get('course') === 'SCM' ? 'SCM' : 'LCM');
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    setPage(1);
  }, [ageGroup, event, course]);

  if (!gender) return <Navigate to="/rankings" replace />;

  const bestByAthlete = new Map<string, Ranking>();
  rankings
    .filter(row => row.gender === gender && row.event === event && row.course === course
      && (ageGroup === ALL || row.ageGroup === ageGroup) && !is25mEvent(row.event))
    .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time) || compareNames(a.athleteName, b.athleteName))
    .forEach(row => {
      if (!bestByAthlete.has(row.athleteId)) bestByAthlete.set(row.athleteId, row);
    });
  const filtered = [...bestByAthlete.values()].map((row, index) => ({ ...row, rank: index + 1 }));
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRankings = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const ageGroups = [...new Set([...AGE_GROUPS, ...rankings.map(row => row.ageGroup)])]
    .sort((a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));
  const events = [...new Set([...EVENTS, ...rankings.map(row => row.event)])]
    .filter(item => !is25mEvent(item))
    .sort((a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));

  return (
    <div className="bg-[var(--paper)]">
      <section className="bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:py-11">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link to="/rankings" className="mb-3 inline-flex text-xs font-semibold text-[var(--accent-dark)] hover:underline">← All rankings</Link>
              <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)] sm:text-3xl">Top swims by event</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">Event:
                <select value={event} onChange={e => setEvent(e.target.value as Event)} className="border border-[var(--border)] bg-white px-2.5 py-2 text-xs text-[var(--ink)]">
                  {events.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">Age group:
                <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className="border border-[var(--border)] bg-white px-2.5 py-2 text-xs text-[var(--ink)]">
                  {[ALL, ...ageGroups].map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">Course:
                <select value={course} onChange={e => setCourse(e.target.value as Course)} className="border border-[var(--border)] bg-white px-2.5 py-2 text-xs text-[var(--ink)]">
                  {COURSES.map(item => <option key={item} value={item}>{item === 'LCM' ? 'Long course' : 'Short course'}</option>)}
                </select>
              </label>
            </div>
          </div>
          <p className="mb-5 text-sm text-[var(--muted)]">The fastest swims in {gender.toLowerCase()}'s {event}. One row per athlete.</p>

          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--ink)]">{gender}</h2>
              {!loading && !loadError && <span className="text-xs text-[var(--muted)]">{filtered.length.toLocaleString()} swimmers · fastest verified time</span>}
            </div>
            {loading ? <SkeletonTable rows={GENDER_PREVIEW_SIZE} columns={4} />
              : loadError ? <p role="status" className="border border-[var(--border)] bg-white px-4 py-6 text-sm text-red-700">Rankings could not be loaded: {loadError}</p>
                : filtered.length ? <>
                  <RankingTable rankings={pageRankings} showVerified={false} showGap={false} showPoints paperSurface showAgeGroup />
                  <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label={`${gender} rankings`} />
                </>
                  : <div className="border border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">No swims match these filters yet.</div>}
          </section>
        </div>
      </section>
    </div>
  );
}
