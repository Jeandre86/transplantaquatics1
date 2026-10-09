import { Link } from 'react-router-dom';
import type { SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import { formatDate, getCountryAlpha3, getFlagEmoji } from '../lib/utils';
import { countries } from '../data/countries';
import SortableTable from './SortableTable';
import { timeToSeconds } from '../lib/utils';
import type { Medal } from '../types';

type WtgRecordRow = { event: string; age_group: string; gender: string; course: string; time_ms: number };

function medalColor(result: SubmittedSwimmerResult, medals: Medal[]) {
  const placing = Number(result.placing);
  if (result.submitted_meets?.is_world_transplant_games && placing >= 1 && placing <= 3) {
    return placing === 1 ? 'Gold' : placing === 2 ? 'Silver' : 'Bronze';
  }
  const year = result.submitted_meets?.meet_year ?? (result.submitted_meets?.meet_date ? new Date(result.submitted_meets.meet_date).getFullYear() : null);
  return medals.find(medal => medal.event === result.event && medal.year === year && medal.competition === result.submitted_meets?.name)?.color;
}

export default function DatabaseResultsTable({ results, showAthlete = true, showGender = true, showTransplantType = true, showCourse = true, showPoints = true, showDate = true, showMedals = false, medals = [], worldRecords = [], layout = 'default' }: { results: SubmittedSwimmerResult[]; showAthlete?: boolean; showGender?: boolean; showTransplantType?: boolean; showCourse?: boolean; showPoints?: boolean; showDate?: boolean; showMedals?: boolean; medals?: Medal[]; worldRecords?: WtgRecordRow[]; layout?: 'default' | 'directory' }) {
  if (layout === 'directory') {
    const directoryHeadings = ['Date', 'Athlete', 'Event', 'Category', 'Time', 'Pts', 'Meet'];
    return <div className="w-full ta-table-scroll ta-table-shell">
      <SortableTable><table className="w-full border-collapse">
        <thead><tr className="ta-table-header">{directoryHeadings.map(heading => <th key={heading} className={`whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-4 ${heading.startsWith('Time') || heading.startsWith('Pts') ? 'text-right' : ''}`}>{heading}</th>)}</tr></thead>
        <tbody>{results.length ? results.map(result => {
          const swimmerId = result.athlete_id || result.swimmer_id;
          const meet = result.submitted_meets;
          const countryCode = result.country_code?.trim() || countries.find(country => country.name.toLocaleLowerCase() === result.country?.trim().toLocaleLowerCase())?.code || '';
          return <tr key={result.id} className="ta-table-row">
            <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-4">{formatDate(meet?.meet_date || result.created_at)}</td>
            <td className="px-3 py-3.5 text-sm font-semibold text-[var(--ink)] sm:px-4">
              <div className="min-w-32">
                <div className="truncate">{swimmerId ? <Link to={`/athletes/${swimmerId}`} className="hover:text-[var(--accent-dark)] hover:underline">{result.swimmer_name || '—'}</Link> : result.swimmer_name || '—'}</div>
                <span className="mt-1 flex items-center gap-1.5 font-mono text-xs text-[var(--muted)]" title={result.country || 'Country not supplied'}><span className="ta-table-flag" aria-hidden="true">{countryCode ? getFlagEmoji(countryCode) : '—'}</span><span className="font-semibold tracking-wider">{countryCode ? getCountryAlpha3(countryCode) : '—'}</span></span>
              </div>
            </td>
            <td className="px-3 py-3.5 text-sm text-[var(--ink)] sm:px-4"><span className="whitespace-nowrap">{result.event || '—'}</span><span className="ml-1.5 font-mono text-[10px] text-[var(--muted)]">{result.course || meet?.course || ''}</span></td>
            <td className="px-3 py-3.5 text-sm text-[var(--muted)] sm:px-4">{result.age_group || '—'} · {result.gender || '—'}</td>
            <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-base font-bold text-[var(--navy)] sm:px-4">{result.time || '—'}</td>
            <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-sm text-[var(--ink)] sm:px-4">{result.points?.toLocaleString() ?? '—'}</td>
            <td className="max-w-56 px-3 py-3.5 text-sm text-[var(--ink)] sm:px-4"><span className="block truncate" title={meet?.name || 'Meet not supplied'}>{meet?.name || '—'}</span><span className="mt-1 block truncate text-xs text-[var(--muted)]">{meet?.location || '—'}</span></td>
          </tr>;
        }) : <tr><td colSpan={directoryHeadings.length} className="py-12 text-center font-mono text-sm text-[var(--muted)]">No results found.</td></tr>}</tbody>
      </table></SortableTable>
    </div>;
  }

  const headings = [
    ...(!showAthlete && !showGender && !showTransplantType && !showPoints && showMedals
      ? ['Event', 'Time', 'Medal', ...(showCourse ? ['Course'] : []), 'Age group', 'Meet', ...(showDate ? ['Date'] : [])]
      : [
        ...(showAthlete ? ['Athlete'] : []),
        'Event', 'Age group', ...(showGender ? ['Gender'] : []), ...(showTransplantType ? ['Transplant type'] : []), 'Time',
        ...(showMedals ? ['Medal'] : []),
        ...(showCourse ? ['Course'] : []), ...(showPoints ? ['PTS'] : []),
        ...(showDate ? ['Date'] : []), 'Meet', 'Club represented',
      ]),
  ];
  const athleteProfileLayout = !showAthlete && !showGender && !showTransplantType && !showPoints && showMedals;
  return (
    <div className="w-full ta-table-scroll ta-table-shell">
      <SortableTable><table className="w-full border-collapse">
        <thead>
          <tr className="ta-table-header">
            {headings.map(heading => (
              <th key={heading || 'unlabeled-status'} aria-label={heading || 'Status'} className={`whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 ${heading === 'Time' ? 'text-right' : ''}`}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.length ? results.map(result => {
            const swimmerId = result.athlete_id || result.swimmer_id;
            const meet = result.submitted_meets;
            const countryCode = result.country_code?.trim()
              || countries.find(country => country.name.toLocaleLowerCase() === result.country?.trim().toLocaleLowerCase())?.code
              || '';
            const medal = showMedals ? medalColor(result, medals) : undefined;
            const resultMilliseconds = timeToSeconds(result.time) * 1000;
            const isWorldRecord = showMedals && worldRecords.some(record => record.event.toLocaleLowerCase() === result.event.toLocaleLowerCase()
              && record.age_group.toLocaleLowerCase() === result.age_group.toLocaleLowerCase()
              && record.gender.toLocaleLowerCase() === result.gender.toLocaleLowerCase()
              && record.course.toLocaleLowerCase() === (result.course || meet?.course || '').toLocaleLowerCase()
              && Math.abs(record.time_ms - resultMilliseconds) <= 10);
            const resultDate = meet?.meet_date
              ? formatDate(meet.meet_date)
              : athleteProfileLayout
                ? (meet?.meet_year ? String(meet.meet_year) : '—')
                : formatDate(result.created_at);
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
                      <span className="ta-table-flag" aria-hidden="true">{countryCode ? getFlagEmoji(countryCode) : '—'}</span>
                      <span className="font-semibold tracking-wider">{countryCode ? getCountryAlpha3(countryCode) : '—'}</span>
                    </span>
                  </div>
                </td>}
                <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--ink)] sm:px-5">{result.event || '—'}</td>
                {!athleteProfileLayout && <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{result.age_group || '—'}</td>}
                {!athleteProfileLayout && showGender && <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{result.gender || '—'}</td>}
                {!athleteProfileLayout && showTransplantType && <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{result.transplant_type || '—'}</td>}
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-base font-bold text-[var(--navy)] sm:px-5"><span className="inline-flex flex-col items-end">{result.time || '—'}{isWorldRecord && <span className="mt-1 border border-[var(--accent)]/35 bg-[var(--ice)] px-1.5 py-0.5 text-[10px] leading-none tracking-wide text-[var(--accent-dark)]">WR</span>}</span></td>
                {showMedals && <td className="px-3 py-4 text-center sm:px-5">{medal ? <span className="inline-flex" title={`${medal} medal`} aria-label={`${medal} medal`}><img src={`/assets/medal-${medal.toLocaleLowerCase()}.svg`} alt="" aria-hidden="true" className="h-6 w-6 object-contain" /></span> : <span className="text-[var(--muted)]">—</span>}</td>}
                {showCourse && <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{result.course || meet?.course || '—'}</td>}
                {athleteProfileLayout && <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{result.age_group || '—'}</td>}
                {!athleteProfileLayout && showPoints && <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-sm font-semibold text-[var(--ink)] sm:px-5">{result.points?.toLocaleString() ?? '—'}</td>}
                {!athleteProfileLayout && showDate && <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{resultDate}</td>}
                <td className={`max-w-56 px-3 py-4 text-xs text-[var(--muted)] sm:px-5 ${athleteProfileLayout ? 'min-w-48' : ''}`}>
                  <span className="block truncate" title={meet?.name || 'Meet not supplied'}>{meet?.name || '—'}</span>
                  {meet && <span className="mt-1 block truncate font-mono text-[10px]">{meet.location || '—'}</span>}
                </td>
                {!athleteProfileLayout && <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted)] sm:px-5">{result.represented_club_name || '—'}</td>}
                {athleteProfileLayout && showDate && <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{resultDate}</td>}
              </tr>
            );
          }) : (
            <tr><td colSpan={headings.length} className="py-12 text-center font-mono text-sm text-[var(--muted)]">No results found.</td></tr>
          )}
        </tbody>
      </table></SortableTable>
    </div>
  );
}
