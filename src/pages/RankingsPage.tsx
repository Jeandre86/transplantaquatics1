import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Ranking } from '../types';
import { AGE_GROUPS, COURSES, EVENTS, type Course, type Event } from '../types';
import RankingTable from '../components/RankingTable';
import TransplantCohortExplorer from '../components/TransplantCohortExplorer';
import PageHeading from '../components/PageHeading';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { is25mEvent, timeToSeconds } from '../lib/utils';
import { SkeletonTable } from '../components/Skeleton';

const ALL = 'All';
const GENDER_PREVIEW_SIZE = 5;
const compareNames = (a: Ranking['athleteName'], b: Ranking['athleteName']) =>
  String(a ?? '').localeCompare(String(b ?? ''));

export default function RankingsPage() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | typeof ALL>(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [course, setCourse] = useState<Course | typeof ALL>(ALL);

  useEffect(() => {
    let active = true;
    loadDatabaseRankings()
      .then(rows => { if (active) setRankings(rows); })
      .catch(error => { if (active) setRankingsError(describeSupabaseError(error)); })
      .finally(() => { if (active) setRankingsLoading(false); });
    return () => { active = false; };
  }, []);

  const fastestPreview = (gender: 'Men' | 'Women') => {
    const bestByAthlete = new Map<string, Ranking>();
    rankings
      .filter(row => row.gender === gender && (event === ALL || row.event === event) && (course === ALL || row.course === course)
        && (ageGroup === ALL || row.ageGroup === ageGroup) && !is25mEvent(row.event))
      .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time) || compareNames(a.athleteName, b.athleteName))
      .forEach(row => { if (!bestByAthlete.has(row.athleteId)) bestByAthlete.set(row.athleteId, row); });
    return [...bestByAthlete.values()].slice(0, GENDER_PREVIEW_SIZE).map((row, index) => ({ ...row, rank: index + 1 }));
  };

  const events = [...new Set([...EVENTS, ...rankings.map(row => row.event)])]
    .filter(item => !is25mEvent(item))
    .sort((a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));
  const ageGroups = [...new Set([...AGE_GROUPS, ...rankings.map(row => row.ageGroup)])]
    .sort((a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true }));
  const menRankings = fastestPreview('Men');
  const womenRankings = fastestPreview('Women');

  return (
    <div className="bg-[var(--paper)]">
      <PageHeading eyebrow="Rankings" title="Top swims by event" description="The fastest verified swims in each event. One row per athlete." />
      <section className="bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 pb-5 sm:pb-6">
          <div className="ta-filter-bar-full-bleed mb-5 flex flex-wrap items-end justify-between gap-4 border-y border-[var(--border)] bg-white py-3">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">Event:
              <select value={event} onChange={e => setEvent(e.target.value as Event | typeof ALL)} className="ta-filter-select appearance-none border border-[var(--border)] bg-white px-2.5 py-2 pr-8 text-sm text-[var(--ink)]">
                  <option value={ALL}>{ALL}</option>
                  {events.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">Age group:
              <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} className="ta-filter-select appearance-none border border-[var(--border)] bg-white px-2.5 py-2 pr-8 text-sm text-[var(--ink)]">
                  {[ALL, ...ageGroups].map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">Course:
              <select value={course} onChange={e => setCourse(e.target.value as Course | typeof ALL)} className="ta-filter-select appearance-none border border-[var(--border)] bg-white px-2.5 py-2 pr-8 text-sm text-[var(--ink)]">
                  <option value={ALL}>{ALL}</option>{COURSES.map(item => <option key={item} value={item}>{item === 'LCM' ? 'Long course' : 'Short course'}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {(['Women', 'Men'] as const).map(gender => {
              const genderRankings = gender === 'Women' ? womenRankings : menRankings;
              return <section key={gender} className="min-w-0">
                <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-bold text-[var(--ink)]">{gender}</h2><Link to={`/rankings/${gender.toLowerCase()}`} className="text-xs font-semibold text-[var(--accent-dark)] hover:underline">See all {gender.toLowerCase()} →</Link></div>
                {rankingsLoading ? <SkeletonTable rows={GENDER_PREVIEW_SIZE} columns={4} />
                  : rankingsError ? <p role="status" className="border border-[var(--border)] bg-white px-4 py-6 text-sm text-red-700">Rankings could not be loaded: {rankingsError}</p>
                    : genderRankings.length ? <RankingTable rankings={genderRankings} showVerified={false} showGap={false} showPoints paperSurface showAgeGroup />
                      : <div className="border border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">No swims match these filters yet.</div>}
              </section>;
            })}
          </div>
        </div>
      </section>
      <TransplantCohortExplorer />
    </div>
  );
}
