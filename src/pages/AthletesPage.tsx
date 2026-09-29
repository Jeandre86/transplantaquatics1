import { useState, useMemo, useEffect } from 'react';
import { athletes } from '../data/athletes';
import { AGE_GROUPS, GENDERS, TRANSPLANT_TYPES } from '../types';
import AthleteDirectoryTable from '../components/AthleteDirectoryTable';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import PageHeading from '../components/PageHeading';
import DatasetNotice from '../components/DatasetNotice';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';

const countries = [...new Set(athletes.map(a => a.country))].sort();
const PAGE_SIZE = 10;
const ALL = 'All';

export default function AthletesPage() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [transplant, setTransplant] = useState(ALL);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return athletes.filter(a => {
      const q = search.toLowerCase();
      if (q && !`${a.firstName} ${a.lastName}`.toLowerCase().includes(q) && !a.country.toLowerCase().includes(q) && !(a.club || '').toLowerCase().includes(q)) return false;
      if (country !== ALL && a.country !== country) return false;
      if (gender !== ALL && a.gender !== gender) return false;
      if (ageGroup !== ALL && a.ageGroup !== ageGroup) return false;
      if (transplant !== ALL && a.transplantType !== transplant) return false;
      return true;
    });
  }, [search, country, gender, ageGroup, transplant]);

  useEffect(() => setPage(1), [search, country, gender, ageGroup, transplant]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageAthletes = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <PageHeading eyebrow="Athletes" title="Find your people." description="Explore swimmers from every country, age group and transplant background." />

      {/* Search & Filters */}
      <section className="border-b border-neutral-200" style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search athlete, country or club…" />
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Country" value={country} options={[ALL, ...countries]} onChange={setCountry} />
              <FilterSelect label="Gender" value={gender} options={[ALL, ...GENDERS]} onChange={setGender} />
              <FilterSelect label="Age Group" value={ageGroup} options={[ALL, ...AGE_GROUPS]} onChange={setAgeGroup} />
              <FilterSelect label="Transplant Type" value={transplant} options={[ALL, ...TRANSPLANT_TYPES]} onChange={setTransplant} />
              {(search || country !== ALL || gender !== ALL || ageGroup !== ALL || transplant !== ALL) && (
                <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setCountry(ALL); setGender(ALL); setAgeGroup(ALL); setTransplant(ALL); }}>Clear filters</Button>
              )}
            </div>
          </FilterBar>
        </div>
      </section>

      {/* Results */}
      <section style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6"><DatasetNotice /></div>
          <div className="flex items-center justify-between mb-6">
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-500">
              {filtered.length ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} athletes` : '0 athletes'}
            </span>
          </div>
          {filtered.length > 0 ? (
            <AthleteDirectoryTable athletes={pageAthletes} showCountryColumn />
          ) : (
            <EmptyState title="No athletes found" subtitle="Try adjusting your search or filters to see more athletes." action={<Button variant="secondary" size="sm" onClick={() => { setSearch(''); setCountry(ALL); setGender(ALL); setAgeGroup(ALL); setTransplant(ALL); }}>Clear search and filters</Button>} />
          )}
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Athlete pages" />
        </div>
      </section>
    </div>
  );
}
