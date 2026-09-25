import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, Globe, ArrowLeft, Heart } from 'lucide-react';
import { athletes } from '../data/athletes';
import { results } from '../data/results';
import { rankings } from '../data/rankings';
import { getFlagEmoji, getAgeFromDOB, formatDate } from '../lib/utils';
import TransplantBadge from '../components/TransplantBadge';
import PersonalBestTable from '../components/PersonalBestTable';
import ResultsTable from '../components/ResultsTable';
import MedalDisplay from '../components/MedalDisplay';
import SeasonProgressionTable from '../components/SeasonProgressionTable';
import EmptyState from '../components/EmptyState';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import { getSavedAvatar } from '../lib/avatars';

const RESULT_PAGE_SIZE = 10;

type Tab = 'Results' | 'Overview' | 'Medals';

export default function AthleteProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab]                   = useState<Tab>('Results');
  const [resultPage, setResultPage]     = useState(1);
  useEffect(() => setResultPage(1), [id, tab]);

  const athlete = athletes.find(a => a.id === id);

  if (!athlete) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <EmptyState
          title="Athlete not found"
          subtitle="This athlete profile does not exist or has been removed."
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
  const resultPageCount = Math.ceil(athleteResults.length / RESULT_PAGE_SIZE);
  const pageResults = athleteResults.slice((resultPage - 1) * RESULT_PAGE_SIZE, resultPage * RESULT_PAGE_SIZE);
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

  const TABS: Tab[] = ['Results', 'Overview', 'Medals'];

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

      {/* Profile sections */}
      <nav className="border-b border-neutral-200" style={{ backgroundColor: '#f4f2ed' }} aria-label="Athlete profile sections">
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto px-4">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="whitespace-nowrap border-b-2 px-5 py-4 font-mono text-xs uppercase tracking-widest transition-colors"
              style={{
                color: tab === t ? '#1769c2' : '#64748b',
                borderBottomColor: tab === t ? '#1769c2' : 'transparent',
              }}
            >
              {t === 'Results' ? 'Personal Best Results' : t}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-10">

        {tab === 'Overview' && (
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
        )}

        {tab === 'Results' && (
          <div className="space-y-12">
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div>
                  <Eyebrow>Personal Best Results</Eyebrow>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Best performances</h2>
                </div>
                <span className="font-mono text-xs text-[var(--muted)]">{athlete.personalBests.length} events</span>
              </div>
              <PersonalBestTable pbs={athlete.personalBests} gender={athlete.gender} ageGroup={athlete.ageGroup} />
            </section>

            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div>
                  <Eyebrow>Competition history</Eyebrow>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Previous results</h2>
                </div>
                <span className="font-mono text-xs text-[var(--muted)]">{athleteResults.length} result{athleteResults.length === 1 ? '' : 's'}</span>
              </div>
              {athleteResults.length > 0 ? (
                <>
                  <ResultsTable results={pageResults} />
                  <Pagination page={resultPage} pageCount={resultPageCount} onPageChange={setResultPage} label="Athlete result pages" />
                </>
              ) : (
                <EmptyState title="No results yet" subtitle="Competition results for this athlete have not been added yet." />
              )}
            </section>
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
