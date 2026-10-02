import { Link } from 'react-router-dom';
import type { SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import { formatDate, getCountryAlpha3, getFlagEmoji } from '../lib/utils';
import VerificationBadge from './VerificationBadge';

export default function DatabaseResultsTable({ results, showAthlete = true }: { results: SubmittedSwimmerResult[]; showAthlete?: boolean }) {
  return (
    <div className="w-full ta-table-scroll ta-table-shell">
      <table className="w-full border-collapse">
        <thead>
          <tr className="ta-table-header">
            {(showAthlete ? ['Athlete', 'Event', 'Age group', 'Gender', 'Transplant type', 'Time', 'Course', 'PTS', 'Date', 'Meet', 'Club represented', 'Status'] : ['Event', 'Age group', 'Gender', 'Transplant type', 'Time', 'Course', 'PTS', 'Date', 'Meet', 'Club represented', 'Status']).map(heading => (
              <th key={heading} className={`whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 ${heading === 'Time' ? 'text-right' : ''}`}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.length ? results.map(result => {
            const swimmerId = result.athlete_id || result.swimmer_id;
            const meet = result.submitted_meets;
            const verifiedStatus = result.status === 'verified' ? 'Verified' : result.status === 'imported_unverified' ? 'Unverified' : 'Pending';
            return (
              <tr key={result.id} className="ta-table-row">
                {showAthlete && <td className="px-3 py-4 text-sm font-semibold text-[var(--ink)] sm:px-5">
                  <div className="min-w-32">
                    <div className="truncate">
                      {swimmerId
                        ? <Link to={`/athletes/${swimmerId}`} className="hover:text-[var(--accent-dark)] hover:underline">{result.swimmer_name || '—'}</Link>
                        : result.swimmer_name || '—'}
                    </div>
                    <span className="mt-1 flex items-center gap-1.5 font-mono text-xs text-[var(--muted)]" title={result.country || 'Country not supplied'}>
                      <span className="ta-table-flag" aria-hidden="true">{result.country_code ? getFlagEmoji(result.country_code) : '—'}</span>
                      <span className="font-semibold tracking-wider">{result.country_code ? getCountryAlpha3(result.country_code) : '—'}</span>
                    </span>
                  </div>
                </td>}
                <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--ink)] sm:px-5">{result.event || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{result.age_group || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{result.gender || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{result.transplant_type || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-base font-bold text-[var(--navy)] sm:px-5">{result.time || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{result.course || meet?.course || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-sm font-semibold text-[var(--ink)] sm:px-5">{result.points?.toLocaleString() ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{formatDate(meet?.meet_date || result.created_at)}</td>
                <td className="max-w-56 px-3 py-4 text-xs text-[var(--muted)] sm:px-5">
                  <span className="block truncate" title={meet?.name || 'Meet not supplied'}>{meet?.name || '—'}</span>
                  {meet && <span className="mt-1 block truncate font-mono text-[10px]">{meet.location || '—'}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{result.represented_club_name || '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 sm:px-5"><VerificationBadge status={verifiedStatus} /></td>
              </tr>
            );
          }) : (
            <tr><td colSpan={showAthlete ? 12 : 11} className="py-12 text-center font-mono text-sm text-[var(--muted)]">No results found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
