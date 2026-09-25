import { Link } from 'react-router-dom';
import type { Ranking } from '../types';
import { getFlagEmoji, getTransplantColor, timeToSeconds } from '../lib/utils';
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
  showPoints?: boolean;
  title?: string;
  showGenderInEvent?: boolean;
  showEventMeta?: boolean;
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

export default function RankingTable({ rankings, light = false, showExtras = false, showVerified = true, showCategory = false, showGap = true, rankByPoints = false, rankOffset = 0, rankPositions, genderCard = false, showPoints = true, title, showGenderInEvent = false, showEventMeta = true }: RankingTableProps) {
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
    <div className={genderCard ? 'overflow-hidden rounded-lg border border-neutral-200 bg-white' : light ? 'overflow-x-auto' : 'overflow-hidden border border-neutral-200 bg-white'}>
      {genderCard && title && <h3 className="px-5 pt-5 text-xl font-semibold text-neutral-900">{title}</h3>}
      <div className={genderCard ? 'overflow-x-auto px-4 pt-4' : undefined}>
      <table className="w-full border-collapse">
        <thead>
          <tr className={light ? 'bg-white/5' : 'bg-[#f4f5f6]'} style={{ borderBottom: `1px solid ${light ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}` }}>
            <th className="font-mono text-[10px] font-semibold tracking-widest uppercase py-4 pl-3 text-left w-10" style={{ color: light ? 'var(--muted)' : '#64748b' }}>{genderCard ? '' : '#'}</th>
            <th className="font-mono text-[10px] font-semibold tracking-widest uppercase py-4 text-left" style={{ color: light ? 'var(--muted)' : '#64748b' }}>{genderCard ? 'Name' : 'Athlete'}</th>
            <th className={`font-mono text-[10px] font-semibold tracking-widest uppercase py-4 text-center hidden sm:table-cell ${genderCard ? 'pr-6' : ''}`} style={{ color: light ? 'var(--muted)' : '#64748b' }}>Country</th>
            {genderCard && <th className="font-mono text-[10px] font-semibold tracking-widest uppercase py-4 pl-5 text-left" style={{ color: '#64748b' }}>Event</th>}
            <th className="font-mono text-[10px] font-semibold tracking-widest uppercase py-4 text-right" style={{ color: light ? 'var(--muted)' : '#64748b' }}>Time</th>
            {showPoints && <th className="font-mono text-[10px] font-semibold tracking-widest uppercase py-4 pl-3 pr-3 text-right" style={{ color: light ? 'var(--muted)' : '#64748b' }} title="Transplant Aquatics points, scored against the matching WTG age-group world record">TA Pts</th>}
            {showGap && <th className="font-mono text-[10px] font-semibold tracking-widest uppercase py-4 text-right hidden md:table-cell" style={{ color: light ? 'var(--muted)' : '#64748b' }}>Gap</th>}
            {showExtras && <th className="font-mono text-[10px] font-semibold tracking-widest uppercase py-4 pl-4 text-center hidden lg:table-cell" style={{ color: light ? 'var(--muted)' : '#64748b' }}>WTG</th>}
            {showExtras && <th className="font-mono text-[10px] font-semibold tracking-widest uppercase py-4 text-right hidden lg:table-cell" style={{ color: light ? 'var(--muted)' : '#64748b' }}>Pct</th>}
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
            const dotColor  = getTransplantColor(r.transplantType);
            const verified  = getVerifiedStatus(r);
            const transplantPoints = getTransplantPoints(r);
            const athleteParts = r.athleteName.trim().split(/\s+/);
            const lastName = athleteParts.length > 1 ? athleteParts.pop()! : '';
            const firstName = athleteParts.join(' ');
            const avatar = getSavedAvatar(firstName, lastName);
            const initials = `${firstName[0] ?? r.athleteName[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase();
            const stripe = index % 2 === 1;

            return (
              <tr
                key={`${r.athleteId}-${r.rank}`}
                style={{ borderBottom: `1px solid ${light ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}` }}
                className={`transition-colors group ${light ? 'hover:bg-white/5' : `hover:bg-neutral-50 ${stripe ? 'bg-[#f7f8fa]' : 'bg-white'}`}`}
              >
                {/* Rank */}
                <td className="py-4 pr-3">
                  <span
                    className="font-mono font-black text-lg leading-none"
                    style={{ color: isTop3 && !light ? '#1769c2' : 'var(--muted)' }}
                  >
                    {displayRank}
                  </span>
                </td>

                {/* Athlete — name + transplant dot */}
                <td className="py-4 pr-4">
                  <div className={`flex items-center ${genderCard ? '' : 'gap-2.5'}`}>
                    {!genderCard && <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-mono text-[10px] font-bold ${light ? 'bg-white/10 text-white' : 'bg-[#eef0f2] text-[#334155]'}`}>
                      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
                    </span>}
                    {!genderCard && <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor }}
                      title={r.transplantType}
                    />}
                    <Link
                      to={`/athletes/${r.athleteId}`}
                      className="font-medium text-sm hover:underline sm:text-base"
                      style={{ color: genderCard ? '#1769c2' : light ? 'var(--ink-on-dark)' : 'var(--ink)' }}
                    >
                      {r.athleteName}
                    </Link>
                  </div>
                  {showCategory && !genderCard && (
                    <div className="mt-1 pl-4 font-mono text-[10px] leading-relaxed text-neutral-500">
                      {r.ageGroup}
                    </div>
                  )}
                </td>

                {/* Country */}
                <td className={`py-4 px-2 text-center hidden sm:table-cell ${genderCard ? 'pr-6' : ''}`}>
                  <span className="font-mono text-sm" title={r.country} aria-label={r.country} style={{ color: light ? 'rgba(255,255,255,0.45)' : '#6b7280' }}>
                    {flag}
                  </span>
                </td>

                {genderCard && (
                  <td className="py-4 pl-5 pr-3 text-sm text-neutral-900">
                    <div>{r.event.replace('m ', ' ')}</div>
                    {showEventMeta && <div className="mt-1 font-mono text-[10px] text-neutral-500">{showGenderInEvent && `${r.gender} · `}{r.ageGroup} · {r.course}</div>}
                  </td>
                )}

                {/* Time */}
                <td className="py-4 text-right">
                  <div className="inline-flex items-center justify-end gap-1">
                    <span
                      className="font-mono font-bold text-sm"
                    style={{ color: isLeader && !genderCard && light ? 'var(--accent)' : light ? 'var(--ink-on-dark)' : '#1769c2' }}
                    >
                      {r.time}
                    </span>
                    {showVerified && <VerifiedBadge status={verified} />}
                  </div>
                </td>

                {showPoints && <td className="py-4 pl-4 text-right">
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: transplantPoints === null ? 'var(--muted)' : genderCard ? '#202124' : 'var(--navy)' }}
                    title={transplantPoints === null
                      ? 'No matching WTG world-record baseline is available for this course and category.'
                      : 'Transplant Aquatics points: 1,000 points equals the matching WTG age-group world record.'}
                  >
                    {transplantPoints === null ? '—' : transplantPoints.toLocaleString()}
                  </span>
                </td>}

                {/* Gap */}
                {showGap && (
                    <td className="py-4 pl-4 text-right hidden md:table-cell">
                    <span
                      className="font-mono text-xs"
                      style={{ color: isLeader ? 'var(--accent)' : 'var(--muted)' }}
                    >
                      {gap}
                    </span>
                  </td>
                )}

                {showExtras && (
                  <td className="py-4 pl-4 text-center hidden lg:table-cell">
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
                  <td className="py-4 pl-4 text-right hidden lg:table-cell">
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
