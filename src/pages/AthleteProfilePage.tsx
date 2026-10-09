import SortableTable from '../components/SortableTable';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, Globe, ArrowLeft, Heart } from 'lucide-react';
import { athletes } from '../data/athletes';
import { results } from '../data/results';
import { rankings } from '../data/rankings';
import { getFlagEmoji, getAgeFromDOB, formatDate, timeToSeconds } from '../lib/utils';
import TransplantBadge from '../components/TransplantBadge';
import PersonalBestTable from '../components/PersonalBestTable';
import AthleteMeetResults from '../components/AthleteMeetResults';
import MedalDisplay from '../components/MedalDisplay';
import SeasonProgressionTable from '../components/SeasonProgressionTable';
import EmptyState from '../components/EmptyState';
import Eyebrow from '../components/Eyebrow';
import { getSavedAvatar } from '../lib/avatars';
import { loadPublicSwimmerProfile, loadPublicSwimmerResults, type PublicSwimmerProfile, type PublicSwimmerResult } from '../lib/swimmerSubmissions';
import { describeSupabaseError, supabase } from '../lib/supabase';
import { resolveTransplantMedals } from '../lib/transplantMedals';
import type { AgeGroup, PersonalBest } from '../types';
import type { Medal } from '../types';
import PageLoading from '../components/PageLoading';
import { SkeletonTable } from '../components/Skeleton';

type Tab = 'Overview' | 'Medals';
type ConfirmedWtgRecord = { id: string; event: string; age_group: string; gender: string; competition_category: string; course: string; holder_name: string; time_ms: number; source_evidence: string; confirmed_at: string; superseded_at: string | null };

function displayMilliseconds(milliseconds: number) {
  const totalSeconds=Math.floor(milliseconds/1000);const minutes=Math.floor(totalSeconds/60);const seconds=totalSeconds%60;const hundredths=Math.round((milliseconds%1000)/10);
  return minutes?`${minutes}:${String(seconds).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`:`${seconds}.${String(hundredths).padStart(2,'0')}`;
}

export default function AthleteProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab]                   = useState<Tab>('Overview');
  const [registeredAthlete, setRegisteredAthlete] = useState<PublicSwimmerProfile | null>(null);
  const [registeredResults, setRegisteredResults] = useState<PublicSwimmerResult[]>([]);
  const [databaseMedals, setDatabaseMedals] = useState<Medal[]>([]);
  const [wtgRecords,setWtgRecords]=useState<ConfirmedWtgRecord[]>([]);
  const [wtgRecordError,setWtgRecordError]=useState('');
  const [registeredLoading, setRegisteredLoading] = useState(false);
  const [medalsLoading, setMedalsLoading] = useState(false);
  const [registeredError, setRegisteredError] = useState('');

  const athlete = athletes.find(a => a.id === id);

  useEffect(() => {
    if (!id) {
      setRegisteredAthlete(null);
      setRegisteredResults([]);
      setDatabaseMedals([]);
      setMedalsLoading(false);
      return;
    }
    let active = true;
    setRegisteredLoading(true);
    setRegisteredError('');
    setRegisteredResults([]);
    setDatabaseMedals([]);
    setMedalsLoading(Boolean(supabase));
    setWtgRecords([]);setWtgRecordError('');
    if(supabase){
      supabase.from('wtg_record_history').select('id,event,age_group,gender,competition_category,course,holder_name,time_ms,source_evidence,confirmed_at,superseded_at').eq('swimmer_id',id).order('confirmed_at',{ascending:false})
        .then(({data,error})=>{if(!active)return;if(error)setWtgRecordError(describeSupabaseError(error));else setWtgRecords((data??[]) as ConfirmedWtgRecord[]);});
    }
    if (athlete) {
      setRegisteredAthlete(null);
      loadPublicSwimmerResults(id)
        .then(swimmerResults => { if (active) setRegisteredResults(swimmerResults); })
        .catch(error => { if (active) setRegisteredError(`Results could not be loaded from the database. ${describeSupabaseError(error)}`); })
        .finally(() => { if (active) setRegisteredLoading(false); });
      return () => { active = false; };
    }
    Promise.all([loadPublicSwimmerProfile(id), loadPublicSwimmerResults(id)]).then(([profile, swimmerResults]) => {
      if (!active) return;
      setRegisteredAthlete(profile);
      setRegisteredResults(swimmerResults);
    }).catch(error => {
      if (active) setRegisteredError(`This athlete profile or its results could not be loaded. ${describeSupabaseError(error)}`);
    }).finally(() => { if (active) setRegisteredLoading(false); });
    return () => { active = false; };
  }, [id, athlete]);

  useEffect(() => {
    if (!supabase || !id) { setMedalsLoading(false); return; }
    let active = true;
    setMedalsLoading(true);
    const resultIds = [...new Set(registeredResults.map(result => result.id))];
    const linkedQuery = resultIds.length
      ? supabase.from('transplant_medals').select('result_id,competition,year,medal,swimmer_results(event)').in('result_id', resultIds)
      : Promise.resolve({ data: [], error: null });
    Promise.resolve(linkedQuery).then(linked => {
      if (!active) return;
      if (linked.error) {
        setRegisteredError(`Medal totals could not be loaded. ${describeSupabaseError(linked.error)}`);
        return;
      }
      const storedRows = (linked.data ?? []).map(row => {
        const related = row.swimmer_results as { event?: string } | { event?: string }[] | null;
        const event = Array.isArray(related) ? related[0]?.event : related?.event;
        return { ...row, swimmer_id: id, event: event ?? null } as { result_id: string; swimmer_id: string; competition: string; year: number; medal: string; event: string | null };
      });
      const medals = resolveTransplantMedals(registeredResults, storedRows, id);
      setDatabaseMedals([...medals.values()].map(({ competition, year, color, event }) => ({ competition, year, color, event })));
    }).catch(error => { if (active) setRegisteredError(`Medal totals could not be loaded. ${describeSupabaseError(error)}`); })
      .finally(() => { if (active) setMedalsLoading(false); });
    return () => { active = false; };
  }, [id, registeredResults]);

  if (!athlete) {
    if (registeredLoading) return <PageLoading />;
    if (registeredAthlete) return <RegisteredAthleteProfile athlete={registeredAthlete} results={registeredResults} medals={databaseMedals} worldRecords={wtgRecords} loading={registeredLoading || medalsLoading} error={registeredError} />;
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <EmptyState
          title={registeredError ? 'Athlete data is unavailable' : 'Athlete not found'}
          subtitle={registeredError || 'This athlete profile does not exist or has been removed.'}
        />
        <div className="text-center mt-6">
          <Link to="/athletes" className="font-mono text-sm text-neutral-500 hover:text-black underline">
            ← Back to Athletes
          </Link>
        </div>
      </div>
    );
  }

  const flag           = getFlagEmoji(athlete.countryCode);
  const avatarUrl      = getSavedAvatar(athlete.firstName, athlete.lastName);
  const age            = getAgeFromDOB(athlete.dateOfBirth);
  const athleteResults = results.filter(r => r.athleteId === athlete.id);
  const bestByEvent = new Map<string, PublicSwimmerResult>();
  registeredResults.forEach(result => {
    if (result.course !== 'LCM' && result.course !== 'SCM') return;
    const key = `${result.event}|${result.course}`;
    const current = bestByEvent.get(key);
    if (!current || timeToSeconds(result.time) < timeToSeconds(current.time)) bestByEvent.set(key, result);
  });
  const databasePersonalBests: PersonalBest[] = [...bestByEvent.values()]
    .sort((a, b) => a.event.localeCompare(b.event) || (a.course ?? '').localeCompare(b.course ?? ''))
    .map(result => ({
      event: result.event as PersonalBest['event'],
      course: result.course as PersonalBest['course'],
      time: result.time,
      date: result.meet_date ?? '',
      meet: result.meet_name ?? 'Meet details unavailable',
      verified: result.status === 'verified' ? 'Verified' : result.status === 'imported_unverified' ? 'Unverified' : 'Pending',
    }));
  const ranking        = rankings.find(r => r.athleteId === athlete.id);
  const medalCounts = athlete.medals.reduce((counts, medal) => {
    counts[medal.color] += 1;
    return counts;
  }, { Gold: 0, Silver: 0, Bronze: 0 });

  // ─── Performance percentile ────────────────────────────────────────────────
  const rankingGroup = rankings.filter(
    r => r.ageGroup === athlete.ageGroup && r.gender === athlete.gender && r.event === '100m Freestyle' && r.course === 'LCM'
  );
  const totalInGroup = rankingGroup.length || 20;
  const myRank       = ranking?.rank ?? athlete.ranking ?? totalInGroup;
  const percentile   = Math.max(1, Math.ceil((myRank / totalInGroup) * 100));
  const percentileLabel = `Top ${percentile}% in ${athlete.ageGroup} ${athlete.gender} 100m Freestyle`;

  const TABS: Tab[] = ['Overview', 'Medals'];

  return (
    <div style={{ backgroundColor: 'var(--surface)' }}>
      {/* Hero header — black */}
      <div style={{ backgroundColor: "var(--navy)" }} className="text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <Link
            to="/athletes"
            className="inline-flex items-center gap-1.5 font-mono text-xs mb-6 transition-colors hover:opacity-80"
            style={{ color: 'var(--muted-on-dark)' }}
          >
            <ArrowLeft size={12} /> All Athletes
          </Link>

          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Avatar */}
            <div
              className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full border-4 border-white/15 font-mono text-2xl font-black text-white"
              style={{ backgroundColor: 'var(--navy-light)' }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={`${athlete.firstName} ${athlete.lastName}`} className="h-full w-full rounded-full object-cover" />
                : athlete.avatarInitials || `${athlete.firstName[0]}${athlete.lastName[0]}`}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <TransplantBadge type={athlete.transplantType} onDark />
                <span
                  className="font-mono text-xs px-2 py-0.5"
                  style={{ backgroundColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
                >
                  {athlete.ageGroup}
                </span>
                {ranking && (
                  <span
                    className="font-mono text-xs px-2 py-0.5 font-bold"
                    style={{ backgroundColor: 'var(--accent)', color: 'var(--navy)' }}
                  >
                    #{ranking.rank} World Ranking
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none" style={{ color: 'var(--ink-on-dark)' }}>
                {athlete.firstName} {athlete.lastName}
              </h1>
              <div className="mt-2 font-mono text-base" style={{ color: 'var(--muted-on-dark)' }}>
                {flag} {athlete.country}
                {athlete.club && <span className="ml-4" style={{ color: 'var(--muted-on-dark)', opacity: 0.6 }}>· {athlete.club}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                <span>{athlete.gender}</span>
                <span>{formatDate(athlete.dateOfBirth)}</span>
                <span>Swimming · {athlete.discipline}</span>
              </div>
            </div>

            <div className="shrink-0 md:w-80">
              <Eyebrow onDark className="mb-3">Transplant Games Medals</Eyebrow>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: 'Gold', value: medalCounts.Gold, color: '#f5c542' },
                  { label: 'Silver', value: medalCounts.Silver, color: '#d1d5db' },
                  { label: 'Bronze', value: medalCounts.Bronze, color: '#d4956a' },
                ]).map(medal => (
                  <div key={medal.label} className="border border-white/15 bg-white/5 px-3 py-2 text-center">
                    <div className="font-mono text-2xl font-black" style={{ color: medal.color }}>{medal.value}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>{medal.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Social */}
          {athlete.social && (
            <div className="mt-6 flex items-center gap-4">
              {athlete.social.instagram && (
                <a href={`https://instagram.com/${athlete.social.instagram}`} target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-wider transition-opacity hover:opacity-100"
                  style={{ color: 'var(--muted-on-dark)', opacity: 0.7 }}>
                  Instagram <ExternalLink size={10} className="inline" />
                </a>
              )}
              {athlete.social.x && (
                <a href={`https://x.com/${athlete.social.x}`} target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-wider transition-opacity hover:opacity-100"
                  style={{ color: 'var(--muted-on-dark)', opacity: 0.7 }}>
                  X <ExternalLink size={10} className="inline" />
                </a>
              )}
              {athlete.social.facebook && (
                <a href={`https://facebook.com/${athlete.social.facebook}`} target="_blank" rel="noreferrer"
                  className="font-mono text-xs uppercase tracking-wider transition-opacity hover:opacity-100"
                  style={{ color: 'var(--muted-on-dark)', opacity: 0.7 }}>
                  Facebook <ExternalLink size={10} className="inline" />
                </a>
              )}
              {athlete.social.website && (
                <a href={athlete.social.website} target="_blank" rel="noreferrer"
                  className="transition-opacity hover:opacity-100"
                  style={{ color: 'var(--muted-on-dark)', opacity: 0.7 }}>
                  <Globe size={16} />
                </a>
              )}
            </div>
          )}
        </div>

      </div>

      <section className="border-b border-[var(--border)] bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <dl className="grid grid-cols-2 gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
            {[
              { label: 'Personal bests', value: athlete.personalBests.length, detail: 'events recorded' },
              { label: 'Competition results', value: athleteResults.length, detail: 'results listed' },
              { label: 'Games medals', value: medalCounts.Gold + medalCounts.Silver + medalCounts.Bronze, detail: `${medalCounts.Gold} gold · ${medalCounts.Silver} silver · ${medalCounts.Bronze} bronze` },
              { label: 'Ranked swim', value: ranking ? `#${ranking.rank}` : '—', detail: ranking ? `${ranking.event} · ${ranking.course}` : 'No ranking listed' },
            ].map(stat => (
              <div key={stat.label} className="min-w-0 bg-[var(--paper)] px-4 py-4 sm:px-5">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{stat.label}</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-[var(--ink)]">{stat.value}</dd>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">{stat.detail}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Profile sections */}
      <nav className="border-b border-neutral-200" style={{ backgroundColor: '#f4f2ed' }} aria-label="Athlete profile sections">
        <div className="mx-auto flex max-w-7xl gap-0 overflow-x-auto px-4" role="tablist" aria-label="Athlete profile details">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              type="button"
              role="tab"
              id={`athlete-tab-${t.toLowerCase()}`}
              aria-controls="athlete-profile-panel"
              aria-selected={tab === t}
              className="whitespace-nowrap border-b-2 px-5 py-4 font-mono text-xs font-semibold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              style={{
                color: tab === t ? 'var(--accent-dark)' : 'var(--muted)',
                borderBottomColor: tab === t ? 'var(--accent)' : 'transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div id="athlete-profile-panel" role="tabpanel" aria-labelledby={`athlete-tab-${tab.toLowerCase()}`} tabIndex={0} className="mx-auto max-w-7xl px-4 py-10 focus-visible:outline-none">

        {tab === 'Overview' && (
          <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-10">
              {athlete.bio && (
                <div>
                  <Eyebrow className="mb-3">Athlete Story</Eyebrow>
                  <p className="text-base leading-relaxed" style={{ color: 'var(--muted)' }}>{athlete.bio}</p>
                </div>
              )}

              {athleteResults.length > 0 && (
                <div>
                  <Eyebrow className="mb-4">Season Progression</Eyebrow>
                  <SeasonProgressionTable results={athleteResults} />
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Athlete Info */}
              <div style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Eyebrow>Athlete Info</Eyebrow>
                </div>
                <dl>
                  {[
                    { label: 'Date of Birth', value: formatDate(athlete.dateOfBirth) },
                    { label: 'Age',            value: `${age}` },
                    { label: 'Gender',         value: athlete.gender },
                    { label: 'Age Group',      value: athlete.ageGroup },
                    { label: 'Nationality',    value: `${flag} ${athlete.country}` },
                    { label: 'Transplant',     value: athlete.transplantType },
                    ...(athlete.transplantYear ? [{ label: 'Transplant Year', value: `${athlete.transplantYear}` }] : []),
                    ...(athlete.club   ? [{ label: 'Club',  value: athlete.club   }] : []),
                    ...(athlete.coach  ? [{ label: 'Coach', value: athlete.coach  }] : []),
                    { label: 'Discipline', value: athlete.discipline },
                  ].map(row => (
                    <div key={row.label} className="flex items-start gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                      <dt className="font-mono text-xs w-28 shrink-0 pt-0.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                        {row.label}
                      </dt>
                      <dd className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Performance Percentile */}
              <div className="p-5 rounded" style={{ background: 'var(--navy-mid)' }}>
                <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--muted-on-dark)' }}>
                  Performance Rank
                </p>
                <p className="font-mono text-sm font-semibold mb-3" style={{ color: 'var(--ink-on-dark)' }}>
                  {percentileLabel}
                </p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--navy-light)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${100 - percentile}%`, background: 'var(--accent)' }}
                  />
                </div>
                <p className="font-mono text-xs mt-2" style={{ color: 'var(--muted-on-dark)' }}>
                  Rank #{myRank} of {totalInGroup} athletes
                </p>
              </div>

              {/* Donor Tribute */}
              {athlete.donorTribute ? (
                <div className="p-5 rounded" style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart size={14} style={{ color: 'var(--accent)' }} fill="var(--accent)" />
                    <p className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--muted-on-dark)' }}>
                      In Honour Of
                    </p>
                  </div>
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ink-on-dark)' }}>
                    {athlete.donorTribute.name}
                  </p>
                  {athlete.donorTribute.message && (
                    <p className="text-xs leading-relaxed italic" style={{ color: 'var(--muted-on-dark)' }}>
                      "{athlete.donorTribute.message}"
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="p-5 rounded"
                  style={{
                    background: 'var(--navy-mid)',
                    border: '1px dashed var(--navy-light)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={13} style={{ color: 'var(--navy-light)' }} />
                    <p className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--muted-on-dark)' }}>
                      Donor Acknowledgement
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                    Add a tribute to honour your donor.{' '}
                    <span className="underline cursor-pointer" style={{ color: 'var(--aqua)' }}>
                      Claim this profile
                    </span>{' '}
                    to add one.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-10">
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4"><div><Eyebrow>Best performances</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Results</h2></div><span className="font-mono text-xs text-[var(--muted)]">{databasePersonalBests.length} events</span></div>
              <PersonalBestTable pbs={databasePersonalBests} gender={athlete.gender} ageGroup={athlete.ageGroup} />
            </section>
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4"><div><Eyebrow>Competition history</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Previous results</h2></div><span className="font-mono text-xs text-[var(--muted)]">{registeredResults.length} result{registeredResults.length === 1 ? '' : 's'}</span></div>
              {registeredLoading ? <SkeletonTable rows={6} columns={7} /> : registeredError ? <EmptyState title="Results unavailable" subtitle={registeredError} /> : registeredResults.length > 0 ? <AthleteMeetResults athlete={{ id: athlete.id, first_name: athlete.firstName, last_name: athlete.lastName, country: athlete.country, country_code: athlete.countryCode, gender: athlete.gender, transplant_type: athlete.transplantType }} results={registeredResults} medals={databaseMedals} worldRecords={wtgRecords} /> : <EmptyState title="No results yet" subtitle="Competition results for this athlete have not been added to the database yet." />}
            </section>
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4"><div><Eyebrow>Officially confirmed achievements</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">World Transplant Games Records</h2></div><span className="font-mono text-xs text-[var(--muted)]">{wtgRecords.length} record{wtgRecords.length===1?'':'s'}</span></div>
              {wtgRecordError?<EmptyState title="WTG records unavailable" subtitle={wtgRecordError} />:wtgRecords.length?<div className="ta-table-shell"><SortableTable><table className="w-full border-collapse"><thead><tr className="ta-table-header">{['Event','Age','Gender','Course','Time','Status','Meet date'].map(column=><th key={column} className="whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5">{column}</th>)}</tr></thead><tbody>{wtgRecords.map(record=><tr key={record.id} className="ta-table-row"><td className="px-3 py-3 text-sm font-semibold sm:px-5">{record.event}</td><td className="px-3 py-3 text-sm">{record.age_group}</td><td className="px-3 py-3 text-sm">{record.gender}</td><td className="px-3 py-3 text-sm">{record.course}</td><td className="px-3 py-3 font-mono text-sm font-bold">{displayMilliseconds(record.time_ms)}</td><td className="px-3 py-3 text-xs">{record.superseded_at?'Former WTG record':'Current WTG record'}</td><td className="px-3 py-3 text-xs">{new Date(record.confirmed_at).toLocaleDateString()}</td></tr>)}</tbody></table></SortableTable></div>:<EmptyState title="No confirmed WTG records" subtitle="Officially confirmed World Transplant Games records will appear here and stay in this athlete’s history after they are broken." />}
            </section>
          </div>
          </div>
        )}

        {tab === 'Medals' && (
          <div className="w-full">
            <MedalDisplay medals={athlete.medals} />
          </div>
        )}

      </div>

    </div>
  );
}

function RegisteredAthleteProfile({ athlete, results, medals, worldRecords, loading, error }: { athlete: PublicSwimmerProfile; results: PublicSwimmerResult[]; medals: Medal[]; worldRecords: ConfirmedWtgRecord[]; loading: boolean; error: string }) {
  const [tab, setTab] = useState<'Overview' | 'Personal Bests' | 'Medals'>('Overview');
  const avatarUrl = getSavedAvatar(athlete.first_name, athlete.last_name);
  const clubPath = athlete.club_id || athlete.club_name?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  useEffect(() => { setTab('Overview'); }, [athlete.id]);
  const medalCounts = medals.reduce((counts, medal) => {
    if (medal.color in counts) counts[medal.color as keyof typeof counts] += 1;
    return counts;
  }, { Gold: 0, Silver: 0, Bronze: 0 });
  const totalMedals = medalCounts.Gold + medalCounts.Silver + medalCounts.Bronze;
  const bestByEvent = new Map<string, PublicSwimmerResult>();
  results.forEach(result => {
    const key = `${result.event || 'Event unavailable'}|${result.course || 'Course unavailable'}`;
    const current = bestByEvent.get(key);
    if (!current || timeToSeconds(result.time) < timeToSeconds(current.time)) bestByEvent.set(key, result);
  });
  const personalBests: PersonalBest[] = [...bestByEvent.values()]
    .sort((a, b) => a.event.localeCompare(b.event) || (a.course ?? '').localeCompare(b.course ?? ''))
    .map(result => ({
      event: result.event as PersonalBest['event'],
      course: result.course as PersonalBest['course'],
      time: result.time,
      date: result.meet_date ?? '',
      meet: result.meet_name ?? 'Meet details unavailable',
      verified: result.status === 'verified' ? 'Verified' : result.status === 'imported_unverified' ? 'Unverified' : 'Pending',
    }));
  const tabs = ['Overview', 'Personal Bests', 'Medals'] as const;

  return <div style={{ backgroundColor: 'var(--paper)' }}>
    <section className="ta-page-top text-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <Link to="/athletes" className="mb-6 inline-flex items-center gap-1.5 font-mono text-xs text-white/65 hover:text-white"><ArrowLeft size={13} /> All athletes</Link>
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--navy-light)] font-mono text-2xl font-bold">
            {avatarUrl ? <img src={avatarUrl} alt={`${athlete.first_name} ${athlete.last_name}`} className="h-full w-full object-cover" /> : `${athlete.first_name[0]}${athlete.last_name[0]}`}
          </div>
          <div className="min-w-0 flex-1">
            <Eyebrow onDark>Athlete profile</Eyebrow>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{athlete.first_name} {athlete.last_name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-y-1 text-sm text-white/70"><span>{getFlagEmoji(athlete.country_code ?? '')} {athlete.country || 'Country unavailable'}</span><span className="px-1.5">·</span><span>{athlete.gender || 'Gender unavailable'}</span><span className="px-1.5">·</span><span>{athlete.transplant_type || 'Transplant type unavailable'}</span><span className="px-1.5">·</span><span>{athlete.age_group || 'Age group unavailable'}</span>{athlete.club_name && clubPath && <><span className="px-1.5">·</span><Link to={`/clubs/${clubPath}`} className="text-white/70 underline decoration-white/30 underline-offset-2 transition-colors hover:text-[var(--accent)]">{athlete.club_name}</Link></>}</p>
          </div>
          <div className="shrink-0 md:w-72">
            <Eyebrow onDark className="mb-3">Transplant Games Medals</Eyebrow>
            <div className="grid grid-cols-3 gap-2" aria-label="World Transplant Games medal totals">
              {[
                { label: 'Gold', color: '#f5c542', count: medalCounts.Gold },
                { label: 'Silver', color: '#d1d5db', count: medalCounts.Silver },
                { label: 'Bronze', color: '#d4956a', count: medalCounts.Bronze },
              ].map(medal => (
                <div key={medal.label} className="border border-white/15 bg-white/5 px-3 py-2 text-center">
                  <div className="font-mono text-2xl font-black" style={{ color: medal.color }}>{medal.count}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-white/60">{medal.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
    <nav className="border-b border-neutral-200" style={{ backgroundColor: '#f4f2ed' }} aria-label="Athlete profile sections">
      <div className="mx-auto flex max-w-7xl gap-0 overflow-x-auto px-4" role="tablist" aria-label="Athlete profile details">
        {tabs.map(label => <button key={label} id={`registered-athlete-tab-${label.toLowerCase().replace(/\s+/g, '-')}`} type="button" role="tab" aria-controls="registered-athlete-panel" aria-selected={tab === label} onClick={() => setTab(label)} className="whitespace-nowrap border-b-2 px-5 py-4 font-mono text-xs font-semibold uppercase tracking-widest transition-colors" style={{ color: tab === label ? 'var(--accent-dark)' : 'var(--muted)', borderBottomColor: tab === label ? 'var(--accent)' : 'transparent' }}>{label}</button>)}
      </div>
    </nav>
    <section id="registered-athlete-panel" role="tabpanel" aria-labelledby={`registered-athlete-tab-${tab.toLowerCase().replace(/\s+/g, '-')}`} className="mx-auto max-w-7xl px-4 py-9">
      {loading ? <SkeletonTable rows={6} columns={12} /> : <>
      {error && <div role="alert" className="mb-6 border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</div>}
      {tab === 'Overview' ? <div className="space-y-8">
            <div className="grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
              {[{ label: 'Personal bests', value: loading || error ? '—' : personalBests.length }, { label: 'Results', value: loading || error ? '—' : results.length }, { label: 'Medals', value: loading || error ? '—' : totalMedals }].map(stat => <div key={stat.label} className="bg-[var(--surface)] px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{stat.label}</p><p className="mt-1 font-mono text-2xl font-bold text-[var(--ink)]">{stat.value}</p></div>)}
            </div>
            <div>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4"><div><Eyebrow>Competition history</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Results</h2></div><span className="font-mono text-xs text-[var(--muted)]">{results.length} result{results.length === 1 ? '' : 's'}</span></div>
              <AthleteMeetResults athlete={athlete} results={results} medals={medals} worldRecords={worldRecords} />
            </div>
          </div>
          : tab === 'Personal Bests' ? <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4"><div><Eyebrow>Best performances</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Personal best results</h2></div><span className="font-mono text-xs text-[var(--muted)]">{personalBests.length} events</span></div>
            <PersonalBestTable pbs={personalBests} gender={athlete.gender} ageGroup={athlete.age_group as AgeGroup} />
          </div>
            : <div>
                <div className="mb-5 border-b border-[var(--border)] pb-4"><Eyebrow>Achievements</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Transplant Games medals</h2></div>
                <MedalDisplay medals={medals} />
              </div>}
      </>}
    </section>
  </div>;
}
