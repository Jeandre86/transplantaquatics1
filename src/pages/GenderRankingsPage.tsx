import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { Ranking } from '../types';
import { AGE_GROUPS, COURSES, EVENTS } from '../types';
import RankingTable from '../components/RankingTable';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';
import { getTransplantPoints } from '../lib/transplantPoints';
import { timeToSeconds } from '../lib/utils';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function GenderRankingsPage() {
  const { gender: genderParam } = useParams<{ gender: string }>();
  const gender = genderParam?.toLowerCase() === 'men' ? 'Men' : genderParam?.toLowerCase() === 'women' ? 'Women' : null;
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [event, setEvent] = useState(ALL);
  const [course, setCourse] = useState(ALL);
  const [rankMode, setRankMode] = useState<'Points' | 'Time'>('Points');
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
  }, [ageGroup, event, course, rankMode]);

  if (!gender) return <Navigate to="/rankings" replace />;

  const filtered = rankings
    .filter(r => r.gender === gender
      && (ageGroup === ALL || r.ageGroup === ageGroup)
      && (event === ALL || r.event === event)
      && (course === ALL || r.course === course))
    .sort((a, b) => {
      if (rankMode === 'Time') {
        return timeToSeconds(a.time) - timeToSeconds(b.time)
          || a.athleteName.localeCompare(b.athleteName);
      }
      const pointsA = getTransplantPoints(a);
      const pointsB = getTransplantPoints(b);
      if (pointsA !== null && pointsB !== null && pointsA !== pointsB) return pointsB - pointsA;
      if (pointsA !== null && pointsB === null) return -1;
      if (pointsA === null && pointsB !== null) return 1;
      return a.rank - b.rank || a.athleteName.localeCompare(b.athleteName);
    });
  const rankPositions = new Map(filtered.map((r, index) => [
    [r.athleteId, r.ageGroup, r.gender, r.event, r.course].join('|'),
    index + 1,
  ]));
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRankings = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasActiveFilters = [ageGroup, event, course].some(value => value !== ALL);

  const clearFilters = () => {
    setAgeGroup(ALL);
    setEvent(ALL);
    setCourse(ALL);
  };

  return (
    <div>
      <PageHeading eyebrow="World Rankings" title={`${gender} rankings`} description={`Explore ${gender.toLowerCase()} transplant swimmer performances. Choose whether to rank by World Aquatics PTS or fastest time, then filter by age group, event, or course.`}>
        <Link to="/rankings" className="inline-flex font-mono text-xs uppercase tracking-widest text-white/65 transition-colors hover:text-[var(--accent)]">← All rankings</Link>
      </PageHeading>

      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
            <div>
              <Eyebrow>Leaderboard</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">{gender} top swims by {rankMode.toLowerCase()}</h2>
            </div>
            {hasActiveFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>

          <FilterBar className="mb-6">
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Rank by" value={rankMode} options={['Points', 'Time']} onChange={value => setRankMode(value as 'Points' | 'Time')} />
              <FilterSelect label="Age Group" value={ageGroup} options={[ALL, ...AGE_GROUPS]} onChange={setAgeGroup} />
              <FilterSelect label="Event" value={event} options={[ALL, ...EVENTS]} onChange={setEvent} />
              <FilterSelect label="Course" value={course} options={[ALL, ...COURSES]} onChange={setCourse} />
            </div>
          </FilterBar>

          {loading ? (
            <SkeletonTable rows={8} columns={5} />
          ) : loadError ? (
            <p role="status" className="py-8 text-center text-sm text-red-700">Rankings could not be loaded: {loadError}</p>
          ) : filtered.length > 0 ? <>
            <p className="mb-3 font-mono text-xs text-neutral-600">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} ranking{filtered.length === 1 ? '' : 's'}</p>
            <RankingTable rankings={pageRankings} showVerified={false} rankByPoints rankOffset={(page - 1) * PAGE_SIZE} rankPositions={rankPositions} showGap={false} genderCard showEventMeta={false} paperSurface title={gender} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label={`${gender} ranking pages`} />
          </> : <EmptyState title="No swims match these filters" subtitle="Try another age group, event, or course, or clear your filters." action={hasActiveFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />}
        </div>
      </section>
    </div>
  );
}
