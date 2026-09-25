import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { clubs } from '../data/clubs';
import { athletes } from '../data/athletes';
import { getFlagEmoji, timeToSeconds } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';
import EmptyState from '../components/EmptyState';
import TransplantBadge from '../components/TransplantBadge';
import Pagination from '../components/Pagination';

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
  const pbMap = new Map<string, { athleteName: string; time: string; timeSec: number }>();
  roster.forEach(a => {
    a.personalBests.forEach(pb => {
      const key = `${pb.event} · ${pb.course}`;
      const timeSec = timeToSeconds(pb.time);
      if (!pbMap.has(key) || timeSec < pbMap.get(key)!.timeSec) {
        pbMap.set(key, {
          athleteName: `${a.firstName} ${a.lastName}`,
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
    <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
      {/* Header */}
      <section
        className="border-b"
        style={{
          backgroundColor: 'var(--navy-mid)',
          borderColor: 'var(--navy-light)',
          backgroundImage:
            'repeating-linear-gradient(-55deg, transparent, transparent 18px, rgba(255,255,255,0.015) 18px, rgba(255,255,255,0.015) 19px)',
        }}
      >
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
      <section
        className="border-b"
        style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-8">
            {[
              { value: String(club.memberCount), label: 'Members' },
              { value: String(club.foundedYear), label: 'Founded' },
              { value: String(roster.length), label: 'Registered Athletes' },
            ].map(s => (
              <div key={s.label}>
                <div className="font-mono font-black text-2xl" style={{ color: 'var(--aqua)' }}>
                  {s.value}
                </div>
                <div className="font-mono text-xs uppercase tracking-widest mt-0.5" style={{ color: 'var(--muted-on-dark)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-10 space-y-14">

        {/* Description */}
        <section>
          <Eyebrow light className="mb-4">About</Eyebrow>
          <p className="text-base leading-8 max-w-3xl" style={{ color: 'var(--muted-on-dark)' }}>
            {club.description}
          </p>
        </section>

        {/* Roster */}
        <section>
          <Eyebrow light className="mb-6">Roster</Eyebrow>
          {roster.length === 0 ? (
            <div
              className="border py-12 text-center"
              style={{ borderColor: 'var(--navy-light)' }}
            >
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                No registered athletes
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pageRoster.map(a => (
                <div
                  key={a.id}
                  className="border p-5"
                  style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}
                >
                  <Link
                    to={`/athletes/${a.id}`}
                    className="flex items-start gap-4 group"
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      className="w-12 h-12 flex-shrink-0 flex items-center justify-center font-mono font-bold text-sm"
                      style={{ backgroundColor: 'var(--navy)', color: 'var(--ink-on-dark)' }}
                    >
                      {a.avatarInitials || `${a.firstName[0]}${a.lastName[0]}`}
                    </div>
                    <div>
                      <div
                        className="font-bold text-base leading-snug group-hover:underline"
                        style={{ color: 'var(--ink-on-dark)' }}
                      >
                        {a.firstName} {a.lastName}
                      </div>
                      <div className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                        {getFlagEmoji(a.countryCode)} {a.country}
                      </div>
                      <div className="mt-2">
                        <TransplantBadge type={a.transplantType} />
                      </div>
                    </div>
                  </Link>
                  {a.personalBests[0] && (
                    <div
                      className="mt-4 pt-4 border-t flex items-center justify-between"
                      style={{ borderColor: 'var(--navy-light)' }}
                    >
                      <span className="font-mono text-xs uppercase tracking-wide" style={{ color: 'var(--muted-on-dark)' }}>
                        {a.personalBests[0].event} · {a.personalBests[0].course}
                      </span>
                      <span className="font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>
                        {a.personalBests[0].time}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Pagination page={rosterPage} pageCount={rosterPageCount} onPageChange={setRosterPage} label="Club roster pages" />
        </section>

        {/* Fastest in club */}
        {leaderboard.length > 0 && (
          <section>
            <Eyebrow light className="mb-6">Fastest in Club</Eyebrow>
            <div
              className="border overflow-hidden"
              style={{ borderColor: 'var(--navy-light)' }}
            >
              {/* Header */}
              <div
                className="grid px-4 py-3 font-mono text-xs uppercase tracking-widest border-b"
                style={{
                  backgroundColor: 'var(--navy-mid)',
                  borderColor: 'var(--navy-light)',
                  color: 'var(--muted-on-dark)',
                  gridTemplateColumns: '1fr 1fr auto',
                }}
              >
                <span>Event</span>
                <span>Athlete</span>
                <span>Time</span>
              </div>

              {leaderboard.map((row, idx) => (
                <div
                  key={row.event}
                  className="grid items-center px-4 py-3.5 border-b last:border-b-0"
                  style={{
                    borderColor: 'var(--navy-light)',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    gridTemplateColumns: '1fr 1fr auto',
                  }}
                >
                  <span className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                    {row.event}
                  </span>
                  <span className="font-mono text-sm" style={{ color: 'var(--ink-on-dark)' }}>
                    {row.athleteName}
                  </span>
                  <span className="font-mono font-bold text-base" style={{ color: 'var(--accent)' }}>
                    {row.time}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
