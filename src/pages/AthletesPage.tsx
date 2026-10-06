import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { AGE_GROUPS, GENDERS, TRANSPLANT_TYPES, type Ranking } from '../types';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { getFlagEmoji, timeToSeconds } from '../lib/utils';
import { normalizeCompetitionAgeGroup } from '../lib/competitionAge';
import Pagination from '../components/Pagination';
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
    <header className="bg-[var(--navy)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:py-8">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Find your people.</h1>
        <p className="mt-1 text-xs text-white/70">Swimmers from every country, age group and transplant background.</p>
      </div>
    </header>
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse bg-white text-left text-[9px]">
                  <thead className="bg-[var(--navy)] text-white"><tr>
                    <th className="w-[30%] px-2.5 py-2 font-semibold">Athlete <span className="text-[var(--accent)]">↓</span></th>
                    <th className="w-[18%] px-2.5 py-2 font-medium">Country ↕</th>
                    <th className="w-[15%] px-2.5 py-2 font-medium">Age group ↕</th>
                    <th className="w-[15%] px-2.5 py-2 font-medium">Transplant ↕</th>
                    <th className="px-2.5 py-2 text-right font-medium">Best swim ↕</th>
                    <th className="w-6 px-1 py-2" />
                  </tr></thead>
                  <tbody>{pageAthletes.map(athlete => {
                    const swim = bestSwimLabel(bestSwims.get(athlete.id));
                    const avatarUrl = getSavedAvatar(athlete.first_name, athlete.last_name);
                    const age = normalizeCompetitionAgeGroup(athlete.age_group);
                    const genderLabel = normalizedGender(athlete.gender);
                    const initials = `${athlete.first_name?.[0] ?? ''}${athlete.last_name?.[0] ?? ''}`;
                    return <tr key={athlete.id} className="border-b border-[var(--border)] hover:bg-white">
                      <td className="px-2.5 py-1.5"><Link to={`/athletes/${athlete.id}`} className="flex items-center gap-2 text-[var(--ink)] hover:text-[var(--accent-dark)]">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ice)] text-[8px] font-semibold text-[var(--navy)]">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}</span>
                        <span className="min-w-0"><span className="block truncate font-semibold">{athlete.first_name} {athlete.last_name}</span><span className="block truncate text-[8px] text-[var(--muted)]">{athlete.club_name || '—'}</span></span>
                      </Link></td>
                      <td className="px-2.5 py-1.5 text-[var(--ink)]"><span className="mr-1.5 text-sm" aria-hidden="true">{getFlagEmoji(athlete.country_code ?? '')}</span>{athlete.country || '—'}</td>
                      <td className="px-2.5 py-1.5 text-[var(--muted)]">{age || athlete.age_group || 'Unknown'}{genderLabel !== '—' ? ` · ${genderLabel}` : ''}</td>
                      <td className="px-2.5 py-1.5 text-[var(--muted)]">{normalizedTransplant(athlete.transplant_type)}</td>
                      <td className="px-2.5 py-1.5 text-right"><span className="block font-mono text-[10px] font-bold text-[var(--ink)]">{swim?.time ?? '—'}</span><span className="block text-[8px] text-[var(--muted)]">{swim?.event ?? 'No swim recorded'}</span></td>
                      <td className="px-1 py-1.5 text-right"><Link to={`/athletes/${athlete.id}`} aria-label={`View ${athlete.first_name} ${athlete.last_name}`}><ChevronRight size={13} className="text-[var(--muted)]" /></Link></td>
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
