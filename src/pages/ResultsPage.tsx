import { useEffect, useState } from 'react';
import { results } from '../data/results';
import { athletes } from '../data/athletes';
import { countries } from '../data/countries';
import { AGE_GROUPS, GENDERS, EVENTS, COURSES } from '../types';
import ResultsTable from '../components/ResultsTable';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import TopSwimsSection from '../components/TopSwimsSection';
import PageHeading from '../components/PageHeading';
import DatasetNotice from '../components/DatasetNotice';
import FilterBar from '../components/FilterBar';
import VerificationLegend from '../components/VerificationLegend';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function ResultsPage() {
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState(ALL);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterAgeGroup, setFilterAgeGroup] = useState(ALL);
  const [filterGender, setFilterGender] = useState(ALL);
  const [filterCourse, setFilterCourse] = useState(ALL);
  const [filterVerified, setFilterVerified] = useState(ALL);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterCourse, filterVerified]);

  const athleteNameMap: Record<string, string> = {};
  athletes.forEach(a => { athleteNameMap[a.id] = `${a.firstName} ${a.lastName}`; });

  const filtered = results.filter(r => {
    const name = athleteNameMap[r.athleteId] ?? '';
    if (search && !name.toLowerCase().includes(search.toLowerCase()) && !r.meet.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEvent !== ALL && r.event !== filterEvent) return false;
    if (filterAgeGroup !== ALL && r.ageGroup !== filterAgeGroup) return false;
    if (filterGender !== ALL && r.gender !== filterGender) return false;
    if (filterCourse !== ALL && r.course !== filterCourse) return false;
    if (filterVerified !== ALL && r.verified !== filterVerified) return false;
    if (filterCountry !== ALL) {
      const athlete = athletes.find(a => a.id === r.athleteId);
      if (!athlete || athlete.country !== filterCountry) return false;
    }
    return true;
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageResults = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const countryOptions = [ALL, ...countries.map(c => c.name).sort()];
  const eventOptions = [ALL, ...EVENTS];
  const ageGroupOptions = [ALL, ...AGE_GROUPS];
  const genderOptions = [ALL, ...GENDERS];
  const courseOptions = [ALL, ...COURSES];
  const verifiedOptions = [ALL, 'Verified', 'Pending', 'Unverified'];
  const hasFilters = [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterCourse, filterVerified].some(value => value !== ALL && value !== '');
  const clearFilters = () => {
    setSearch(''); setFilterCountry(ALL); setFilterEvent(ALL); setFilterAgeGroup(ALL);
    setFilterGender(ALL); setFilterCourse(ALL); setFilterVerified(ALL);
  };

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      {/* Page header */}
      <PageHeading eyebrow="Results Database" title="Every swim counts." description="Explore results from transplant swimming competitions around the world." />

      <div className="max-w-7xl mx-auto px-4 py-10">
        <TopSwimsSection />
        {/* Filters */}
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-black tracking-tight text-[var(--ink)]">Worldwide Results</h2>
            <div className="mb-5"><DatasetNotice /></div>
            <FilterBar className="mb-6">
            <div className="max-w-xl">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search athlete or meet name..."
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Country" value={filterCountry} options={countryOptions} onChange={setFilterCountry} />
              <FilterSelect label="Event" value={filterEvent} options={eventOptions} onChange={setFilterEvent} />
              <FilterSelect label="Age Group" value={filterAgeGroup} options={ageGroupOptions} onChange={setFilterAgeGroup} />
              <FilterSelect label="Gender" value={filterGender} options={genderOptions} onChange={setFilterGender} />
              <FilterSelect label="Course" value={filterCourse} options={courseOptions} onChange={setFilterCourse} />
              <FilterSelect label="Status" value={filterVerified} options={verifiedOptions} onChange={setFilterVerified} />
              {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters} className="self-end">Clear filters</Button>}
            </div>
            </FilterBar>
          <div className="font-mono text-xs text-neutral-600">
            {filtered.length === 0 ? '0 results found' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} results`}
          </div>
          <div className="mt-4"><VerificationLegend /></div>
        </div>

        {filtered.length > 0 ? <>
          <ResultsTable results={pageResults} showAthlete />
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Results pages" />
        </> : <EmptyState title="No results match those filters" subtitle="Try changing your search or filters, or reset them to see all available sample results." action={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />}
      </div>
    </div>
  );
}
