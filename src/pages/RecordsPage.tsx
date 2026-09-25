import { useEffect, useState } from 'react';
import { records } from '../data/records';
import RecordsTable from '../components/RecordsTable';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';
import EmptyState from '../components/EmptyState';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';

const ALL = 'All';
const PAGE_SIZE = 10;

export default function RecordsPage() {
  const [filterAgeGroup, setFilterAgeGroup] = useState(ALL);
  const [filterGender, setFilterGender] = useState(ALL);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterCourse, setFilterCourse] = useState(ALL);
  const [filterCategory, setFilterCategory] = useState(ALL);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, filterAgeGroup, filterGender, filterEvent, filterCourse, filterCategory]);

  const ageGroups = [...new Set(records.map(r => r.ageGroup))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const genders = [...new Set(records.map(r => r.gender))].sort();
  const events = [...new Set(records.map(r => r.event))].sort();
  const courses = [...new Set(records.map(r => r.course))].sort();
  const categories = [...new Set(records.map(r => r.category ?? 'Other'))].sort();

  const query = search.trim().toLowerCase();
  const filtered = records.filter(r => {
    if (filterAgeGroup !== ALL && r.ageGroup !== filterAgeGroup) return false;
    if (filterGender !== ALL && r.gender !== filterGender) return false;
    if (filterEvent !== ALL && r.event !== filterEvent) return false;
    if (filterCourse !== ALL && r.course !== filterCourse) return false;
    if (filterCategory !== ALL && r.category !== filterCategory) return false;
    if (query && ![r.event, r.ageGroup, r.gender, r.category, r.course, r.athleteName, r.country, r.meet]
      .some(value => value?.toLowerCase().includes(query))) return false;
    return true;
  });
  const hasActiveFilters = Boolean(search.trim()) || [filterAgeGroup, filterGender, filterCategory, filterEvent, filterCourse]
    .some(value => value !== ALL);

  const clearFilters = () => {
    setFilterAgeGroup(ALL);
    setFilterGender(ALL);
    setFilterCategory(ALL);
    setFilterEvent(ALL);
    setFilterCourse(ALL);
    setSearch('');
  };
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRecords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <div style={{ backgroundColor: "var(--navy)" }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Eyebrow light className="mb-3">World Records</Eyebrow>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
            Make history.
          </h1>
          <p style={{ color: "var(--muted-on-dark)" }} className="mt-4 text-base max-w-xl">
            Official World Transplant Games swimming record performances, filtered by age group, category, event and course.
          </p>
        </div>
      </div>

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
            <FilterSelect label="Event" value={filterEvent} options={[ALL, ...events]} onChange={setFilterEvent} />
            <FilterSelect label="Course" value={filterCourse} options={[ALL, ...courses]} onChange={setFilterCourse} />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-1.5 border border-neutral-300 font-mono text-xs uppercase tracking-wider text-neutral-700 transition-colors hover:border-neutral-500 hover:text-neutral-900"
              >
                Clear filters
              </button>
            )}
          </div>
        </FilterBar>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-neutral-600">
          <span>{filtered.length === 0 ? '0 records' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} records`}</span>
          {pageCount > 1 && <span>Page {page} of {pageCount}</span>}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No records found" subtitle="Adjust your filters to see records." />
        ) : (
          <>
            <RecordsTable records={pageRecords} />
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Record pages" />
          </>
        )}
      </div>
    </div>
  );
}
