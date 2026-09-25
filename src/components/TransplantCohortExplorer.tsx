import { useEffect, useState } from 'react';
import { rankings } from '../data/rankings';
import { AGE_GROUPS, COURSES, EVENTS, GENDERS, TRANSPLANT_TYPES } from '../types';
import RankingTable from './RankingTable';
import FilterSelect from './FilterSelect';
import Eyebrow from './Eyebrow';
import { getTransplantPoints } from '../lib/transplantPoints';
import FilterBar from './FilterBar';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function TransplantCohortExplorer() {
  const [transplantType, setTransplantType] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [event, setEvent] = useState(ALL);
  const [course, setCourse] = useState(ALL);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [transplantType, ageGroup, gender, event, course]);

  const hasFilters = [transplantType, ageGroup, gender, event, course].some(value => value !== ALL);
  const cohort = rankings
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
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">Browse all swimmers ranked by TA points, then filter by transplant type, age group, event, gender, or course.</p>
          </div>
          {hasFilters && <button type="button" onClick={clearFilters} className="font-mono text-xs uppercase tracking-wider text-neutral-600 underline underline-offset-4 hover:text-black">Clear filters</button>}
        </div>

        <FilterBar className="mb-6">
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Transplant Type" value={transplantType} options={[ALL, ...TRANSPLANT_TYPES]} onChange={setTransplantType} />
            <FilterSelect label="Age Group" value={ageGroup} options={[ALL, ...AGE_GROUPS]} onChange={setAgeGroup} />
            <FilterSelect label="Gender" value={gender} options={[ALL, ...GENDERS]} onChange={setGender} />
            <FilterSelect label="Event" value={event} options={[ALL, ...EVENTS]} onChange={setEvent} />
            <FilterSelect label="Course" value={course} options={[ALL, ...COURSES]} onChange={setCourse} />
          </div>
        </FilterBar>

        {cohort.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] bg-white py-12 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">No swimmers match these filters</p>
          </div>
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
              showGenderInEvent
              title={hasFilters ? [transplantType, ageGroup, gender, event, course].filter(value => value !== ALL).join(' · ') : 'All swimmers'}
            />
            {pageCount > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Transplant cohort pages">
                <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="border border-neutral-300 px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="font-mono text-xs text-neutral-600">Page {page} of {pageCount}</span>
                <button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="border border-neutral-300 px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
