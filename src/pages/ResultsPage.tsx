import { useEffect, useState } from 'react';
import { AGE_GROUPS, GENDERS, EVENTS, COURSES } from '../types';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import PageHeading from '../components/PageHeading';
import FilterBar from '../components/FilterBar';
import VerificationLegend from '../components/VerificationLegend';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { loadPublicSubmittedResults, type SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import DatabaseResultsTable from '../components/DatabaseResultsTable';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';

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
  const [submittedResults, setSubmittedResults] = useState<SubmittedSwimmerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    loadPublicSubmittedResults()
      .then(rows => {
        if (!active) return;
        setSubmittedResults(rows);
      })
      .catch(error => {
        if (active) setLoadError(`Worldwide results could not be loaded from Supabase. ${describeSupabaseError(error)}`);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterCourse, filterVerified]);

  const filtered = submittedResults.filter(result => {
    const query = search.trim().toLowerCase();
    const meetName = result.submitted_meets?.name ?? '';
    if (query && !result.swimmer_name.toLowerCase().includes(query) && !meetName.toLowerCase().includes(query)) return false;
    if (filterEvent !== ALL && result.event !== filterEvent) return false;
    if (filterAgeGroup !== ALL && result.age_group !== filterAgeGroup) return false;
    if (filterGender !== ALL && result.gender !== filterGender) return false;
    if (filterCourse !== ALL && result.submitted_meets?.course !== filterCourse) return false;
    const verificationStatus = result.status === 'verified' ? 'Verified' : 'Pending';
    if (filterVerified !== ALL && verificationStatus !== filterVerified) return false;
    if (filterCountry !== ALL && result.country !== filterCountry) return false;
    return true;
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageResults = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const countryOptions = [ALL, ...new Set(submittedResults.map(result => result.country).filter(Boolean).sort())];
  const eventOptions = [ALL, ...new Set([...EVENTS, ...submittedResults.map(result => result.event)])];
  const ageGroupOptions = [ALL, ...new Set([...AGE_GROUPS, ...submittedResults.map(result => result.age_group)])];
  const genderOptions = [ALL, ...new Set([...GENDERS, ...submittedResults.map(result => result.gender)])];
  const courseOptions = [ALL, ...new Set([...COURSES, ...submittedResults.map(result => result.submitted_meets?.course).filter((course): course is string => Boolean(course))])];
  const verifiedOptions = [ALL, 'Verified', 'Pending'];
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
        {/* Filters */}
          <div className="mb-8">
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
          {!loading && !loadError && <div className="font-mono text-xs text-neutral-600">
            {filtered.length === 0 ? '0 results found' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} results`}
          </div>}
          <div className="mt-4"><VerificationLegend /></div>
        </div>

        {loading ? <SkeletonTable rows={8} columns={12} />
          : loadError ? <EmptyState title="Worldwide results are unavailable" subtitle={loadError} />
          : <>
            <DatabaseResultsTable results={pageResults} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Results pages" />
            {filtered.length === 0 && hasFilters && <div className="mt-4"><Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button></div>}
          </>}
      </div>
    </div>
  );
}
