import { useEffect, useState } from 'react';
import { AGE_GROUPS, COURSES, GENDERS, TRANSPLANT_TYPES } from '../types';
import type { Ranking } from '../types';
import RankingTable from './RankingTable';
import FilterSelect from './FilterSelect';
import { getTransplantPoints } from '../lib/transplantPoints';
import FilterBar from './FilterBar';
import Pagination from './Pagination';
import EmptyState from './EmptyState';
import Button from './Button';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from './Skeleton';
import SearchInput from './SearchInput';

const ALL = 'All';
const PAGE_SIZE = 25;

export default function TransplantCohortExplorer() {
  const [transplantType, setTransplantType] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [course, setCourse] = useState(ALL);
  const [search, setSearch] = useState('');
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
  }, [transplantType, ageGroup, gender, course, search]);

  const hasFilters = [transplantType, ageGroup, gender, course].some(value => value !== ALL) || Boolean(search.trim());
  const ageGroupOptions = [...new Set([...AGE_GROUPS, ...rankings.map(row => row.ageGroup)])];
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = rankings
    .filter(r => (transplantType === ALL || r.transplantType === transplantType)
      && (ageGroup === ALL || r.ageGroup === ageGroup)
      && (gender === ALL || r.gender === gender)
      && (course === ALL || r.course === course)
      && (!normalizedSearch || `${r.athleteName} ${r.country} ${r.countryCode}`.toLowerCase().includes(normalizedSearch)))
    .sort((a, b) => {
      const pointsA = getTransplantPoints(a);
      const pointsB = getTransplantPoints(b);
      if (pointsA !== null && pointsB !== null && pointsA !== pointsB) return pointsB - pointsA;
      if (pointsA !== null && pointsB === null) return -1;
      if (pointsA === null && pointsB !== null) return 1;
      return a.rank - b.rank || String(a.athleteName ?? '').localeCompare(String(b.athleteName ?? ''));
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
    setCourse(ALL);
    setSearch('');
  };

  return (
    <section className="bg-[var(--paper)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[var(--ink)]">All swimmers</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Every athlete’s best swim, ranked by points.</p>
          </div>
          {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
        </div>

        <FilterBar className="mb-4 border-y border-[var(--border)] bg-white px-3 py-3 sm:px-4" compact search={<div className="min-w-[230px] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search swimmer or country" /></div>}>
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Transplant Type" value={transplantType} options={[ALL, ...TRANSPLANT_TYPES]} onChange={setTransplantType} />
            <FilterSelect label="Age Group" value={ageGroup} options={[ALL, ...ageGroupOptions]} onChange={setAgeGroup} />
            <FilterSelect label="Gender" value={gender} options={[ALL, ...GENDERS]} onChange={setGender} />
            <FilterSelect label="Course" value={course} options={[ALL, ...COURSES]} onChange={setCourse} />
          </div>
        </FilterBar>

        {!loading && !loadError && <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]"><span className="font-semibold text-[var(--ink)]">{cohort.length.toLocaleString()} swimmers</span>{hasFilters && <span className="rounded-full bg-[var(--navy)] px-3 py-1 font-medium text-white">Filtered view</span>}</div>}

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
              showEventColumn
              paperSurface
              showAgeGroup
              ageGroupWithGender
              showEventMeta={false}
            />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Transplant cohort pages" />
          </>
        )}
      </div>
    </section>
  );
}
