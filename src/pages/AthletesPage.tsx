import { useState, useMemo, useEffect } from 'react';
import { athletes } from '../data/athletes';
import { AGE_GROUPS, GENDERS, TRANSPLANT_TYPES } from '../types';
import AthleteDirectoryRow from '../components/AthleteDirectoryRow';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';

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
      <section style={{ backgroundColor: "var(--navy)", borderBottom: "1px solid var(--navy-light)" }}>
        <div className="max-w-7xl mx-auto px-4 py-16">
          <Eyebrow color="accent">Athletes</Eyebrow>
          <h1 className="mt-4 text-white font-bold text-5xl md:text-6xl">Find your people.</h1>
          <p style={{ color: "var(--muted-on-dark)" }} className="mt-4 max-w-xl">
            Explore swimmers from every country, age group and transplant background.
          </p>
        </div>
      </section>

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
                <button
                  onClick={() => { setSearch(''); setCountry(ALL); setGender(ALL); setAgeGroup(ALL); setTransplant(ALL); }}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-neutral-300 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </FilterBar>
        </div>
      </section>

      {/* Results */}
      <section style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-500">
              {filtered.length ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} athletes` : '0 athletes'}
            </span>
          </div>
          {filtered.length > 0 ? (
            <div className="overflow-hidden border border-neutral-200 bg-white">
              <div className="grid grid-cols-[76px_minmax(0,1fr)_28px] items-center gap-3 border-b border-neutral-200 bg-[#f4f5f6] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-neutral-600 sm:grid-cols-[92px_minmax(140px,1.5fr)_90px_minmax(130px,1fr)_28px] sm:gap-4 sm:px-5 sm:text-xs md:grid-cols-[98px_minmax(160px,1.5fr)_100px_145px_minmax(140px,1fr)_28px] lg:grid-cols-[110px_minmax(200px,1.7fr)_110px_155px_minmax(160px,1fr)_28px]">
                <span>Country</span>
                <span>Athlete</span>
                <span className="hidden sm:block">Gender</span>
                <span className="hidden md:block">DOB</span>
                <span className="hidden sm:block">Transplant Type</span>
                <span aria-hidden="true" />
              </div>
              {pageAthletes.map((athlete, index) => <AthleteDirectoryRow key={athlete.id} athlete={athlete} index={index} />)}
            </div>
          ) : (
            <div className="py-24 text-center border border-neutral-200">
              <p className="font-bold text-xl" style={{ color: 'var(--ink)' }}>No athletes found</p>
              <p className="text-neutral-500 mt-2 text-sm">Try adjusting your filters or search term</p>
            </div>
          )}
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Athlete pages" />
        </div>
      </section>
    </div>
  );
}
