import { useEffect, useState } from 'react';
import { AGE_GROUPS, GENDERS, EVENTS, COURSES } from '../types';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import PageHeading from '../components/PageHeading';
import FilterBar from '../components/FilterBar';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { loadPublicSubmittedResults, type SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import DatabaseResultsTable from '../components/DatabaseResultsTable';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';
import { is25mEvent } from '../lib/utils';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const ALL = 'All';
const PAGE_SIZE = 10;
const RESULT_ACCURACY_NOTICE_KEY = 'results-accuracy-notice-dismissed-until';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function ResultsPage() {
  const [showAccuracyNotice, setShowAccuracyNotice] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState(ALL);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterAgeGroup, setFilterAgeGroup] = useState(ALL);
  const [filterGender, setFilterGender] = useState(ALL);
  const [filterCourse, setFilterCourse] = useState(ALL);
  const [page, setPage] = useState(1);
  const [submittedResults, setSubmittedResults] = useState<SubmittedSwimmerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const dismissedUntil = Number(window.localStorage.getItem(RESULT_ACCURACY_NOTICE_KEY));
    if (!Number.isFinite(dismissedUntil) || dismissedUntil <= Date.now()) {
      window.localStorage.removeItem(RESULT_ACCURACY_NOTICE_KEY);
      setShowAccuracyNotice(true);
    }
  }, []);

  const dismissAccuracyNotice = () => {
    window.localStorage.setItem(RESULT_ACCURACY_NOTICE_KEY, String(Date.now() + THIRTY_DAYS_MS));
    setShowAccuracyNotice(false);
  };

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
  }, [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterCourse]);

  const filtered = submittedResults.filter(result => {
    const query = search.trim().toLowerCase();
    const meetName = result.submitted_meets?.name ?? '';
    if (query && !result.swimmer_name.toLowerCase().includes(query) && !meetName.toLowerCase().includes(query)) return false;
    if (filterEvent !== ALL && result.event !== filterEvent) return false;
    if (filterAgeGroup !== ALL && result.age_group !== filterAgeGroup) return false;
    if (filterGender !== ALL && result.gender !== filterGender) return false;
    if (filterCourse !== ALL && result.submitted_meets?.course !== filterCourse) return false;
    if (filterCountry !== ALL && result.country !== filterCountry) return false;
    return true;
  }).sort((a, b) => Number(is25mEvent(a.event)) - Number(is25mEvent(b.event)));
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageResults = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const countryOptions = [ALL, ...new Set(submittedResults.map(result => result.country).filter(Boolean).sort())];
  const eventOptions = [ALL, ...new Set([...EVENTS, ...submittedResults.map(result => result.event)])]
    .slice(1)
    .sort((a, b) => Number(is25mEvent(a)) - Number(is25mEvent(b)) || a.localeCompare(b, undefined, { numeric: true }));
  eventOptions.unshift(ALL);
  const ageGroupOptions = [ALL, ...new Set([...AGE_GROUPS, ...submittedResults.map(result => result.age_group)])];
  const genderOptions = [ALL, ...new Set([...GENDERS, ...submittedResults.map(result => result.gender)])];
  const courseOptions = [ALL, ...new Set([...COURSES, ...submittedResults.map(result => result.submitted_meets?.course).filter((course): course is string => Boolean(course))])];
  const hasFilters = [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterCourse].some(value => value !== ALL && value !== '');
  const clearFilters = () => {
    setSearch(''); setFilterCountry(ALL); setFilterEvent(ALL); setFilterAgeGroup(ALL);
    setFilterGender(ALL); setFilterCourse(ALL);
  };

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      {/* Page header */}
      <PageHeading eyebrow="Results Database" title="Every swim counts." description="Explore results from transplant swimming competitions around the world." />

      <div className="max-w-7xl mx-auto px-4 py-10">
        {showAccuracyNotice && <aside className="mb-6 flex items-start justify-between gap-4 border border-[var(--border)] bg-white p-4 sm:p-5" role="status">
          <p className="text-sm leading-relaxed text-[var(--ink)]">If a time you submitted is incorrect, <Link to="/login" className="font-semibold text-[var(--blue)] underline underline-offset-2">log in</Link> and revisit the meet entry to update it to the correct time.</p>
          <button type="button" onClick={dismissAccuracyNotice} aria-label="Dismiss result accuracy reminder for 30 days" title="Dismiss for 30 days" className="shrink-0 p-1 text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><X size={18} /></button>
        </aside>}
        {/* Filters */}
          <div className="mb-8">
            <FilterBar className="mb-6" collapsible search={<div className="w-full max-w-xl">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search athlete or meet name..."
              />
            </div>}>
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Country" value={filterCountry} options={countryOptions} onChange={setFilterCountry} />
              <FilterSelect label="Event" value={filterEvent} options={eventOptions} onChange={setFilterEvent} />
              <FilterSelect label="Age Group" value={filterAgeGroup} options={ageGroupOptions} onChange={setFilterAgeGroup} />
              <FilterSelect label="Gender" value={filterGender} options={genderOptions} onChange={setFilterGender} />
              <FilterSelect label="Course" value={filterCourse} options={courseOptions} onChange={setFilterCourse} />
              {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters} className="self-end">Clear filters</Button>}
            </div>
            </FilterBar>
          {!loading && !loadError && <div className="font-mono text-xs text-neutral-600">
            {filtered.length === 0 ? '0 results found' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} results`}
          </div>}
        </div>

        {loading ? <SkeletonTable rows={8} columns={12} />
          : loadError ? <EmptyState title="Worldwide results are unavailable" subtitle={loadError} />
          : <>
            <DatabaseResultsTable results={pageResults} showCourse={false} showDate={false} showStatus={false} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Results pages" />
            {filtered.length === 0 && hasFilters && <div className="mt-4"><Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button></div>}
          </>}
      </div>
    </div>
  );
}
