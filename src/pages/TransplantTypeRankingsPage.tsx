import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AGE_GROUPS, COURSES, EVENTS, GENDERS, TRANSPLANT_TYPES } from '../types';
import type { Course, Event, Gender, TransplantType } from '../types';
import { timeToSeconds } from '../lib/utils';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import RankingTable from '../components/RankingTable';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { SkeletonTable } from '../components/Skeleton';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function TransplantTypeRankingsPage() {
  const [transplantType, setTransplantType] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [event, setEvent] = useState(ALL);
  const [course, setCourse] = useState(ALL);
  const [page, setPage] = useState(1);
  const [rankings, setRankings] = useState<Awaited<ReturnType<typeof loadDatabaseRankings>>>([]);
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
  }, [transplantType, ageGroup, gender, event, course]);

  const hasFilters = [transplantType, ageGroup, gender, event, course].some(value => value !== ALL);
  const matchingSwims = rankings
    .filter(r => (transplantType === ALL || r.transplantType === transplantType)
      && (ageGroup === ALL || r.ageGroup === ageGroup)
      && (gender === ALL || r.gender === gender)
      && (event === ALL || r.event === event)
      && (course === ALL || r.course === course));
  const personalBests = new Map<string, typeof matchingSwims[number]>();
  matchingSwims.forEach(swim => {
    const key = [swim.athleteId, swim.event, swim.gender, swim.course].join('|');
    const current = personalBests.get(key);
    if (!current || timeToSeconds(swim.time) < timeToSeconds(current.time)) personalBests.set(key, swim);
  });
  const filteredRankings = [...personalBests.values()].sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time)
    || a.athleteName.localeCompare(b.athleteName));

  const ageGroupOptions = [...new Set([...AGE_GROUPS, ...rankings.map(row => row.ageGroup)])];
  const eventOptions = [...new Set([...EVENTS, ...rankings.map(row => row.event)])];
  const rankedResults: typeof filteredRankings = [];
  const categoryRanks = new Map<string, number>();
  [...filteredRankings]
    .sort((a, b) => a.event.localeCompare(b.event)
      || a.gender.localeCompare(b.gender)
      || a.course.localeCompare(b.course)
      || timeToSeconds(a.time) - timeToSeconds(b.time)
      || a.athleteName.localeCompare(b.athleteName))
    .forEach(swim => {
      const category = [swim.event, swim.gender, swim.course].join('|');
      const rank = (categoryRanks.get(category) ?? 0) + 1;
      categoryRanks.set(category, rank);
      rankedResults.push({ ...swim, rank });
    });
  const pageCount = Math.ceil(rankedResults.length / PAGE_SIZE);
  const pageRankings = rankedResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilters = () => {
    setTransplantType(ALL);
    setAgeGroup(ALL);
    setGender(ALL);
    setEvent(ALL);
    setCourse(ALL);
  };

  return (
    <div>
      <PageHeading eyebrow="Explore swim times" title="Rank by transplant type" description="All ranked swims are shown by fastest time. Use the filters to compare a transplant type, age group, gender, event, or course.">
        <Link to="/rankings" className="inline-flex font-mono text-xs uppercase tracking-widest text-white/65 transition-colors hover:text-[var(--accent)]">← All rankings</Link>
      </PageHeading>

      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
            <div>
              <Eyebrow>Swim time leaderboard</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Fastest swims</h2>
            </div>
            {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>

          <FilterBar className="mb-6" collapsible>
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Transplant Type" value={transplantType} options={[ALL, ...TRANSPLANT_TYPES]} onChange={value => setTransplantType(value as TransplantType | typeof ALL)} />
              <FilterSelect label="Age Group" value={ageGroup} options={[ALL, ...ageGroupOptions]} onChange={setAgeGroup} />
              <FilterSelect label="Gender" value={gender} options={[ALL, ...GENDERS]} onChange={value => setGender(value as Gender | typeof ALL)} />
              <FilterSelect label="Event" value={event} options={[ALL, ...eventOptions]} onChange={value => setEvent(value as Event | typeof ALL)} />
              <FilterSelect label="Course" value={course} options={[ALL, ...COURSES]} onChange={value => setCourse(value as Course | typeof ALL)} />
            </div>
          </FilterBar>

          {loading ? (
            <SkeletonTable rows={8} columns={5} />
          ) : loadError ? (
            <div role="alert" className="border border-red-300 bg-red-50 px-5 py-6 text-sm text-red-800">
              Athlete rankings could not be loaded from the database. {loadError}
            </div>
          ) : filteredRankings.length === 0 ? (
            <EmptyState title="No swims match these filters" subtitle="There are no published swims for these filters yet." action={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
          ) : (
            <>
              <p className="mb-3 font-mono text-xs text-neutral-600">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rankedResults.length)} of {rankedResults.length} personal bests · rank is calculated within each event, gender, and course</p>
              <RankingTable
                rankings={pageRankings}
                showVerified={false}
                rankByPoints={false}
                showGap={false}
                showPoints={false}
                genderCard
                paperSurface
                showGenderInEvent
                title="All swimmers"
              />
              <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Transplant type ranking pages" />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
