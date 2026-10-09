import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Ranking } from '../types';
import { AGE_GROUPS, COURSES, EVENTS, type Course, type Event } from '../types';
import RankingTable from '../components/RankingTable';
import TransplantCohortExplorer from '../components/TransplantCohortExplorer';
import PageHeading from '../components/PageHeading';
import { loadDatabaseRankingPreview } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { is25mEvent } from '../lib/utils';
import { SkeletonTable } from '../components/Skeleton';

const ALL = 'All';
const GENDER_PREVIEW_SIZE = 5;
export default function RankingsPage() {
  const [menRankings, setMenRankings] = useState<Ranking[]>([]);
  const [womenRankings, setWomenRankings] = useState<Ranking[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | typeof ALL>(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [course, setCourse] = useState<Course | typeof ALL>(ALL);

  useEffect(() => {
    let active = true;
    setRankingsLoading(true);
    setRankingsError(null);
    Promise.all([
      loadDatabaseRankingPreview('Men', event, course, GENDER_PREVIEW_SIZE, ageGroup),
      loadDatabaseRankingPreview('Women', event, course, GENDER_PREVIEW_SIZE, ageGroup),
    ])
      .then(([men, women]) => {
        if (!active) return;
        setMenRankings(men);
        setWomenRankings(women);
      })
      .catch(error => { if (active) setRankingsError(describeSupabaseError(error)); })
      .finally(() => { if (active) setRankingsLoading(false); });
    return () => { active = false; };
  }, [event, course, ageGroup]);

  const events = EVENTS.filter(item => !is25mEvent(item));
  const ageGroups = AGE_GROUPS;

  return (
    <div className="bg-[var(--paper)]">
      <PageHeading eyebrow="Rankings" title="Top swims by event" description="The fastest verified swims in each event. One row per athlete." />
      <section className="bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 pb-5 sm:pb-6">
          <div className="ta-filter-bar-full-bleed mb-5 flex flex-wrap items-end justify-between gap-4 border-y border-[var(--border)] bg-white py-3 md:h-24 md:items-center md:py-0">
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
