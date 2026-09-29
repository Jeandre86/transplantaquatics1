import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { results } from '../data/results';
import { athletes } from '../data/athletes';
import { countries } from '../data/countries';
import { AGE_GROUPS, COURSES, EVENTS } from '../types';
import ResultsTable from '../components/ResultsTable';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';
import FilterBar from '../components/FilterBar';
import PageHeading from '../components/PageHeading';
import DatasetNotice from '../components/DatasetNotice';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import VerificationLegend from '../components/VerificationLegend';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function GenderResultsPage() {
  const { gender: genderParam } = useParams<{ gender: string }>();
  const gender = genderParam?.toLowerCase() === 'men' ? 'Men' : genderParam?.toLowerCase() === 'women' ? 'Women' : null;
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState(ALL);
  const [event, setEvent] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [course, setCourse] = useState(ALL);
  const [verified, setVerified] = useState(ALL);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, country, event, ageGroup, course, verified]);

  if (!gender) return <Navigate to="/results" replace />;

  const athleteName = new Map(athletes.map(athlete => [athlete.id, `${athlete.firstName} ${athlete.lastName}`]));
  const filtered = results.filter(result => {
    const name = athleteName.get(result.athleteId) ?? '';
    if (result.gender !== gender) return false;
    if (search && !name.toLowerCase().includes(search.trim().toLowerCase()) && !result.meet.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (event !== ALL && result.event !== event) return false;
    if (ageGroup !== ALL && result.ageGroup !== ageGroup) return false;
    if (course !== ALL && result.course !== course) return false;
    if (verified !== ALL && result.verified.toLowerCase() !== verified.toLowerCase()) return false;
    if (country !== ALL) {
      const athlete = athletes.find(entry => entry.id === result.athleteId);
      if (!athlete || athlete.country !== country) return false;
    }
    return true;
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageResults = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const options = {
    country: [ALL, ...countries.map(entry => entry.name).sort()],
    event: [ALL, ...EVENTS],
    ageGroup: [ALL, ...AGE_GROUPS],
    course: [ALL, ...COURSES],
    verified: [ALL, 'Verified', 'Pending', 'Unverified'],
  };
  const hasFilters = [search, country, event, ageGroup, course, verified].some(value => value !== ALL && value !== '');
  const clearFilters = () => {
    setSearch('');
    setCountry(ALL);
    setEvent(ALL);
    setAgeGroup(ALL);
    setCourse(ALL);
    setVerified(ALL);
  };

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <PageHeading eyebrow="Worldwide Results" title={`${gender} results`} description={`Search and filter ${gender.toLowerCase()} swims across events and competitions.`}>
        <Link to="/results" className="inline-flex font-mono text-xs uppercase tracking-widest text-white/65 transition-colors hover:text-[var(--accent)]">← Worldwide results</Link>
      </PageHeading>

      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6"><DatasetNotice /></div>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
            <div>
              <Eyebrow>Results</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">{gender} swims</h2>
            </div>
            {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>

          <FilterBar className="mb-6">
            <div className="max-w-xl">
              <label htmlFor="gender-results-search" className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-neutral-600">Search athlete or meet</label>
              <SearchInput id="gender-results-search" value={search} onChange={setSearch} placeholder="Search athlete or meet name..." />
            </div>
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Country" value={country} options={options.country} onChange={setCountry} />
              <FilterSelect label="Event" value={event} options={options.event} onChange={setEvent} />
              <FilterSelect label="Age Group" value={ageGroup} options={options.ageGroup} onChange={setAgeGroup} />
              <FilterSelect label="Course" value={course} options={options.course} onChange={setCourse} />
              <FilterSelect label="Status" value={verified} options={options.verified} onChange={setVerified} />
            </div>
          </FilterBar>

          <div className="mb-4"><VerificationLegend /></div>

          <p className="mb-3 font-mono text-xs text-neutral-600">
            {filtered.length === 0 ? '0 results found' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} results`}
          </p>
          {filtered.length ? <>
            <ResultsTable results={pageResults} showAthlete />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label={`${gender} results pages`} />
          </> : <EmptyState title="No results match those filters" subtitle="Try adjusting your search or filters." action={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />}
        </div>
      </section>
    </div>
  );
}
