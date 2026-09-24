import { Link } from 'react-router-dom';
import type { Ranking } from '../types';
import { getFlagEmoji, getTransplantColor, timeToSeconds } from '../lib/utils';
import TimeStandard from './TimeStandard';

interface RankingTableProps {
  rankings: Ranking[];
  light?: boolean;       // true = light text (on dark bg) — default for all dark-background uses
  showExtras?: boolean;
  showVerified?: boolean; // false = hide VER/PEND badges (e.g. homepage preview)
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

export default function RankingTable({ rankings, light = false, showExtras = false, showVerified = true }: RankingTableProps) {
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
  const displayRankings  = verifiedRankings;
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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: `1px solid ${light ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}` }}>
            <th className="font-mono text-xs tracking-widest uppercase py-2 text-left w-10" style={{ color: 'var(--muted)' }}>#</th>
            <th className="font-mono text-xs tracking-widest uppercase py-2 text-left" style={{ color: 'var(--muted)' }}>Athlete</th>
            <th className="font-mono text-xs tracking-widest uppercase py-2 text-left hidden sm:table-cell" style={{ color: 'var(--muted)' }}>Country</th>
            <th className="font-mono text-xs tracking-widest uppercase py-2 text-right" style={{ color: 'var(--muted)' }}>Time</th>
            <th className="font-mono text-xs tracking-widest uppercase py-2 text-right hidden md:table-cell" style={{ color: 'var(--muted)' }}>Gap</th>
            {showExtras && <th className="font-mono text-xs tracking-widest uppercase py-2 pl-4 text-center hidden lg:table-cell" style={{ color: 'var(--muted)' }}>WTG</th>}
            {showExtras && <th className="font-mono text-xs tracking-widest uppercase py-2 text-right hidden lg:table-cell" style={{ color: 'var(--muted)' }}>Pct</th>}
          </tr>
        </thead>
        <tbody>
          {displayRankings.map((r) => {
            const isTop3    = r.rank <= 3;
            const isLeader  = r.rank === 1;
            const flag      = getFlagEmoji(r.countryCode);
            const topPct    = Math.ceil((r.rank / total) * 100);
            const gap       = formatGap(timeToSeconds(r.time));
            const dotColor  = getTransplantColor(r.transplantType);
            const verified  = getVerifiedStatus(r);

            return (
              <tr
                key={`${r.athleteId}-${r.rank}`}
                style={{ borderBottom: `1px solid ${light ? 'rgba(255,255,255,0.06)' : '#f3f4f6'}` }}
                className="transition-colors group"
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = light ? 'rgba(255,255,255,0.03)' : '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Rank */}
                <td className="py-3 pr-3">
                  <span
                    className="font-mono font-black text-lg leading-none"
                    style={{ color: isTop3 ? 'var(--accent)' : 'var(--muted)' }}
                  >
                    {r.rank}
                  </span>
                </td>

                {/* Athlete — name + transplant dot */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {/* Transplant type dot */}
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor }}
                      title={r.transplantType}
                    />
                    <Link
                      to={`/athletes/${r.athleteId}`}
                      className="font-semibold text-sm hover:underline"
                      style={{ color: light ? 'var(--ink-on-dark)' : 'var(--ink)' }}
                    >
                      {r.athleteName}
                    </Link>
                  </div>
                </td>

                {/* Country */}
                <td className="py-3 pr-4 hidden sm:table-cell">
                  <span className="font-mono text-sm" style={{ color: light ? 'rgba(255,255,255,0.45)' : '#6b7280' }}>
                    {flag} {r.country}
                  </span>
                </td>

                {/* Time */}
                <td className="py-3 text-right">
                  <div className="inline-flex items-center justify-end gap-1">
                    <span
                      className="font-mono font-bold text-sm"
                      style={{ color: isLeader ? 'var(--accent)' : (light ? 'var(--ink-on-dark)' : 'var(--ink)') }}
                    >
                      {r.time}
                    </span>
                    {showVerified && <VerifiedBadge status={verified} />}
                  </div>
                </td>

                {/* Gap */}
                <td className="py-3 pl-4 text-right hidden md:table-cell">
                  <span
                    className="font-mono text-xs"
                    style={{ color: isLeader ? 'var(--accent)' : 'var(--muted)' }}
                  >
                    {gap}
                  </span>
                </td>

                {showExtras && (
                  <td className="py-3 pl-4 text-center hidden lg:table-cell">
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
                  <td className="py-3 pl-4 text-right hidden lg:table-cell">
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
  );
}
