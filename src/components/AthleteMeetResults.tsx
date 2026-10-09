import { useMemo, useState } from 'react';
import { ChevronDown, MapPin, Trophy } from 'lucide-react';
import DatabaseResultsTable from './DatabaseResultsTable';
import type { PublicSwimmerProfile, PublicSwimmerResult, SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import type { Medal } from '../types';

type WtgRecordRow = { event: string; age_group: string; gender: string; course: string; time_ms: number };

interface AthleteMeetResultsProps {
  athlete: Pick<PublicSwimmerProfile, 'id' | 'first_name' | 'last_name' | 'country' | 'country_code' | 'gender' | 'transplant_type'>;
  results: PublicSwimmerResult[];
  medals: Medal[];
  worldRecords: WtgRecordRow[];
}

function meetYear(result: PublicSwimmerResult) {
  if (result.meet_year) return result.meet_year;
  if (result.meet_date) return new Date(`${result.meet_date}T00:00:00`).getFullYear();
  return Number(result.meet_name?.match(/\b(19|20)\d{2}\b/)?.[0]) || null;
}

function dateLabel(result: PublicSwimmerResult) {
  const format = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  if (result.meet_date && result.meet_end_date && result.meet_end_date !== result.meet_date) {
    const start = new Date(`${result.meet_date}T00:00:00`);
    const end = new Date(`${result.meet_end_date}T00:00:00`);
    const sameMonthYear = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonthYear) return `${start.toLocaleDateString(undefined, { day: '2-digit' })}–${format(result.meet_end_date)}`;
    return `${format(result.meet_date)} – ${format(result.meet_end_date)}`;
  }
  if (result.meet_date) return format(result.meet_date);
  return meetYear(result)?.toString() ?? 'Date unavailable';
}

export default function AthleteMeetResults({ athlete, results, medals, worldRecords }: AthleteMeetResultsProps) {
  const [expandedMeet, setExpandedMeet] = useState<string | null>(null);
  const groups = useMemo(() => {
    const grouped = new Map<string, PublicSwimmerResult[]>();
    results.forEach(result => {
      const fallbackIdentity = [result.meet_name, meetYear(result), result.location, result.course].map(value => value ?? '').join('|');
      const identity = result.meet_id || (fallbackIdentity.replaceAll('|', '').trim() ? fallbackIdentity : result.id);
      const rows = grouped.get(identity) ?? [];
      rows.push(result);
      grouped.set(identity, rows);
    });
    return [...grouped.entries()].map(([key, rows]) => ({ key, rows, first: rows[0] }))
      .sort((a, b) => (meetYear(b.first) ?? 0) - (meetYear(a.first) ?? 0)
        || (b.first.meet_date ?? '').localeCompare(a.first.meet_date ?? '')
        || (a.first.meet_name ?? '').localeCompare(b.first.meet_name ?? ''));
  }, [results]);

  const tableResults = (rows: PublicSwimmerResult[]): SubmittedSwimmerResult[] => rows.map(result => ({
    id: result.id,
    athlete_id: athlete.id,
    swimmer_id: athlete.id,
    event: result.event,
    time: result.time,
    course: result.course,
    age_group: result.age_group,
    points: result.points,
    placing: result.placing,
    record_candidate: false,
    record_candidate_status: 'not_candidate',
    status: result.status,
    created_at: result.created_at,
    meet_id: result.meet_id,
    swimmer_name: `${athlete.first_name} ${athlete.last_name}`,
    country: athlete.country ?? '',
    country_code: athlete.country_code,
    gender: athlete.gender,
    transplant_type: athlete.transplant_type,
    represented_club_name: result.represented_club_name,
    submitted_meets: {
      name: result.meet_name ?? '',
      meet_date: result.meet_date,
      end_date: result.meet_end_date,
      meet_year: result.meet_year,
      location: result.location ?? '',
      course: result.course ?? '',
      is_world_transplant_games: result.is_world_transplant_games,
    },
  }));

  if (!groups.length) return null;

  return <div className="space-y-3">
    {groups.map(({ key, rows, first }) => {
      const open = expandedMeet === key;
      const meetName = first.meet_name || 'Competition results';
      return <section key={key} className="overflow-hidden border border-[var(--border)] bg-white">
        <button type="button" aria-expanded={open} aria-controls={`athlete-meet-${key}`} onClick={() => setExpandedMeet(current => current === key ? null : key)} className="grid w-full grid-cols-[92px_64px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-4 text-left transition-colors hover:bg-[var(--paper)] sm:grid-cols-[150px_76px_minmax(0,1fr)_auto] sm:gap-4 sm:px-5">
          <span className="border-r border-[var(--border)] pr-3 text-sm font-semibold text-[var(--ink)] sm:pr-5">{dateLabel(first)}</span>
          <span className="flex h-12 w-12 items-center justify-center border border-[var(--border)] bg-[var(--paper)] text-[var(--accent-dark)] sm:h-14 sm:w-14">
            {meetName.toLowerCase().includes('south african masters swimming 41st lc champs')
              ? <img src="/assets/south-african-masters-swimming-41st-lc-champs.png" alt={`${meetName} logo`} className="max-h-full max-w-full object-contain" />
              : <Trophy size={23} strokeWidth={1.7} aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-[var(--ink)] sm:text-base">{meetName}</span>
            <span className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--muted)] sm:text-sm"><MapPin size={13} className="shrink-0" />{first.location || 'Location unavailable'}</span>
          </span>
          <span className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-[var(--accent-dark)] sm:text-sm">{open ? 'Hide results' : 'View results'}<ChevronDown size={17} className={`transition-transform ${open ? 'rotate-180' : ''}`} /></span>
        </button>
        {open && <div id={`athlete-meet-${key}`} className="border-t border-[var(--border)] px-2 py-3 sm:px-4 sm:py-4">
          <DatabaseResultsTable results={tableResults(rows)} showAthlete={false} showGender={false} showTransplantType={false} showPoints={false} showMedals medals={medals} worldRecords={worldRecords} />
        </div>}
      </section>;
    })}
  </div>;
}
