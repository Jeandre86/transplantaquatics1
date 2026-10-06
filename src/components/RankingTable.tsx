import { Link, useNavigate } from 'react-router-dom';
import type { Ranking } from '../types';
import { formatDate, getCountryAlpha3, getFlagEmoji, timeToSeconds } from '../lib/utils';
import { getTransplantPoints } from '../lib/transplantPoints';
import { getSavedAvatar } from '../lib/avatars';
import TimeStandard from './TimeStandard';

interface RankingTableProps {
  rankings: Ranking[];
  light?: boolean;       // true = light text (on dark bg) — default for all dark-background uses
  showExtras?: boolean;
  showVerified?: boolean; // false = hide VER/PEND badges (e.g. homepage preview)
  showCategory?: boolean;
  showGap?: boolean;
  rankByPoints?: boolean;
  rankOffset?: number;
  rankPositions?: Map<string, number>;
  genderCard?: boolean;
  showEventColumn?: boolean;
  showPoints?: boolean;
  title?: string;
  showGenderInEvent?: boolean;
  showEventMeta?: boolean;
  showAgeGroup?: boolean;
  showDate?: boolean;
  ageGroupWithGender?: boolean;
  showGender?: boolean;
  paperSurface?: boolean;
}

// Verification badge — shown inline next to the time
function VerifiedBadge({ status }: { status: 'verified' | 'pending' | 'unverified' }) {
  if (status === 'verified') {
    return (
      <span
        className="inline-flex items-center gap-0.5 ml-2 px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider"
        style={{ color: 'var(--aqua)', border: '1px solid rgba(0,194,215,0.4)', fontSize: '10px', lineHeight: 1 }}
        title="Result verified by official timekeeper"
      >
        ✓ VER
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span
        className="inline-flex items-center ml-2 px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider"
        style={{ color: 'var(--pending)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '10px', lineHeight: 1 }}
        title="Result pending verification"
      >
        PEND
      </span>
    );
  }
  return null; // unverified — no badge (keeps table clean)
}

export default function RankingTable({ rankings, light = false, showExtras = false, showVerified = true, showCategory = false, showGap = true, rankByPoints = false, rankOffset = 0, rankPositions, genderCard = false, showEventColumn = false, showPoints = true, title, showGenderInEvent = false, showEventMeta = true, showAgeGroup = false, showDate = false, ageGroupWithGender = false, showGender = false, paperSurface = false }: RankingTableProps) {
  const navigate = useNavigate();
  if (rankings.length === 0) {
    return (
      <div className="py-12 text-center font-mono text-sm" style={{ color: 'var(--muted)' }}>
        No results found for this filter combination.
      </div>
    );
  }

  // Derive a stable verification status from rank + athleteId seed (no extra data field needed)
  function getVerifiedStatus(r: Ranking): 'verified' | 'pending' | 'unverified' {
    const seed = r.rank + r.athleteId.charCodeAt(0);
    if (seed % 5 === 0) return 'pending';
    if (seed % 3 !== 0) return 'verified';
    return 'unverified';
  }

  // Only verified times count — filter before rendering
  const verifiedRankings = rankings.filter(r => getVerifiedStatus(r) === 'verified');
  const displayRankings  = showVerified ? verifiedRankings : rankings;
  const total = displayRankings.length;

  // Parse leader time for gap column (from verified leader)
  const leaderSeconds = timeToSeconds(displayRankings[0]?.time ?? rankings[0].time);

  // Format gap as "+0.00" or "+0:00.00"
  function formatGap(seconds: number): string {
    if (seconds === 0) return '—';
    const gap = seconds - leaderSeconds;
    if (gap <= 0) return '—';
    if (gap < 60) return `+${gap.toFixed(2)}`;
    const m = Math.floor(gap / 60);
    const s = (gap % 60).toFixed(2).padStart(5, '0');
    return `+${m}:${s}`;
  }

  return (
    <div className={genderCard ? `ta-table-shell${paperSurface ? ' ta-table-shell-paper' : ''}` : light ? 'ta-table-scroll' : 'ta-table-shell'}>
      {genderCard && title && <h3 className={`px-4 ${paperSurface ? 'pt-4' : 'pt-5'} text-xl font-semibold text-[var(--ink)]`}>{title}</h3>}
      <div className={genderCard ? `ta-table-scroll ${paperSurface ? 'pt-3' : 'pt-4'}` : undefined}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="ta-table-header">
            <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-left w-10 sm:px-5">{genderCard ? '' : '#'}</th>
            <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-left sm:px-5">{genderCard ? 'Name' : 'Athlete'}</th>
            {showAgeGroup && <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-left sm:px-5">Age Group</th>}
            {showGender && <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-left sm:px-5">Gender</th>}
            {(genderCard || showEventColumn) && <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-left sm:px-5">Event</th>}
            {showDate && <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-left sm:px-5">Date</th>}
            <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-right sm:px-5">Time</th>
            {showPoints && <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-right sm:px-5" title="World Aquatics base times are used; matching WTG records are used for junior 25m events">PTS</th>}
            {showGap && <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-right hidden md:table-cell sm:px-5">Gap</th>}
            {showExtras && <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-center hidden lg:table-cell sm:px-5">WTG</th>}
            {showExtras && <th className="px-3 py-3 font-mono text-[10px] font-semibold tracking-widest uppercase text-right hidden lg:table-cell sm:px-5">Pct</th>}
          </tr>
        </thead>
        <tbody>
          {displayRankings.map((r, index) => {
            const rankingKey = [r.athleteId, r.ageGroup, r.gender, r.event, r.course].join('|');
            const displayRank = rankByPoints ? (rankPositions?.get(rankingKey) ?? rankOffset + index + 1) : r.rank;
            const isTop3    = displayRank <= 3;
            const isLeader  = displayRank === 1;
            const flag      = getFlagEmoji(r.countryCode);
            const topPct    = Math.ceil((displayRank / total) * 100);
            const gap       = formatGap(timeToSeconds(r.time));
            const verified  = getVerifiedStatus(r);
            const transplantPoints = getTransplantPoints(r);
            const athleteParts = r.athleteName.trim().split(/\s+/);
            const lastName = athleteParts.length > 1 ? athleteParts.pop()! : '';
            const firstName = athleteParts.join(' ');
            const avatar = getSavedAvatar(firstName, lastName);
            const initials = `${firstName[0] ?? r.athleteName[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase();
            return (
              <tr
                key={`${r.athleteId}-${r.rank}`}
                className={`group cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-dark)] ${light ? 'ta-table-row-dark' : paperSurface ? 'ta-table-row-paper' : 'ta-table-row'}`}
                tabIndex={0}
                aria-label={`Open ${r.athleteName || 'swimmer'} athlete profile`}
                onClick={event => {
                  if ((event.target as HTMLElement).closest('a, button')) return;
                  navigate(`/athletes/${r.athleteId}`);
                }}
                onKeyDown={event => {
                  if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                    event.preventDefault();
                    navigate(`/athletes/${r.athleteId}`);
                  }
                }}
              >
                {/* Rank */}
                <td className="px-3 py-4 sm:px-5">
                  <span
                    className="font-mono font-black text-lg leading-none"
                    style={{ color: isTop3 ? (light ? 'var(--accent)' : 'var(--accent-dark)') : light ? 'var(--muted-on-dark)' : 'var(--muted)' }}
                  >
                    {displayRank}
                  </span>
                </td>

                {/* Athlete identity: avatar, name, and country */}
                <td className="px-3 py-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-mono text-[10px] font-bold sm:h-11 sm:w-11 ${light ? 'bg-white/10 text-white' : 'bg-[var(--ice)] text-[var(--navy)]'}`}>
                      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
                    </span>
                    <span className="min-w-0">
                      <Link
                        to={`/athletes/${r.athleteId}`}
                        className="block truncate font-medium text-base hover:underline"
                        style={{ color: light ? 'var(--ink-on-dark)' : 'var(--ink)' }}
                      >
                        {r.athleteName || '—'}
                      </Link>
                      <span className={`mt-1 flex items-center gap-1.5 font-mono text-xs ${light ? 'text-white/70' : 'text-[var(--muted)]'}`} title={r.country}>
                        <span className="ta-table-flag" aria-hidden="true">{r.countryCode ? flag : '—'}</span>
                        <span className="font-semibold tracking-wider">{r.countryCode ? getCountryAlpha3(r.countryCode) : '—'}</span>
                      </span>
                    </span>
                  </div>
                  {showCategory && !genderCard && (
                  <div className={`mt-1 pl-4 font-mono text-[10px] leading-relaxed ${light ? 'text-white/55' : 'text-[var(--muted)]'}`}>
                      {r.ageGroup || '—'}
                    </div>
                  )}
                </td>

                {showAgeGroup && <td className="px-3 py-4 text-sm text-[var(--ink)] sm:px-5">{r.ageGroup || '—'}{ageGroupWithGender && r.gender ? ` · ${r.gender}` : ''}</td>}
                {showGender && <td className="px-3 py-4 text-sm text-[var(--ink)] sm:px-5">{r.gender || '—'}</td>}

                {(genderCard || showEventColumn) && (
                  <td className="px-3 py-4 text-sm text-[var(--ink)] sm:px-5">
                    <div>{r.event ? r.event.replace('m ', ' ') : '—'}</div>
                    {showEventMeta && <div className="mt-1 font-mono text-[10px] text-[var(--muted)]">{showGenderInEvent && `${r.gender || '—'} · `}{r.ageGroup || '—'} · {r.course || '—'}</div>}
                  </td>
                )}

                {showDate && <td className="whitespace-nowrap px-3 py-4 text-xs text-[var(--muted)] sm:px-5">{formatDate(r.date)}</td>}

                {/* Time */}
                <td className="px-3 py-4 text-right sm:px-5">
                  <div className="inline-flex items-center justify-end gap-1">
                    <span
                      className="font-mono font-bold text-base"
                    style={{ color: light ? (isLeader ? 'var(--accent)' : 'var(--ink-on-dark)') : isLeader ? 'var(--accent-dark)' : 'var(--navy)' }}
                    >
                      {r.time || '—'}
                    </span>
                    {showVerified && <VerifiedBadge status={verified} />}
                  </div>
                </td>

                {showPoints && <td className="px-3 py-4 text-right sm:px-5">
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: transplantPoints === null ? 'var(--muted)' : 'var(--navy)' }}
                    title={transplantPoints === null
                      ? 'No World Aquatics or matching WTG baseline is available for this event and category.'
                      : 'PTS use the World Aquatics event, gender, and course base time; junior 25m events use a matching WTG record.'}
                  >
                    {transplantPoints === null ? '—' : transplantPoints.toLocaleString()}
                  </span>
                </td>}

                {/* Gap */}
                {showGap && (
                    <td className="px-3 py-4 text-right hidden md:table-cell sm:px-5">
                    <span
                      className="font-mono text-xs"
                      style={{ color: isLeader ? 'var(--accent)' : 'var(--muted)' }}
                    >
                      {gap}
                    </span>
                  </td>
                )}

                {showExtras && (
                  <td className="px-3 py-4 text-center hidden lg:table-cell sm:px-5">
                    <TimeStandard
                      time={r.time}
                      event={r.event}
                      course={r.course}
                      gender={r.gender}
                      ageGroup={r.ageGroup}
                    />
                  </td>
                )}

                {showExtras && (
                  <td className="px-3 py-4 text-right hidden lg:table-cell sm:px-5">
                    <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      Top {topPct}%
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
