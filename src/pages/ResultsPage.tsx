import { useEffect, useState } from 'react';
import { results } from '../data/results';
import { athletes } from '../data/athletes';
import { countries } from '../data/countries';
import { AGE_GROUPS, GENDERS, EVENTS, COURSES } from '../types';
import ResultsTable from '../components/ResultsTable';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';
import TopSwimsSection from '../components/TopSwimsSection';
import FilterBar from '../components/FilterBar';

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

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      {/* Page header */}
      <div style={{ backgroundColor: "var(--navy)" }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Eyebrow light className="mb-3">Results Database</Eyebrow>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
            Every swim counts.
          </h1>
          <p style={{ color: "var(--muted-on-dark)" }} className="mt-4 text-base max-w-xl">
            The complete results database for transplant swimming worldwide.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <TopSwimsSection />
        {/* Filters */}
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-black tracking-tight text-[var(--ink)]">Worldwide Results</h2>
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
            </div>
            </FilterBar>
          <div className="font-mono text-xs text-neutral-600">
            {filtered.length === 0 ? '0 results found' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} results`}
          </div>
        </div>

        <ResultsTable results={pageResults} showAthlete />
        {pageCount > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Results pages">
            <button
              type="button"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={page === 1}
              className="border border-neutral-300 px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono text-xs text-neutral-600">Page {page} of {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage(current => Math.min(pageCount, current + 1))}
              disabled={page === pageCount}
              className="border border-neutral-300 px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
