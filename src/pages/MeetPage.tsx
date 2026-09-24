import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { meets } from '../data/meets';
import { results } from '../data/results';
import { records } from '../data/records';
import { athletes } from '../data/athletes';
import { formatDate, getFlagEmoji } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';
import EmptyState from '../components/EmptyState';

// Determine meet status based on date
function getMeetStatus(dateStr: string): 'Upcoming' | 'Completed' {
  const meetDate = new Date(dateStr);
  const today = new Date();
  return meetDate >= today ? 'Upcoming' : 'Completed';
}

export default function MeetPage() {
  const { id } = useParams<{ id: string }>();
  const meet = meets.find(m => m.id === id);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  if (!meet) {
    return (
      <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
        <div className="max-w-3xl mx-auto px-6 py-20">
          <EmptyState
            title="Meet not found"
            subtitle="This meet may not exist or has been removed."
          />
          <div className="mt-8 flex justify-center">
            <Link
              to="/calendar"
              className="font-mono text-xs uppercase tracking-widest px-5 py-2.5 border"
              style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
            >
              Back to calendar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const status = getMeetStatus(meet.date);

  // Get all results for this meet (match by meet name)
  const meetResults = results.filter(r => r.meet === meet.name);

  // Group by event
  const eventMap = new Map<string, typeof meetResults>();
  meetResults.forEach(r => {
    const key = `${r.event}`;
    if (!eventMap.has(key)) eventMap.set(key, []);
    eventMap.get(key)!.push(r);
  });

  // Sort each event group by time and take top 3
  const eventGroups = Array.from(eventMap.entries()).map(([event, res]) => ({
    event,
    results: res
      .sort((a, b) => {
        const toSec = (t: string) => {
          if (t.includes(':')) {
            const [m, s] = t.split(':');
            return parseInt(m) * 60 + parseFloat(s);
          }
          return parseFloat(t);
        };
        return toSec(a.time) - toSec(b.time);
      })
      .slice(0, 3),
  }));

  // Stats
  const athleteSet = new Set(meetResults.map(r => r.athleteId));
  const nationSet = new Set(
    Array.from(athleteSet)
      .map(aid => athletes.find(a => a.id === aid)?.countryCode)
      .filter(Boolean),
  );
  const recordsBroken = records.filter(r => r.meet === meet.name);

  function getAthleteFlag(athleteId: string) {
    const a = athletes.find(at => at.id === athleteId);
    return a ? getFlagEmoji(a.countryCode) : '';
  }

  function getAthleteName(athleteId: string) {
    const a = athletes.find(at => at.id === athleteId);
    return a ? `${a.firstName} ${a.lastName}` : athleteId;
  }

  const rankMedal = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
      {/* Header */}
      <section
        className="border-b"
        style={{ backgroundColor: 'var(--navy-mid)', borderColor: 'var(--navy-light)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-14">
          <Link
            to="/calendar"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-8 transition-colors"
            style={{ color: 'var(--muted-on-dark)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Calendar
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Eyebrow color="accent" className="mb-3">Meet</Eyebrow>
              <h1
                className="display text-3xl md:text-5xl font-black uppercase leading-tight tracking-tight"
                style={{ color: 'var(--ink-on-dark)' }}
              >
                {meet.name}
              </h1>
              <p className="mt-3 font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
                {meet.location} · {formatDate(meet.date)} · {meet.course}
              </p>
            </div>

            {/* Status badge */}
            <span
              className="self-start mt-1 font-mono text-xs uppercase tracking-widest px-3 py-1.5"
              style={{
                backgroundColor: status === 'Upcoming' ? 'rgba(199,243,104,0.12)' : 'rgba(0,194,215,0.1)',
                color: status === 'Upcoming' ? 'var(--accent)' : 'var(--aqua)',
                border: `1px solid ${status === 'Upcoming' ? 'var(--accent)' : 'var(--aqua)'}`,
              }}
            >
              {status}
            </span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section
        className="border-b"
        style={{ backgroundColor: 'var(--navy-mid)', borderColor: 'var(--navy-light)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-x"
            style={{ '--tw-divide-opacity': '1' } as React.CSSProperties}
          >
            {[
              { value: String(eventGroups.length || '—'), label: 'Events' },
              { value: String(athleteSet.size || '—'), label: 'Athletes' },
              { value: String(nationSet.size || '—'), label: 'Nations' },
              { value: String(recordsBroken.length || '0'), label: 'Records Broken' },
            ].map(stat => (
              <div key={stat.label} className="pl-6 first:pl-0">
                <div
                  className="font-mono font-black text-3xl"
                  style={{ color: 'var(--accent)' }}
                >
                  {stat.value}
                </div>
                <div className="mt-1 font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">
        {/* Results by event */}
        <div>
          <Eyebrow light className="mb-6">Results by Event</Eyebrow>

          {eventGroups.length === 0 ? (
            <div
              className="border p-12 text-center"
              style={{ borderColor: 'var(--navy-light)' }}
            >
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                No results recorded yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {eventGroups.map(({ event, results: res }) => {
                const isOpen = expandedEvent === event;
                return (
                  <div
                    key={event}
                    className="border transition-colors"
                    style={{ borderColor: 'var(--navy-light)', backgroundColor: isOpen ? 'var(--navy-mid)' : 'transparent' }}
                  >
                    {/* Accordion header */}
                    <button
                      className="w-full flex items-center justify-between px-6 py-4 text-left"
                      onClick={() => setExpandedEvent(isOpen ? null : event)}
                    >
                      <span
                        className="font-mono text-sm font-bold uppercase tracking-wide"
                        style={{ color: 'var(--ink-on-dark)' }}
                      >
                        {event}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                          {res.length} results
                        </span>
                        <svg
                          width="16" height="16" viewBox="0 0 16 16" fill="none"
                          style={{
                            color: 'var(--muted-on-dark)',
                            transform: isOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                          }}
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </button>

                    {/* Accordion body */}
                    {isOpen && (
                      <div className="border-t" style={{ borderColor: 'var(--navy-light)' }}>
                        {res.map((r, idx) => (
                          <div
                            key={r.id}
                            className="flex items-center px-6 py-3 border-b last:border-b-0"
                            style={{ borderColor: 'var(--navy-light)' }}
                          >
                            <span className="w-8 text-lg">{rankMedal[idx]}</span>
                            <span className="flex-1 font-mono text-sm" style={{ color: 'var(--ink-on-dark)' }}>
                              {getAthleteFlag(r.athleteId)} {getAthleteName(r.athleteId)}
                            </span>
                            <span
                              className="font-mono font-bold text-base"
                              style={{ color: idx === 0 ? 'var(--accent)' : 'var(--ink-on-dark)' }}
                            >
                              {r.time}
                            </span>
                            {r.isPB && (
                              <span
                                className="ml-3 font-mono text-xs px-2 py-0.5"
                                style={{
                                  backgroundColor: 'rgba(199,243,104,0.12)',
                                  color: 'var(--accent)',
                                  border: '1px solid var(--accent)',
                                }}
                              >
                                PB
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Records broken */}
        {recordsBroken.length > 0 && (
          <div>
            <Eyebrow light className="mb-6">Records Broken at This Meet</Eyebrow>
            <div className="space-y-3">
              {recordsBroken.map(rec => (
                <div
                  key={rec.id}
                  className="border px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                  style={{
                    borderColor: 'var(--accent)',
                    backgroundColor: 'rgba(199,243,104,0.05)',
                  }}
                >
                  <div>
                    <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
                      World Record
                    </div>
                    <div className="font-bold" style={{ color: 'var(--ink-on-dark)' }}>
                      {rec.event} · {rec.course} · {rec.gender} {rec.ageGroup}
                    </div>
                    <div className="mt-1 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                      {rec.athleteName} · {rec.country}
                    </div>
                  </div>
                  <div className="font-mono font-black text-2xl" style={{ color: 'var(--accent)' }}>
                    {rec.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
