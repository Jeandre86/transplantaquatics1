import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AGE_GROUPS, TRANSPLANT_TYPES } from '../types';
import { loadPublicSwimmerDirectoryPage, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { getFlagEmoji } from '../lib/utils';
import { normalizeCompetitionAgeGroup } from '../lib/competitionAge';
import Pagination from '../components/Pagination';
import PageHeading from '../components/PageHeading';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';
import { getSavedAvatar } from '../lib/avatars';
import SortableTable from '../components/SortableTable';
import SearchInput from '../components/SearchInput';

const PAGE_SIZE = 25;
const ALL = 'All';

function normalizedGender(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'men' || normalized === 'male' || normalized === 'boys') return 'Men';
  if (normalized === 'women' || normalized === 'woman' || normalized === 'female' || normalized === 'girls') return 'Women';
  return value || '—';
}

function normalizedTransplant(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/\s+transplant$/, '');
  if (normalized === 'kidney') return 'Kidney';
  if (normalized === 'liver') return 'Liver';
  if (normalized === 'heart') return 'Heart';
  if (normalized === 'lung') return 'Lung';
  if (normalized === 'pancreas') return 'Pancreas';
  if (normalized === 'bone marrow' || normalized === 'marrow') return 'Bone Marrow';
  if (normalized === 'donor' || normalized === 'living donor') return 'Donor';
  return value || 'Not shared';
}

function bestSwimLabel(athlete: PublicSwimmerProfile) {
  return athlete.best_swim_time ? { time: athlete.best_swim_time, event: athlete.best_swim_event ?? '' } : null;
}

export default function AthletesPage() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [transplant, setTransplant] = useState(ALL);
  const [page, setPage] = useState(1);
  const [athletes, setAthletes] = useState<PublicSwimmerProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => setPage(1), [search, country, gender, ageGroup, transplant]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    loadPublicSwimmerDirectoryPage({ search, country, gender, ageGroup, transplant, page, pageSize: PAGE_SIZE })
      .then(result => {
        if (!active) return;
        setAthletes(result.rows);
        setTotalCount(result.totalCount);
        setCountryOptions(result.countryOptions);
      })
      .catch(error => { if (active) setLoadError(`The athlete directory could not be loaded from Supabase. ${describeSupabaseError(error)}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, country, gender, ageGroup, transplant, page]);

  const pageCount = Math.ceil(totalCount / PAGE_SIZE);
  const pageAthletes = athletes;

  return <div className="bg-[var(--paper)]">
    <PageHeading eyebrow="Athletes" title="Find your people." description="Swimmers from every country, age group and transplant background." />
    <section className="border-b border-[var(--border)] bg-white md:h-24">
      <div className="mx-auto max-w-7xl px-4 py-4 md:flex md:h-full md:items-center md:py-0">
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto_auto_auto_auto] sm:items-center">
          <div className="min-w-0">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by athlete, club or country" />
          </div>
          {[
            { label: 'Country', value: country, set: setCountry, options: [ALL, ...countryOptions] },
            { label: 'Age group', value: ageGroup, set: setAgeGroup, options: [ALL, ...AGE_GROUPS] },
            { label: 'Transplant', value: transplant, set: setTransplant, options: [ALL, ...TRANSPLANT_TYPES] },
          ].map(filter => <label key={filter.label} className="flex h-[42px] items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">
            <span className="shrink-0">{filter.label}:</span>
            <select value={filter.value} onChange={event => filter.set(event.target.value)} className="min-w-0 appearance-none bg-transparent pr-5 text-sm font-medium text-[var(--ink)] outline-none">
              {filter.options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>)}
        </div>
      </div>
    </section>

    <section>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:py-5">
        <div className="mb-4 flex justify-end" role="group" aria-label="Filter athletes by gender">
          <div className="inline-flex border border-[var(--border)] bg-white p-1">
            {[ALL, 'Men', 'Women'].map(option => <button
              key={option}
              type="button"
              aria-pressed={gender === option}
              onClick={() => setGender(option)}
              className={`min-h-9 px-4 text-sm transition-colors ${gender === option ? 'bg-[var(--navy)] font-semibold text-white' : 'text-[var(--ink)] hover:bg-[var(--ice)]'}`}
            >{option}</button>)}
          </div>
        </div>
        {loading ? <SkeletonTable rows={8} columns={6} />
          : loadError ? <p role="alert" className="border border-red-200 bg-white p-5 text-sm text-red-800">{loadError}</p>
            : athletes.length ? <>
              <div className="ta-table-shell">
                <SortableTable showSortIndicator initialSort={{ column: 0, direction: 'asc' }}><table className="border-collapse bg-white text-left text-sm">
                  <thead><tr className="ta-table-header">
                    <th className="w-[30%] whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Athlete</th>
                    <th className="w-[18%] whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Country</th>
                    <th className="w-[15%] whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Age group</th>
                    <th className="w-[15%] whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Transplant</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Best swim</th>
                  </tr></thead>
                  <tbody>{pageAthletes.map(athlete => {
                    const swim = bestSwimLabel(athlete);
                    const avatarUrl = getSavedAvatar(athlete.first_name, athlete.last_name);
                    const age = normalizeCompetitionAgeGroup(athlete.age_group);
                    const genderLabel = normalizedGender(athlete.gender);
                    const initials = `${athlete.first_name?.[0] ?? ''}${athlete.last_name?.[0] ?? ''}`;
                    return <tr key={athlete.id} className="ta-table-row">
                      <td data-sort-value={`${athlete.last_name} ${athlete.first_name}`} className="px-3 py-4 sm:px-5"><Link to={`/athletes/${athlete.id}`} className="flex min-w-52 items-center gap-2.5 text-[var(--ink)] hover:text-[var(--accent-dark)]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ice)] text-[10px] font-semibold text-[var(--navy)] sm:h-11 sm:w-11">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}</span>
                        <span className="min-w-0"><span className="block truncate font-semibold">{athlete.first_name} {athlete.last_name}</span><span className="block truncate text-xs text-[var(--muted)]">{athlete.club_name || '—'}</span></span>
                      </Link></td>
                      <td data-sort-value={athlete.country ?? ''} className="whitespace-nowrap px-3 py-4 text-sm text-[var(--ink)] sm:px-5"><span className="mr-1.5 text-base" aria-hidden="true">{getFlagEmoji(athlete.country_code ?? '')}</span>{athlete.country || '—'}</td>
                      <td data-sort-value={`${age || athlete.age_group || 'Unknown'} ${genderLabel}`} className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{age || athlete.age_group || 'Unknown'}{genderLabel !== '—' ? ` · ${genderLabel}` : ''}</td>
                      <td data-sort-value={normalizedTransplant(athlete.transplant_type)} className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{normalizedTransplant(athlete.transplant_type)}</td>
                      <td data-sort-value={swim?.time ?? ''} className="whitespace-nowrap px-3 py-4 text-right sm:px-5"><span className="block font-mono text-base font-bold text-[var(--navy)]">{swim?.time ?? '—'}</span><span className="block text-[10px] text-[var(--muted)]">{swim?.event ?? 'No swim recorded'}</span></td>
                    </tr>;
                  })}</tbody>
                </table></SortableTable>
              </div>
              <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Athlete pages" totalCount={totalCount} pageSize={PAGE_SIZE} enhanced />
            </> : <div className="border border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">No athletes match these filters.</div>}
      </div>
    </section>
  </div>;
}
