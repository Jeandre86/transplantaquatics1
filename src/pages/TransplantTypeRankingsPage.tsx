import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rankings } from '../data/rankings';
import { AGE_GROUPS, COURSES, EVENTS, GENDERS, TRANSPLANT_TYPES } from '../types';
import type { Course, Event, Gender, TransplantType } from '../types';
import { timeToSeconds } from '../lib/utils';
import RankingTable from '../components/RankingTable';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import PageHeading from '../components/PageHeading';
import DatasetNotice from '../components/DatasetNotice';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function TransplantTypeRankingsPage() {
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
  const filteredRankings = rankings
    .filter(r => (transplantType === ALL || r.transplantType === transplantType)
      && (ageGroup === ALL || r.ageGroup === ageGroup)
      && (gender === ALL || r.gender === gender)
      && (event === ALL || r.event === event)
      && (course === ALL || r.course === course))
    .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time)
      || a.athleteName.localeCompare(b.athleteName));

  const rankPositions = new Map(filteredRankings.map((ranking, index) => [
    [ranking.athleteId, ranking.ageGroup, ranking.gender, ranking.event, ranking.course].join('|'),
    index + 1,
  ]));
  const pageCount = Math.ceil(filteredRankings.length / PAGE_SIZE);
  const pageRankings = filteredRankings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
          <div className="mb-6"><DatasetNotice /></div>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
            <div>
              <Eyebrow>Swim time leaderboard</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Fastest swims</h2>
            </div>
            {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>

          <FilterBar className="mb-6">
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Transplant Type" value={transplantType} options={[ALL, ...TRANSPLANT_TYPES]} onChange={value => setTransplantType(value as TransplantType | typeof ALL)} />
              <FilterSelect label="Age Group" value={ageGroup} options={[ALL, ...AGE_GROUPS]} onChange={setAgeGroup} />
              <FilterSelect label="Gender" value={gender} options={[ALL, ...GENDERS]} onChange={value => setGender(value as Gender | typeof ALL)} />
              <FilterSelect label="Event" value={event} options={[ALL, ...EVENTS]} onChange={value => setEvent(value as Event | typeof ALL)} />
              <FilterSelect label="Course" value={course} options={[ALL, ...COURSES]} onChange={value => setCourse(value as Course | typeof ALL)} />
            </div>
          </FilterBar>

          {filteredRankings.length === 0 ? (
            <EmptyState title="No swims match these filters" subtitle="Try changing a filter or reset them to see all available sample swims." action={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
          ) : (
            <>
              <p className="mb-3 font-mono text-xs text-neutral-600">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRankings.length)} of {filteredRankings.length} swims · sorted by fastest time</p>
              <RankingTable
                rankings={pageRankings}
                showVerified={false}
                rankByPoints
                rankOffset={(page - 1) * PAGE_SIZE}
                rankPositions={rankPositions}
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
