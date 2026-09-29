import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clubs } from '../data/clubs';
import { athletes } from '../data/athletes';
import { getCountryAlpha3, getFlagEmoji, timeToSeconds } from '../lib/utils';
import { getSavedAvatar } from '../lib/avatars';
import Eyebrow from '../components/Eyebrow';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import AthleteDirectoryTable from '../components/AthleteDirectoryTable';

const PAGE_SIZE = 10;

export default function ClubPage() {
  const { id } = useParams<{ id: string }>();
  const [rosterPage, setRosterPage] = useState(1);
  useEffect(() => setRosterPage(1), [id]);
  const club = clubs.find(c => c.id === id);

  if (!club) {
    return (
      <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
        <div className="max-w-3xl mx-auto px-6 py-20">
          <EmptyState title="Club not found" subtitle="This club may not exist or has been removed." onDark />
          <div className="mt-8 flex justify-center">
            <Link
              to="/clubs"
              className="font-mono text-xs uppercase tracking-widest px-5 py-2.5 border"
              style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
            >
              Back to clubs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get roster athletes
  const roster = athletes.filter(a => club.athleteIds.includes(a.id));
  const rosterPageCount = Math.ceil(roster.length / PAGE_SIZE);
  const pageRoster = roster.slice((rosterPage - 1) * PAGE_SIZE, rosterPage * PAGE_SIZE);

  // Build "Fastest in club" leaderboard across all PBs of roster athletes
  // Group by event, find the fastest time per event within the club
  const pbMap = new Map<string, { athleteId: string; athleteName: string; countryCode: string; time: string; timeSec: number }>();
  roster.forEach(a => {
    a.personalBests.forEach(pb => {
      const key = `${pb.event} · ${pb.course}`;
      const timeSec = timeToSeconds(pb.time);
      if (!pbMap.has(key) || timeSec < pbMap.get(key)!.timeSec) {
        pbMap.set(key, {
          athleteName: `${a.firstName} ${a.lastName}`,
          athleteId: a.id,
          countryCode: a.countryCode,
          time: pb.time,
          timeSec,
        });
      }
    });
  });

  const leaderboard = Array.from(pbMap.entries())
    .map(([event, data]) => ({ event, ...data }))
    .sort((a, b) => a.event.localeCompare(b.event))
    .slice(0, 10);

  return (
    <div>
      {/* Header */}
      <section className="border-b border-[var(--navy-light)] bg-[var(--navy)]">
        <div className="max-w-7xl mx-auto px-4 py-14">
          <Link
            to="/clubs"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-8"
            style={{ color: 'var(--muted-on-dark)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Clubs
          </Link>

          {/* Club badge */}
          <div className="flex items-start gap-6">
            <div
              className="w-16 h-16 flex-shrink-0 flex items-center justify-center font-mono font-bold text-lg"
              style={{ backgroundColor: 'var(--navy)', color: 'var(--accent)' }}
            >
              {club.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}
            </div>
            <div>
              <Eyebrow color="accent" className="mb-2">Club</Eyebrow>
              <h1
                className="display text-3xl md:text-5xl font-black uppercase leading-tight tracking-tight"
                style={{ color: 'var(--ink-on-dark)' }}
              >
                {club.name}
              </h1>
              <p className="mt-2 font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
                {getFlagEmoji(club.countryCode)} {club.city}, {club.country} · Est. {club.foundedYear}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-[var(--border)] bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { value: String(club.memberCount), label: 'Members' },
              { value: String(club.foundedYear), label: 'Founded' },
              { value: String(roster.length), label: 'Registered Athletes' },
            ].map(s => (
              <div key={s.label}>
                <div className="font-mono text-2xl font-black text-[var(--ink)]">
                  {s.value}
                </div>
                <div className="mt-0.5 font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bg-[var(--paper)]">
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10">

        {/* Description */}
        <section>
          <Eyebrow className="mb-4">About</Eyebrow>
          <p className="max-w-3xl text-base leading-8 text-[var(--muted)]">
            {club.description}
          </p>
        </section>

        {/* Roster */}
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div>
              <Eyebrow>Club roster</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Athletes</h2>
            </div>
            <span className="font-mono text-xs text-[var(--muted)]">{roster.length} registered</span>
          </div>
          {roster.length === 0 ? (
            <EmptyState title="No registered athletes" subtitle="Athletes linked to this club will appear here." />
          ) : (
            <AthleteDirectoryTable athletes={pageRoster} />
          )}
          <Pagination page={rosterPage} pageCount={rosterPageCount} onPageChange={setRosterPage} label="Club roster pages" />
        </section>

        {/* Fastest in club */}
        {leaderboard.length > 0 && (
          <section>
          <div className="mb-5 border-b border-[var(--border)] pb-4">
            <Eyebrow>Club records</Eyebrow>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Fastest in Club</h2>
          </div>
            <div className="ta-table-shell">
              {/* Header */}
              <div
                className="ta-table-header grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 sm:text-xs"
              >
                <span>Event</span>
                <span>Athlete</span>
                <span>Time</span>
              </div>
              <div>
                {leaderboard.map(row => {
                  const nameParts = row.athleteName.trim().split(/\s+/);
                  const lastName = nameParts.pop() ?? '';
                  const firstName = nameParts.join(' ');
                  const avatar = getSavedAvatar(firstName, lastName);
                  const initials = `${firstName[0] ?? row.athleteName[0]}${lastName[0] ?? ''}`.toUpperCase();
                  return (
                    <div key={row.event} className="ta-table-row grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 px-3 py-5 sm:gap-4 sm:px-5">
                      <span className="text-sm text-[var(--muted)]">{row.event}</span>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ice)] font-mono text-[10px] font-bold text-[var(--navy)] sm:h-11 sm:w-11">
                          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
                        </span>
                        <span className="min-w-0">
                          <Link to={`/athletes/${row.athleteId}`} className="block truncate text-base font-medium text-[var(--ink)] hover:text-[var(--accent-dark)]">{row.athleteName}</Link>
                          <span className="mt-1 flex items-center gap-1.5 font-mono text-xs text-[var(--muted)]">
                            <span className="ta-table-flag">{getFlagEmoji(row.countryCode)}</span>
                            <span className="font-semibold tracking-wider">{getCountryAlpha3(row.countryCode)}</span>
                          </span>
                        </span>
                      </span>
                      <span className="font-mono text-base font-bold text-[var(--accent-dark)]">{row.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
