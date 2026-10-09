import { useEffect, useState } from 'react';
import { AGE_GROUPS, EVENTS } from '../types';
import PageHeading from '../components/PageHeading';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { loadPublicResultsPage, type PublicResultsFilterOptions, type SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import DatabaseResultsTable from '../components/DatabaseResultsTable';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';
import { is25mEvent } from '../lib/utils';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';

const ALL = 'All';
const SWIM_TYPES = ['Individual', 'Relay'] as const;
const RESULTS_GENDERS = [ALL, 'Men', 'Women'] as const;
const RESULTS_PAGE_SIZE = 10;
const RESULT_ACCURACY_NOTICE_KEY = 'results-accuracy-notice-dismissed-until';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function ResultsPage() {
  const [showAccuracyNotice, setShowAccuracyNotice] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState(ALL);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterAgeGroup, setFilterAgeGroup] = useState(ALL);
  const [filterGender, setFilterGender] = useState(ALL);
  const [filterSwimType, setFilterSwimType] = useState<string>(ALL);
  const pageSize = RESULTS_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const [submittedResults, setSubmittedResults] = useState<SubmittedSwimmerResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filterOptions, setFilterOptions] = useState<PublicResultsFilterOptions>({ countries: [], events: [], ageGroups: [] });
  const [debouncedSearch, setDebouncedSearch] = useState(search);
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
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    loadPublicResultsPage({ search: debouncedSearch, country: filterCountry, event: filterEvent, ageGroup: filterAgeGroup, gender: filterGender, swimType: filterSwimType, page, pageSize })
      .then(result => {
        if (!active) return;
        setSubmittedResults(result.rows);
        setTotalCount(result.totalCount);
        setFilterOptions(result.options);
      })
      .catch(error => {
        if (active) setLoadError(`Worldwide results could not be loaded from Supabase. ${describeSupabaseError(error)}`);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedSearch, filterCountry, filterEvent, filterAgeGroup, filterGender, filterSwimType, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterSwimType]);

  const pageCount = Math.ceil(totalCount / pageSize);
  const countryOptions = [ALL, ...filterOptions.countries];
  const eventOptions = [ALL, ...new Set([...EVENTS, ...filterOptions.events])]
    .slice(1)
    .sort((a, b) => Number(is25mEvent(a)) - Number(is25mEvent(b)) || a.localeCompare(b, undefined, { numeric: true }));
  eventOptions.unshift(ALL);
  const ageGroupOptions = [ALL, ...new Set([...AGE_GROUPS, ...filterOptions.ageGroups])];
  const hasFilters = [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterSwimType].some(value => value !== ALL && value !== '');
  const clearFilters = () => {
    setSearch(''); setFilterCountry(ALL); setFilterEvent(ALL); setFilterAgeGroup(ALL);
    setFilterSwimType(ALL); setFilterGender(ALL);
  };

  const filterControlClass = 'h-[40px] border border-[var(--border)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-dark)]';

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      {/* Page header */}
      <PageHeading eyebrow="Results Database" title="Every swim counts." description="Explore results from transplant swimming competitions around the world." />

      <div className="mx-auto max-w-7xl px-4 py-0">
        {showAccuracyNotice && <aside className="mb-6 flex items-start justify-between gap-4 border border-[var(--border)] bg-white p-4 sm:p-5" role="status">
          <p className="text-sm leading-relaxed text-[var(--ink)]">If a time you submitted is incorrect, <Link to="/login" className="font-semibold text-[var(--blue)] underline underline-offset-2">log in</Link> and revisit the meet entry to update it to the correct time.</p>
          <button type="button" onClick={dismissAccuracyNotice} aria-label="Dismiss result accuracy reminder for 30 days" title="Dismiss for 30 days" className="shrink-0 p-1 text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><X size={18} /></button>
        </aside>}
      </div>

      <section className="ta-filter-bar-full-bleed border-y border-[var(--border)] bg-white md:h-24 md:flex md:items-center">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 md:py-0">
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <div className="relative min-w-[200px] flex-1 lg:min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search athlete or meet" aria-label="Search athlete or meet" className={`w-full pl-9 ${filterControlClass}`} />
            </div>
            {[
              { label: 'Country', value: filterCountry, set: setFilterCountry, options: countryOptions },
              { label: 'Event', value: filterEvent, set: setFilterEvent, options: eventOptions },
              { label: 'Age group', value: filterAgeGroup, set: setFilterAgeGroup, options: ageGroupOptions },
              { label: 'Swim type', value: filterSwimType, set: setFilterSwimType, options: [ALL, ...SWIM_TYPES] },
            ].map(filter => <label key={filter.label} className={`inline-flex shrink-0 items-center gap-1.5 px-2.5 ${filterControlClass}`}>
              <span className="text-[var(--muted)]">{filter.label}:</span>
              <select value={filter.value} onChange={event => filter.set(event.target.value)} className="min-w-0 bg-transparent pr-1 font-medium outline-none">
                {filter.options.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>)}
            {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>
        </div>
      </section>

      <section className="bg-[var(--paper)]">
      <div className="mx-auto max-w-7xl px-4 py-6">

        <div className="mb-4 flex justify-end" role="group" aria-label="Filter results by gender">
          <div className="inline-flex border border-[var(--border)] bg-white p-1">
            {RESULTS_GENDERS.map(gender => <button
              key={gender}
              type="button"
              aria-pressed={filterGender === gender}
              onClick={() => setFilterGender(gender)}
              className={`min-h-9 px-4 text-sm transition-colors ${filterGender === gender ? 'bg-[var(--navy)] font-semibold text-white' : 'text-[var(--ink)] hover:bg-[var(--ice)]'}`}
            >{gender}</button>)}
          </div>
        </div>

        {loading ? <SkeletonTable rows={8} columns={12} />
          : loadError ? <EmptyState title="Worldwide results are unavailable" subtitle={loadError} />
          : <>
            <DatabaseResultsTable results={submittedResults} layout="directory" />
            {totalCount > pageSize && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Results pages" totalCount={totalCount} pageSize={pageSize} enhanced />}
            {totalCount === 0 && hasFilters && <div className="mt-4"><Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button></div>}
          </>}
        </div>
      </section>
    </div>
  );
}
