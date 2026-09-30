import { useEffect, useState } from 'react';
import type { Record as WorldRecord } from '../types';
import { loadWorldRecords } from '../lib/worldRecords';
import RecordsTable from '../components/RecordsTable';
import FilterSelect from '../components/FilterSelect';
import EmptyState from '../components/EmptyState';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import PageHeading from '../components/PageHeading';
import FilterBar from '../components/FilterBar';
import Button from '../components/Button';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function RecordsPage() {
  const [records, setRecords] = useState<WorldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [filterAgeGroup, setFilterAgeGroup] = useState(ALL);
  const [filterGender, setFilterGender] = useState(ALL);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterCourse, setFilterCourse] = useState(ALL);
  const [filterCategory, setFilterCategory] = useState(ALL);
  const [filterHolderType, setFilterHolderType] = useState(ALL);
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
  }, [search, filterAgeGroup, filterGender, filterEvent, filterCourse, filterCategory, filterHolderType]);

  const ageGroups = [...new Set(records.map(r => r.ageGroup))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const genders = [...new Set(records.map(r => r.gender))].sort();
  const events = [...new Set(records.map(r => r.event))].sort();
  const courses = [...new Set(records.map(r => r.course))].sort();
  const categories = [...new Set(records.map(r => r.category ?? 'Other'))].sort();

  const query = search.trim().toLowerCase();
  const filtered = records.filter(r => {
    const isDonor = r.category?.trim().toLowerCase() === 'donor';
    if (filterHolderType === 'Donors' && !isDonor) return false;
    if (filterHolderType === 'Swimmers' && isDonor) return false;
    if (filterAgeGroup !== ALL && r.ageGroup !== filterAgeGroup) return false;
    if (filterGender !== ALL && r.gender !== filterGender) return false;
    if (filterEvent !== ALL && r.event !== filterEvent) return false;
    if (filterCourse !== ALL && r.course !== filterCourse) return false;
    if (filterCategory !== ALL && r.category !== filterCategory) return false;
    if (query && ![r.event, r.ageGroup, r.gender, r.category, r.course, r.athleteName, r.country, r.meet]
      .some(value => value?.toLowerCase().includes(query))) return false;
    return true;
  });
  const hasActiveFilters = Boolean(search.trim()) || [filterAgeGroup, filterGender, filterCategory, filterEvent, filterCourse, filterHolderType]
    .some(value => value !== ALL);

  const clearFilters = () => {
    setFilterAgeGroup(ALL);
    setFilterGender(ALL);
    setFilterCategory(ALL);
    setFilterEvent(ALL);
    setFilterCourse(ALL);
    setFilterHolderType(ALL);
    setSearch('');
  };
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRecords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <PageHeading eyebrow="World Records" title="Make history." description="Explore swimming records by age group, category, event and course." />

      <div className="max-w-7xl mx-auto px-4 py-10">
        <FilterBar className="mb-6">
          <div className="max-w-xl">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search event, athlete, country or meet..."
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Age Group" value={filterAgeGroup} options={[ALL, ...ageGroups]} onChange={setFilterAgeGroup} />
            <FilterSelect label="Gender" value={filterGender} options={[ALL, ...genders]} onChange={setFilterGender} />
            <FilterSelect label="Category" value={filterCategory} options={[ALL, ...categories]} onChange={setFilterCategory} />
            <FilterSelect label="Record Holder" value={filterHolderType} options={[ALL, 'Swimmers', 'Donors']} onChange={setFilterHolderType} />
            <FilterSelect label="Event" value={filterEvent} options={[ALL, ...events]} onChange={setFilterEvent} />
            <FilterSelect label="Course" value={filterCourse} options={[ALL, ...courses]} onChange={setFilterCourse} />
            {hasActiveFilters && (
              <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        </FilterBar>

        {loading ? <SkeletonTable rows={8} columns={7} />
          : loadError ? <EmptyState title="World record data is unavailable" subtitle={loadError} action={<Button variant="secondary" size="sm" onClick={() => setReload(value => value + 1)}>Try again</Button>} />
          : <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-neutral-600">
          <span>{filtered.length === 0 ? '0 records' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} records`}</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No records found" subtitle="No verified records match these filters." action={hasActiveFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
        ) : (
          <>
            <RecordsTable records={pageRecords} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Record pages" />
          </>
        )}
          </>}
      </div>
    </div>
  );
}
