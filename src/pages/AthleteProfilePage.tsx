import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, Globe, ArrowLeft, Heart } from 'lucide-react';
import { athletes } from '../data/athletes';
import { results } from '../data/results';
import { rankings } from '../data/rankings';
import { getFlagEmoji, getAgeFromDOB, formatDate, timeToSeconds } from '../lib/utils';
import TransplantBadge from '../components/TransplantBadge';
import PersonalBestTable from '../components/PersonalBestTable';
import ResultsTable from '../components/ResultsTable';
import MedalDisplay from '../components/MedalDisplay';
import SeasonProgressionTable from '../components/SeasonProgressionTable';
import EmptyState from '../components/EmptyState';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import { getSavedAvatar } from '../lib/avatars';
import { loadPublicSwimmerDirectory, loadPublicSwimmerResults, type PublicSwimmerProfile, type PublicSwimmerResult } from '../lib/swimmerSubmissions';
import { describeSupabaseError } from '../lib/supabase';
import type { AgeGroup, PersonalBest, Result } from '../types';
import DatabaseResultsTable from '../components/DatabaseResultsTable';
import PageLoading from '../components/PageLoading';
import { SkeletonTable } from '../components/Skeleton';

const RESULT_PAGE_SIZE = 10;

type Tab = 'Overview' | 'Medals';

export default function AthleteProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab]                   = useState<Tab>('Overview');
  const [resultPage, setResultPage]     = useState(1);
  const [registeredAthlete, setRegisteredAthlete] = useState<PublicSwimmerProfile | null>(null);
  const [registeredResults, setRegisteredResults] = useState<PublicSwimmerResult[]>([]);
  const [registeredLoading, setRegisteredLoading] = useState(false);
  const [registeredError, setRegisteredError] = useState('');
  useEffect(() => setResultPage(1), [id, tab]);

  const athlete = athletes.find(a => a.id === id);

  useEffect(() => {
    if (!id) {
      setRegisteredAthlete(null);
      setRegisteredResults([]);
      return;
    }
    let active = true;
    setRegisteredLoading(true);
    setRegisteredError('');
    setRegisteredResults([]);
    if (athlete) {
      setRegisteredAthlete(null);
      loadPublicSwimmerResults(id)
        .then(swimmerResults => { if (active) setRegisteredResults(swimmerResults); })
        .catch(error => { if (active) setRegisteredError(`Results could not be loaded from the database. ${describeSupabaseError(error)}`); })
        .finally(() => { if (active) setRegisteredLoading(false); });
      return () => { active = false; };
    }
    loadPublicSwimmerDirectory().then(async profiles => {
      const profile = profiles.find(entry => entry.id === id) ?? null;
      if (!active) return;
      setRegisteredAthlete(profile);
      if (profile) {
        const swimmerResults = await loadPublicSwimmerResults(profile.id);
        if (active) setRegisteredResults(swimmerResults);
      }
    }).catch(error => {
      if (active) setRegisteredError(`This athlete profile or its results could not be loaded. ${describeSupabaseError(error)}`);
    }).finally(() => { if (active) setRegisteredLoading(false); });
    return () => { active = false; };
  }, [id, athlete]);

  if (!athlete) {
    if (registeredLoading) return <PageLoading />;
    if (registeredAthlete) return <RegisteredAthleteProfile athlete={registeredAthlete} results={registeredResults} loading={registeredLoading} error={registeredError} />;
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
      date: result.meet_date ?? result.created_at,
      meet: result.meet_name ?? 'Meet details unavailable',
      verified: result.status === 'verified' ? 'Verified' : 'Pending',
    }));
  const databaseResultsForTable: Result[] = registeredResults.map(result => ({
    id: result.id,
    event: result.event as Result['event'],
    course: (result.course ?? '') as Result['course'],
    time: result.time,
    date: result.meet_date ?? result.created_at,
    meet: result.meet_name ?? 'Meet details unavailable',
    ageGroup: result.age_group as Result['ageGroup'],
    gender: athlete.gender,
    verified: result.status === 'verified' ? 'Verified' : 'Pending',
    isPB: databasePersonalBests.some(best => best.event === result.event && best.course === result.course && best.time === result.time),
    isSB: false,
    athleteId: athlete.id,
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
              {registeredLoading ? <SkeletonTable rows={6} columns={7} /> : registeredError ? <EmptyState title="Results unavailable" subtitle={registeredError} /> : registeredResults.length > 0 ? <><ResultsTable results={databaseResultsForTable.slice((resultPage - 1) * RESULT_PAGE_SIZE, resultPage * RESULT_PAGE_SIZE)} /><Pagination page={resultPage} pageCount={Math.ceil(registeredResults.length / RESULT_PAGE_SIZE)} onPageChange={setResultPage} label="Athlete result pages" /></> : <EmptyState title="No results yet" subtitle="Competition results for this athlete have not been added to the database yet." />}
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

function RegisteredAthleteProfile({ athlete, results, loading, error }: { athlete: PublicSwimmerProfile; results: PublicSwimmerResult[]; loading: boolean; error: string }) {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'Overview' | 'Personal Bests' | 'Medals'>('Overview');
  useEffect(() => { setPage(1); setTab('Overview'); }, [athlete.id]);
  const pageCount = Math.ceil(results.length / RESULT_PAGE_SIZE);
  const visibleResults = results.slice((page - 1) * RESULT_PAGE_SIZE, page * RESULT_PAGE_SIZE);
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
      date: result.meet_date ?? result.created_at,
      meet: result.meet_name ?? 'Meet details unavailable',
      verified: result.status === 'verified' ? 'Verified' : 'Pending',
    }));
  const tabs = ['Overview', 'Personal Bests', 'Medals'] as const;

  return <div style={{ backgroundColor: 'var(--paper)' }}>
    <section className="bg-[var(--navy)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <Link to="/athletes" className="mb-6 inline-flex items-center gap-1.5 font-mono text-xs text-white/65 hover:text-white"><ArrowLeft size={13} /> All athletes</Link>
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-[var(--navy-light)] font-mono text-2xl font-bold">{athlete.first_name[0]}{athlete.last_name[0]}</div>
          <div className="min-w-0 flex-1">
            <Eyebrow onDark>Athlete profile</Eyebrow>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{athlete.first_name} {athlete.last_name}</h1>
            <p className="mt-2 text-sm text-white/70">{getFlagEmoji(athlete.country_code ?? '')} {athlete.country || 'Country unavailable'} <span className="px-1.5">·</span> {athlete.gender || 'Gender unavailable'} <span className="px-1.5">·</span> {athlete.transplant_type || 'Transplant type unavailable'} <span className="px-1.5">·</span> {athlete.age_group || 'Age group unavailable'}</p>
            {athlete.club_name && <p className="mt-1 text-sm text-white/70">Club: {athlete.club_name}</p>}
          </div>
          <div className="shrink-0 md:w-72">
            <Eyebrow onDark className="mb-3">Transplant Games Medals</Eyebrow>
            <div className="grid grid-cols-3 gap-2" aria-label="World Transplant Games medal totals">
              {[
                { label: 'Gold', color: '#f5c542' },
                { label: 'Silver', color: '#d1d5db' },
                { label: 'Bronze', color: '#d4956a' },
              ].map(medal => (
                <div key={medal.label} className="border border-white/15 bg-white/5 px-3 py-2 text-center">
                  <div className="font-mono text-2xl font-black" style={{ color: medal.color }}>—</div>
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
              {[{ label: 'Personal bests', value: loading || error ? '—' : personalBests.length }, { label: 'Results', value: loading || error ? '—' : results.length }, { label: 'Medals', value: '—' }].map(stat => <div key={stat.label} className="bg-[var(--surface)] px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{stat.label}</p><p className="mt-1 font-mono text-2xl font-bold text-[var(--ink)]">{stat.value}</p></div>)}
            </div>
            <div>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4"><div><Eyebrow>Competition history</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Results</h2></div><span className="font-mono text-xs text-[var(--muted)]">{results.length} result{results.length === 1 ? '' : 's'}</span></div>
              <DatabaseResultsTable results={visibleResults} showAthlete={false} />
              <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Athlete results pages" />
            </div>
          </div>
          : tab === 'Personal Bests' ? <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4"><div><Eyebrow>Best performances</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Personal best results</h2></div><span className="font-mono text-xs text-[var(--muted)]">{personalBests.length} events</span></div>
            <PersonalBestTable pbs={personalBests} gender={athlete.gender} ageGroup={athlete.age_group as AgeGroup} />
          </div>
            : <div>
                <div className="mb-5 border-b border-[var(--border)] pb-4"><Eyebrow>Achievements</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Transplant Games medals</h2></div>
                <div>
                  <div className="ta-table-shell overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead><tr className="ta-table-header">{['Games', 'Gold', 'Silver', 'Bronze', 'Total'].map(label => <th key={label} className={`whitespace-nowrap px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 ${label === 'Games' ? 'text-left' : 'text-center'}`}>{label}</th>)}</tr></thead>
                      <tbody><tr className="ta-table-row"><td className="px-3 py-4 text-sm font-semibold text-[var(--ink)] sm:px-5">World Transplant Games</td>{['Gold', 'Silver', 'Bronze', 'Total'].map(label => <td key={label} className="px-3 py-4 text-center font-mono text-sm text-[var(--muted)] sm:px-5">—</td>)}</tr></tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted)]">Medal totals are unavailable until medal data is connected. A dash means unknown; zero will be shown when a confirmed total is zero.</p>
                </div>
              </div>}
      </>}
    </section>
  </div>;
}
