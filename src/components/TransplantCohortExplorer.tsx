import { useEffect, useState } from 'react';
import { AGE_GROUPS, COURSES, EVENTS, GENDERS, TRANSPLANT_TYPES } from '../types';
import type { Ranking } from '../types';
import RankingTable from './RankingTable';
import FilterSelect from './FilterSelect';
import Eyebrow from './Eyebrow';
import { getTransplantPoints } from '../lib/transplantPoints';
import FilterBar from './FilterBar';
import Pagination from './Pagination';
import EmptyState from './EmptyState';
import Button from './Button';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from './Skeleton';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function TransplantCohortExplorer() {
  const [transplantType, setTransplantType] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [event, setEvent] = useState(ALL);
  const [course, setCourse] = useState(ALL);
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
  }, [transplantType, ageGroup, gender, event, course]);

  const hasFilters = [transplantType, ageGroup, gender, event, course].some(value => value !== ALL);
  const ageGroupOptions = [...new Set([...AGE_GROUPS, ...rankings.map(row => row.ageGroup)])];
  const eventOptions = [...new Set([...EVENTS, ...rankings.map(row => row.event)])];
  const filtered = rankings
    .filter(r => (transplantType === ALL || r.transplantType === transplantType)
      && (ageGroup === ALL || r.ageGroup === ageGroup)
      && (gender === ALL || r.gender === gender)
      && (event === ALL || r.event === event)
      && (course === ALL || r.course === course))
    .sort((a, b) => {
      const pointsA = getTransplantPoints(a);
      const pointsB = getTransplantPoints(b);
      if (pointsA !== null && pointsB !== null && pointsA !== pointsB) return pointsB - pointsA;
      if (pointsA !== null && pointsB === null) return -1;
      if (pointsA === null && pointsB !== null) return 1;
      return a.rank - b.rank || a.athleteName.localeCompare(b.athleteName);
    });
  const cohort = filtered.map((ranking, index) => ({ ...ranking, rank: index + 1 }));
  const rankPositions = new Map(cohort.map((ranking, index) => [
    [ranking.athleteId, ranking.ageGroup, ranking.gender, ranking.event, ranking.course].join('|'),
    index + 1,
  ]));
  const pageCount = Math.ceil(cohort.length / PAGE_SIZE);
  const pageRankings = cohort.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clearFilters = () => {
    setTransplantType(ALL);
    setAgeGroup(ALL);
    setGender(ALL);
    setEvent(ALL);
    setCourse(ALL);
  };

  return (
    <section style={{ backgroundColor: '#f4f2ed' }}>
      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <Eyebrow>Transplant cohort</Eyebrow>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">See where you rank</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">Browse swimmers ranked by World Aquatics PTS, then filter by transplant type, age group, event, gender, or course.</p>
          </div>
          {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
        </div>

        <FilterBar className="mb-6">
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Transplant Type" value={transplantType} options={[ALL, ...TRANSPLANT_TYPES]} onChange={setTransplantType} />
            <FilterSelect label="Age Group" value={ageGroup} options={[ALL, ...ageGroupOptions]} onChange={setAgeGroup} />
            <FilterSelect label="Gender" value={gender} options={[ALL, ...GENDERS]} onChange={setGender} />
            <FilterSelect label="Event" value={event} options={[ALL, ...eventOptions]} onChange={setEvent} />
            <FilterSelect label="Course" value={course} options={[ALL, ...COURSES]} onChange={setCourse} />
          </div>
        </FilterBar>

        {loading ? (
          <SkeletonTable rows={8} columns={5} />
        ) : loadError ? (
          <div role="alert" className="border border-red-300 bg-red-50 px-5 py-6 text-sm text-red-800">Rankings could not be loaded from the database. {loadError}</div>
        ) : cohort.length === 0 ? (
          <EmptyState title="No swimmers match these filters" subtitle="There are no published swims for these filters yet." action={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
        ) : (
          <>
            <p className="mb-3 font-mono text-xs text-neutral-600">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, cohort.length)} of {cohort.length} swimmers</p>
            <RankingTable
              rankings={pageRankings}
              showVerified={false}
              rankByPoints
              rankOffset={(page - 1) * PAGE_SIZE}
              rankPositions={rankPositions}
              showGap={false}
              genderCard
              paperSurface
              showAgeGroup
              showGender
              showEventMeta={false}
              title={hasFilters ? [transplantType, ageGroup, gender, event, course].filter(value => value !== ALL).join(' · ') : 'All swimmers'}
            />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Transplant cohort pages" />
          </>
        )}
      </div>
    </section>
  );
}
