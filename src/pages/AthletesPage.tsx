import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { AGE_GROUPS, GENDERS, TRANSPLANT_TYPES, type Ranking } from '../types';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { getFlagEmoji, timeToSeconds } from '../lib/utils';
import { normalizeCompetitionAgeGroup } from '../lib/competitionAge';
import Pagination from '../components/Pagination';
import PageHeading from '../components/PageHeading';
import { describeSupabaseError } from '../lib/supabase';
import { SkeletonTable } from '../components/Skeleton';
import { getSavedAvatar } from '../lib/avatars';

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

function bestSwimLabel(swim?: Ranking) {
  if (!swim) return null;
  return { time: swim.time, event: swim.event };
}

export default function AthletesPage() {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState(ALL);
  const [gender, setGender] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [transplant, setTransplant] = useState(ALL);
  const [page, setPage] = useState(1);
  const [athletes, setAthletes] = useState<PublicSwimmerProfile[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([loadPublicSwimmerDirectory(), loadDatabaseRankings()]).then(([directoryResult, rankingsResult]) => {
      if (!active) return;
      if (directoryResult.status === 'rejected') {
        setLoadError(`The athlete directory could not be loaded from Supabase. ${describeSupabaseError(directoryResult.reason)}`);
        return;
      }
      setAthletes(directoryResult.value);
      if (rankingsResult.status === 'fulfilled') setRankings(rankingsResult.value);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const countries = useMemo(() => [...new Set(athletes.map(athlete => athlete.country).filter((value): value is string => Boolean(value)))].sort(), [athletes]);
  const bestSwims = useMemo(() => {
    const best = new Map<string, Ranking>();
    rankings.slice().sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time)).forEach(swim => {
      if (!best.has(swim.athleteId)) best.set(swim.athleteId, swim);
    });
    return best;
  }, [rankings]);
  const filtered = useMemo(() => athletes.filter(athlete => {
    const query = search.trim().toLowerCase();
    const fullName = `${athlete.first_name} ${athlete.last_name}`;
    const searchable = `${fullName} ${athlete.country ?? ''} ${athlete.club_name ?? ''}`.toLowerCase();
    return (!query || searchable.includes(query))
      && (country === ALL || athlete.country === country)
      && (gender === ALL || normalizedGender(athlete.gender) === gender)
      && (ageGroup === ALL || normalizeCompetitionAgeGroup(athlete.age_group) === ageGroup)
      && (transplant === ALL || normalizedTransplant(athlete.transplant_type) === transplant);
  }).sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)), [athletes, search, country, gender, ageGroup, transplant]);

  useEffect(() => setPage(1), [search, country, gender, ageGroup, transplant]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageAthletes = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return <div className="bg-[var(--paper)]">
    <PageHeading eyebrow="Athletes" title="Find your people." description="Swimmers from every country, age group and transplant background." />
    <section className="border-b border-[var(--border)] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto_auto_auto_auto] sm:items-center">
          <div className="relative min-w-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by athlete, club or country" aria-label="Search by athlete, club or country" className="h-[34px] w-full border border-[var(--border)] bg-[var(--paper)] pl-8 pr-3 text-[10px] text-[var(--ink)] outline-none focus:border-[var(--accent-dark)]" />
          </div>
          {[
            { label: 'Country', value: country, set: setCountry, options: [ALL, ...countries] },
            { label: 'Gender', value: gender, set: setGender, options: [ALL, ...GENDERS] },
            { label: 'Age group', value: ageGroup, set: setAgeGroup, options: [ALL, ...AGE_GROUPS] },
            { label: 'Transplant', value: transplant, set: setTransplant, options: [ALL, ...TRANSPLANT_TYPES] },
          ].map(filter => <label key={filter.label} className="flex h-[34px] items-center gap-1 border border-[var(--border)] bg-white px-2 text-[9px] text-[var(--muted)]">
            <span className="shrink-0">{filter.label}:</span>
            <select value={filter.value} onChange={event => filter.set(event.target.value)} className="min-w-0 appearance-none bg-transparent pr-4 text-[9px] font-medium text-[var(--ink)] outline-none">
              {filter.options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>)}
        </div>
        <div className="mt-2 flex items-center justify-between text-[9px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">{loading ? 'Loading athletes…' : `${filtered.length.toLocaleString()} athletes`}</span>
          <span>Sorted A–Z by surname</span>
        </div>
      </div>
    </section>

    <section>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:py-5">
        {loading ? <SkeletonTable rows={8} columns={6} />
          : loadError ? <p role="alert" className="border border-red-200 bg-white p-5 text-sm text-red-800">{loadError}</p>
            : filtered.length ? <>
              <div className="ta-table-shell">
                <table className="border-collapse bg-white text-left text-sm">
                  <thead><tr className="ta-table-header">
                    <th className="w-[30%] whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Athlete <span className="text-[var(--accent)]">↓</span></th>
                    <th className="w-[18%] whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Country ↕</th>
                    <th className="w-[15%] whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Age group ↕</th>
                    <th className="w-[15%] whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Transplant ↕</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">Best swim ↕</th>
                    <th className="w-8 px-2 py-3" />
                  </tr></thead>
                  <tbody>{pageAthletes.map(athlete => {
                    const swim = bestSwimLabel(bestSwims.get(athlete.id));
                    const avatarUrl = getSavedAvatar(athlete.first_name, athlete.last_name);
                    const age = normalizeCompetitionAgeGroup(athlete.age_group);
                    const genderLabel = normalizedGender(athlete.gender);
                    const initials = `${athlete.first_name?.[0] ?? ''}${athlete.last_name?.[0] ?? ''}`;
                    return <tr key={athlete.id} className="ta-table-row">
                      <td className="px-3 py-4 sm:px-5"><Link to={`/athletes/${athlete.id}`} className="flex min-w-52 items-center gap-2.5 text-[var(--ink)] hover:text-[var(--accent-dark)]">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ice)] text-[10px] font-semibold text-[var(--navy)] sm:h-11 sm:w-11">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}</span>
                        <span className="min-w-0"><span className="block truncate font-semibold">{athlete.first_name} {athlete.last_name}</span><span className="block truncate text-xs text-[var(--muted)]">{athlete.club_name || '—'}</span></span>
                      </Link></td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--ink)] sm:px-5"><span className="mr-1.5 text-base" aria-hidden="true">{getFlagEmoji(athlete.country_code ?? '')}</span>{athlete.country || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{age || athlete.age_group || 'Unknown'}{genderLabel !== '—' ? ` · ${genderLabel}` : ''}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{normalizedTransplant(athlete.transplant_type)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right sm:px-5"><span className="block font-mono text-base font-bold text-[var(--navy)]">{swim?.time ?? '—'}</span><span className="block text-[10px] text-[var(--muted)]">{swim?.event ?? 'No swim recorded'}</span></td>
                      <td className="px-2 py-4 text-right"><Link to={`/athletes/${athlete.id}`} aria-label={`View ${athlete.first_name} ${athlete.last_name}`}><ChevronRight size={15} className="text-[var(--muted)]" /></Link></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Athlete pages" totalCount={filtered.length} pageSize={PAGE_SIZE} enhanced />
            </> : <div className="border border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">No athletes match these filters.</div>}
      </div>
    </section>
  </div>;
}
