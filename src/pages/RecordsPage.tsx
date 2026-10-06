import { useEffect, useState } from 'react';
import type { Record as WorldRecord } from '../types';
import { loadWorldRecords } from '../lib/worldRecords';
import RecordsTable from '../components/RecordsTable';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import PageHeading from '../components/PageHeading';
import Button from '../components/Button';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';
import { is25mEvent } from '../lib/utils';
import { Search } from 'lucide-react';

const ALL = 'All';
const PAGE_SIZE = 25;
const RECORD_TYPES = ['Athlete records', 'Donor records'] as const;

export default function RecordsPage() {
  const [records, setRecords] = useState<WorldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [filterEvent, setFilterEvent] = useState('100m Backstroke');
  const [filterCourse, setFilterCourse] = useState('LCM');
  const [filterHolderType, setFilterHolderType] = useState<(typeof RECORD_TYPES)[number]>('Athlete records');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    loadWorldRecords().then(rows => {
      if (active) setRecords(rows);
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(`World records could not be loaded from Supabase. ${describeSupabaseError(error)}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [search, filterEvent, filterCourse, filterHolderType]);

  useEffect(() => {
    if (records.length && !records.some(record => record.event === filterEvent)) setFilterEvent(records[0].event);
    if (records.length && !records.some(record => record.course === filterCourse)) setFilterCourse(records[0].course);
  }, [records, filterEvent, filterCourse]);

  const events = [...new Set(records.map(r => r.event))]
    .sort((a, b) => Number(is25mEvent(a)) - Number(is25mEvent(b)) || a.localeCompare(b, undefined, { numeric: true }));
  const courses = [...new Set(records.map(r => r.course))].sort();

  const query = search.trim().toLowerCase();
  const filtered = records.filter(r => {
    const isDonor = r.category?.trim().toLowerCase() === 'donor';
    if (filterHolderType === 'Donor records' && !isDonor) return false;
    if (filterHolderType === 'Athlete records' && isDonor) return false;
    if (filterEvent !== ALL && r.event !== filterEvent) return false;
    if (filterCourse !== ALL && r.course !== filterCourse) return false;
    if (query && ![r.event, r.ageGroup, r.gender, r.category, r.course, r.athleteName, r.country, r.meet]
      .some(value => value?.toLowerCase().includes(query))) return false;
    return true;
  }).sort((a, b) => Number(is25mEvent(a.event)) - Number(is25mEvent(b.event)));
  const hasActiveFilters = Boolean(search.trim()) || [filterEvent, filterCourse]
    .some(value => value !== ALL);

  const clearFilters = () => {
    setFilterEvent(events[0] ?? ALL);
    setFilterCourse(courses[0] ?? ALL);
    setFilterHolderType('Athlete records');
    setSearch('');
  };
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRecords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const ageGroupCount = new Set(filtered.map(record => record.ageGroup)).size;

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <PageHeading eyebrow="World Records" title="Make history." description="Explore swimming records by age group, category, event and course." />

      <section className="ta-filter-bar-full-bleed border-y border-[var(--border)] bg-white md:h-24">
        <div className="mx-auto max-w-7xl px-4 py-4 md:flex md:h-full md:items-center md:py-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search event, athlete, country or meet" aria-label="Search records" className="h-10 w-full border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-dark)]" />
            </div>
            <label className="inline-flex h-10 items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">Event:
              <select value={filterEvent} onChange={event => setFilterEvent(event.target.value)} className="min-w-0 bg-transparent pr-1 font-medium text-[var(--ink)] outline-none">
                {events.map(event => <option key={event} value={event}>{event}</option>)}
              </select>
            </label>
            <label className="inline-flex h-10 items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">Type:
              <select value={filterHolderType} onChange={event => setFilterHolderType(event.target.value as (typeof RECORD_TYPES)[number])} className="min-w-0 bg-transparent pr-1 font-medium text-[var(--ink)] outline-none">
                {RECORD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="ml-auto inline-flex h-10 items-center gap-1.5 border border-[var(--accent-dark)] bg-[var(--ice)] px-3 text-sm text-[var(--muted)]">Course:
              <select value={filterCourse} onChange={event => setFilterCourse(event.target.value)} className="bg-transparent pr-1 font-semibold text-[var(--ink)] outline-none">
                {[ALL, ...courses].map(course => <option key={course} value={course}>{course === ALL ? ALL : course === 'LCM' ? 'Long course' : course === 'SCM' ? 'Short course' : course}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 py-6">
        {loading ? <SkeletonTable rows={6} columns={3} />
          : loadError ? <EmptyState title="World record data is unavailable" subtitle={loadError} action={<Button variant="secondary" size="sm" onClick={() => setReload(value => value + 1)}>Try again</Button>} />
          : <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold text-[var(--ink)]">{filterEvent}</h2><span className="text-sm text-[var(--muted)]">{ageGroupCount} age groups · {filterCourse === ALL ? 'All courses' : filterCourse === 'LCM' ? 'Long course' : 'Short course'}</span></div>
        {filtered.length === 0 ? <EmptyState title="No records found" subtitle="No records match this search and event." action={hasActiveFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Reset filters</Button> : undefined} /> : (
          <>
            <RecordsTable records={pageRecords} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Record pages" />
          </>
        )}
          </>}
        </div>
      </section>
    </div>
  );
}
