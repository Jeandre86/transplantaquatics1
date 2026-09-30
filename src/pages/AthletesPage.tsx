import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AGE_GROUPS, GENDERS, TRANSPLANT_TYPES } from '../types';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { getCountryAlpha3, getFlagEmoji } from '../lib/utils';
import SearchInput from '../components/SearchInput';
import FilterSelect from '../components/FilterSelect';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';
import { getSavedAvatar } from '../lib/avatars';

const PAGE_SIZE = 10;
const ALL = 'All';

export default function AthletesPage() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [transplant, setTransplant] = useState(ALL);
  const [page, setPage] = useState(1);
  const [athletes, setAthletes] = useState<PublicSwimmerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    loadPublicSwimmerDirectory().then(rows => {
      if (active) setAthletes(rows);
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(`The athlete directory could not be loaded from Supabase. ${describeSupabaseError(error)}`);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const countries = useMemo(() => [...new Set(athletes.map(athlete => athlete.country))].sort(), [athletes]);
  const ageGroups = useMemo(() => [...new Set([...AGE_GROUPS, 'Under 18', ...athletes.map(athlete => athlete.age_group)])].sort(), [athletes]);
  const filtered = useMemo(() => athletes.filter(athlete => {
    const query = search.trim().toLowerCase();
    const searchable = `${athlete.first_name} ${athlete.last_name} ${athlete.country} ${athlete.club_name ?? ''}`.toLowerCase();
    return (!query || searchable.includes(query))
      && (country === ALL || athlete.country === country)
      && (gender === ALL || athlete.gender === gender)
      && (ageGroup === ALL || athlete.age_group === ageGroup)
      && (transplant === ALL || athlete.transplant_type === transplant);
  }), [athletes, search, country, gender, ageGroup, transplant]);

  useEffect(() => setPage(1), [search, country, gender, ageGroup, transplant]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageAthletes = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(search || country !== ALL || gender !== ALL || ageGroup !== ALL || transplant !== ALL);
  const clearFilters = () => { setSearch(''); setCountry(ALL); setGender(ALL); setAgeGroup(ALL); setTransplant(ALL); };

  return <div>
    <PageHeading eyebrow="Athletes" title="Find your people." description="Explore swimmers from every country, age group and transplant background." />
    <section className="border-b border-neutral-200" style={{ backgroundColor: 'var(--paper)' }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search athlete, country or club…" />
          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Country" value={country} options={[ALL, ...countries]} onChange={setCountry} />
            <FilterSelect label="Gender" value={gender} options={[ALL, ...GENDERS]} onChange={setGender} />
            <FilterSelect label="Age Group" value={ageGroup} options={[ALL, ...ageGroups]} onChange={setAgeGroup} />
            <FilterSelect label="Transplant Type" value={transplant} options={[ALL, ...TRANSPLANT_TYPES]} onChange={setTransplant} />
            {hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>
        </FilterBar>
      </div>
    </section>
    <section style={{ backgroundColor: 'var(--paper)' }}>
      <div className="max-w-7xl mx-auto px-4 py-10">
        {loading ? <SkeletonTable rows={6} columns={6} />
          : loadError ? <EmptyState title="Athlete data is unavailable" subtitle={loadError} />
            : <>
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-neutral-500">{filtered.length ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} athletes` : '0 athletes'}</span>
              </div>
              {pageAthletes.length ? <div className="ta-table-shell">
                <div className="ta-table-header grid grid-cols-[86px_minmax(0,1fr)_90px_100px_minmax(120px,1fr)_minmax(105px,auto)] items-center gap-3 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:gap-4 sm:px-5 sm:text-xs">
                  <span>Country</span><span>Athlete</span><span>Gender</span><span>Age group</span><span>Transplant type</span><span className="text-right">Profile</span>
                </div>
                <div>{pageAthletes.map(athlete => {
                  const avatarUrl = getSavedAvatar(athlete.first_name, athlete.last_name);
                  return <Link key={athlete.id} to={`/athletes/${athlete.id}`} className="ta-table-row group grid grid-cols-[86px_minmax(0,1fr)_90px_100px_minmax(120px,1fr)_minmax(105px,auto)] items-center gap-3 px-3 py-4 sm:gap-4 sm:px-5">
                  <span className="flex min-w-0 items-center gap-1.5" title={athlete.country}><span className="ta-table-flag" aria-hidden="true">{getFlagEmoji(athlete.country_code ?? '')}</span><span className="font-mono text-[10px] font-semibold tracking-wider text-[var(--muted)]">{getCountryAlpha3(athlete.country_code ?? '')}</span></span>
                  <span className="flex min-w-0 items-center gap-3 text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--navy)] font-mono text-xs font-bold text-white" aria-hidden="true">
                      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : `${athlete.first_name[0] ?? ''}${athlete.last_name[0] ?? ''}`}
                    </span>
                    <span className="min-w-0 truncate">{athlete.first_name} {athlete.last_name}</span>
                  </span>
                  <span className="text-sm text-[var(--muted)]">{athlete.gender}</span>
                  <span className="font-mono text-xs text-[var(--muted)]">{athlete.age_group}</span>
                  <span className="truncate text-sm text-[var(--muted)]">{athlete.transplant_type}</span>
                  <span className="flex items-center justify-end gap-2 whitespace-nowrap text-xs font-semibold text-[var(--muted)] group-hover:text-[var(--accent-dark)]"><span>View profile</span><ArrowRight size={15} /></span>
                  </Link>;
                })}</div>
              </div> : <EmptyState title="No athletes found" subtitle={athletes.length ? 'Try adjusting your search or filters.' : 'Swimmer profiles will appear here when swimmers join.'} action={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear search and filters</Button> : undefined} />}
              {filtered.length > 0 && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Athlete pages" />}
            </>}
      </div>
    </section>
  </div>;
}
