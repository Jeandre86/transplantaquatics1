import { useState, useMemo } from 'react';
import { athletes } from '../data/athletes';
import { AGE_GROUPS, GENDERS, TRANSPLANT_TYPES } from '../types';
import AthleteCard from '../components/AthleteCard';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import Eyebrow from '../components/Eyebrow';

const countries = [...new Set(athletes.map(a => a.country))].sort();

export default function AthletesPage() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [transplant, setTransplant] = useState('');

  const filtered = useMemo(() => {
    return athletes.filter(a => {
      const q = search.toLowerCase();
      if (q && !`${a.firstName} ${a.lastName}`.toLowerCase().includes(q) && !a.country.toLowerCase().includes(q) && !(a.club || '').toLowerCase().includes(q)) return false;
      if (country && a.country !== country) return false;
      if (gender && a.gender !== gender) return false;
      if (ageGroup && a.ageGroup !== ageGroup) return false;
      if (transplant && a.transplantType !== transplant) return false;
      return true;
    });
  }, [search, country, gender, ageGroup, transplant]);

  return (
    <div>
      {/* Header */}
      <section style={{ backgroundColor: "var(--navy)", borderBottom: "1px solid var(--navy-light)" }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <Eyebrow color="accent">Athletes</Eyebrow>
          <h1 className="mt-4 text-white font-bold text-5xl md:text-6xl">Find your people.</h1>
          <p style={{ color: "var(--muted-on-dark)" }} className="mt-4 max-w-xl">
            Explore swimmers from every country, age group and transplant background.
          </p>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="border-b border-neutral-200" style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-col gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search athlete, country or club…" />
            <div className="flex flex-wrap gap-3">
              <FilterSelect label="Country" value={country} options={countries} onChange={setCountry} />
              <FilterSelect label="Gender" value={gender} options={GENDERS} onChange={setGender} />
              <FilterSelect label="Age Group" value={ageGroup} options={AGE_GROUPS} onChange={setAgeGroup} />
              <FilterSelect label="Transplant Type" value={transplant} options={TRANSPLANT_TYPES} onChange={setTransplant} />
              {(search || country || gender || ageGroup || transplant) && (
                <button
                  onClick={() => { setSearch(''); setCountry(''); setGender(''); setAgeGroup(''); setTransplant(''); }}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-neutral-300 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-500">
              {filtered.length} athlete{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(a => <AthleteCard key={a.id} athlete={a} />)}
            </div>
          ) : (
            <div className="py-24 text-center border border-neutral-200">
              <p className="font-bold text-xl" style={{ color: 'var(--ink)' }}>No athletes found</p>
              <p className="text-neutral-500 mt-2 text-sm">Try adjusting your filters or search term</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
