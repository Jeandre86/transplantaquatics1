import { useEffect, useState } from 'react';
import { AGE_GROUPS, GENDERS, EVENTS } from '../types';
import PageHeading from '../components/PageHeading';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { loadPublicSubmittedResults, type SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import DatabaseResultsTable from '../components/DatabaseResultsTable';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';
import { is25mEvent } from '../lib/utils';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';

const ALL = 'All';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const RESULT_ACCURACY_NOTICE_KEY = 'results-accuracy-notice-dismissed-until';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function ResultsPage() {
  const [showAccuracyNotice, setShowAccuracyNotice] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState(ALL);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterAgeGroup, setFilterAgeGroup] = useState(ALL);
  const [filterGender, setFilterGender] = useState(ALL);
  const [filterStatus, setFilterStatus] = useState(ALL);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [pageSize, setPageSize] = useState(25);
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
  }, [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterStatus, sortOrder, pageSize]);

  const filtered = submittedResults.filter(result => {
    const query = search.trim().toLowerCase();
    const meetName = result.submitted_meets?.name ?? '';
    if (query && !result.swimmer_name.toLowerCase().includes(query) && !meetName.toLowerCase().includes(query)) return false;
    if (filterEvent !== ALL && result.event !== filterEvent) return false;
    if (filterAgeGroup !== ALL && result.age_group !== filterAgeGroup) return false;
    if (filterGender !== ALL && result.gender !== filterGender) return false;
    const resultStatus = result.status === 'verified' ? 'Verified' : result.status === 'imported_unverified' ? 'Unverified' : 'Pending';
    if (filterStatus !== ALL && resultStatus !== filterStatus) return false;
    if (filterCountry !== ALL && result.country !== filterCountry) return false;
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.submitted_meets?.meet_date || a.created_at).getTime();
    const dateB = new Date(b.submitted_meets?.meet_date || b.created_at).getTime();
    return (sortOrder === 'newest' ? dateB - dateA : dateA - dateB)
      || Number(is25mEvent(a.event)) - Number(is25mEvent(b.event));
  });
  const pageCount = Math.ceil(filtered.length / pageSize);
  const pageResults = filtered.slice((page - 1) * pageSize, page * pageSize);

  const countryOptions = [ALL, ...new Set(submittedResults.map(result => result.country).filter(Boolean).sort())];
  const eventOptions = [ALL, ...new Set([...EVENTS, ...submittedResults.map(result => result.event)])]
    .slice(1)
    .sort((a, b) => Number(is25mEvent(a)) - Number(is25mEvent(b)) || a.localeCompare(b, undefined, { numeric: true }));
  eventOptions.unshift(ALL);
  const ageGroupOptions = [ALL, ...new Set([...AGE_GROUPS, ...submittedResults.map(result => result.age_group)])];
  const genderOptions = [ALL, ...new Set([...GENDERS, ...submittedResults.map(result => result.gender)])];
  const hasFilters = [search, filterCountry, filterEvent, filterAgeGroup, filterGender, filterStatus].some(value => value !== ALL && value !== '');
  const clearFilters = () => {
    setSearch(''); setFilterCountry(ALL); setFilterEvent(ALL); setFilterAgeGroup(ALL);
    setFilterGender(ALL); setFilterStatus(ALL);
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

      <section className="ta-filter-bar-full-bleed border-y border-[var(--border)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search athlete or meet" aria-label="Search athlete or meet" className={`w-full pl-9 ${filterControlClass}`} />
            </div>
            {[
              { label: 'Country', value: filterCountry, set: setFilterCountry, options: countryOptions },
              { label: 'Event', value: filterEvent, set: setFilterEvent, options: eventOptions },
              { label: 'Age group', value: filterAgeGroup, set: setFilterAgeGroup, options: ageGroupOptions },
              { label: 'Gender', value: filterGender, set: setFilterGender, options: genderOptions },
              { label: 'Status', value: filterStatus, set: setFilterStatus, options: [ALL, 'Verified', 'Pending', 'Unverified'] },
            ].map(filter => <label key={filter.label} className={`inline-flex shrink-0 items-center gap-1.5 ${filterControlClass}`}>
              <span className="text-[var(--muted)]">{filter.label}:</span>
              <select value={filter.value} onChange={event => filter.set(event.target.value)} className="min-w-0 bg-transparent pr-1 font-medium outline-none">
                {filter.options.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>)}
            {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--ink)]" aria-live="polite">{loading ? 'Loading results…' : `${filtered.length.toLocaleString()} results`}</p>
            <label className="inline-flex h-[40px] items-center gap-1.5 border border-[var(--accent-dark)] bg-[var(--ice)] px-3 text-sm text-[var(--muted)]">
              <span>Sort:</span>
              <select value={sortOrder} onChange={event => setSortOrder(event.target.value as 'newest' | 'oldest')} className="bg-transparent pr-1 font-semibold text-[var(--ink)] outline-none">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="bg-[var(--paper)]">
      <div className="mx-auto max-w-7xl px-4 py-6">

        {loading ? <SkeletonTable rows={8} columns={12} />
          : loadError ? <EmptyState title="Worldwide results are unavailable" subtitle={loadError} />
          : <>
            <DatabaseResultsTable results={pageResults} layout="directory" />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Results pages" totalCount={filtered.length} pageSize={pageSize} pageSizeOptions={PAGE_SIZE_OPTIONS} onPageSizeChange={setPageSize} enhanced />
            {filtered.length === 0 && hasFilters && <div className="mt-4"><Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button></div>}
          </>}
        </div>
      </section>
    </div>
  );
}
