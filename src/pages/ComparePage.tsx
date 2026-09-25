import { useState, useRef } from 'react';
import { athletes } from '../data/athletes';
import type { Athlete, Event } from '../types';
import { EVENTS } from '../types';
import { getFlagEmoji, timeToSeconds } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';
import TransplantBadge from '../components/TransplantBadge';

const MAX_ATHLETES = 4;

// Get PB time for an athlete + event combo (LCM preferred)
function getPB(athlete: Athlete, event: Event): string | null {
  const pb = athlete.personalBests.find(p => p.event === event && p.course === 'LCM')
    || athlete.personalBests.find(p => p.event === event);
  return pb ? pb.time : null;
}

// Find fastest time in a row
function findFastest(times: (string | null)[]): number {
  const secs = times
    .filter(Boolean)
    .map(t => timeToSeconds(t!));
  return secs.length ? Math.min(...secs) : Infinity;
}

export default function ComparePage() {
  const [selected, setSelected] = useState<Athlete[]>([]);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = query.trim().length > 0
    ? athletes
        .filter(a => {
          const name = `${a.firstName} ${a.lastName}`.toLowerCase();
          return name.includes(query.toLowerCase()) && !selected.find(s => s.id === a.id);
        })
        .slice(0, 6)
    : [];

  function addAthlete(a: Athlete) {
    if (selected.length >= MAX_ATHLETES) return;
    if (selected.find(s => s.id === a.id)) return;
    setSelected(prev => [...prev, a]);
    setQuery('');
    inputRef.current?.focus();
  }

  function removeAthlete(id: string) {
    setSelected(prev => prev.filter(a => a.id !== id));
  }

  // Only show events where at least one selected athlete has a PB
  const relevantEvents = EVENTS.filter(ev =>
    selected.some(a => getPB(a, ev) !== null),
  );

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
          <Eyebrow color="accent" className="mb-4">Tools</Eyebrow>
          <h1
            className="display text-4xl md:text-5xl font-black uppercase leading-tight tracking-tight"
            style={{ color: 'var(--ink-on-dark)' }}
          >
            Athlete Comparison
          </h1>
          <p className="mt-3 font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
            Select up to {MAX_ATHLETES} athletes to compare personal bests side by side.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8 pb-16 space-y-8">

        {/* Search + chips */}
        <div>
          <div className="relative">
            <div
              className="flex flex-wrap items-center gap-2 border px-3 py-2 min-h-[3rem]"
              style={{
                backgroundColor: 'var(--navy-mid)',
                borderColor: focused ? 'var(--accent)' : 'var(--navy-light)',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Selected chips */}
              {selected.map(a => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1"
                  style={{
                    backgroundColor: 'rgba(199,243,104,0.12)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                  }}
                >
                  {a.firstName} {a.lastName}
                  <button
                    onClick={() => removeAthlete(a.id)}
                    className="ml-1 opacity-60 hover:opacity-100 transition-opacity leading-none"
                    style={{ color: 'var(--accent)' }}
                  >
                    ×
                  </button>
                </span>
              ))}

              {selected.length < MAX_ATHLETES && (
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={selected.length === 0 ? 'Search athletes by name…' : 'Add another…'}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)}
                  className="flex-1 min-w-[160px] bg-transparent font-mono text-sm outline-none"
                  style={{ color: 'var(--ink-on-dark)' }}
                />
              )}
            </div>

            {/* Dropdown */}
            {focused && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full z-20 border border-t-0 shadow-xl"
                style={{ backgroundColor: 'var(--navy-mid)', borderColor: 'var(--navy-light)' }}
              >
                {suggestions.map(a => (
                  <button
                    key={a.id}
                    onClick={() => addAthlete(a)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b last:border-b-0 transition-colors"
                    style={{ borderColor: 'var(--navy-light)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(199,243,104,0.06)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                  >
                    <div
                      className="w-8 h-8 flex-shrink-0 flex items-center justify-center font-mono text-xs font-bold"
                      style={{ backgroundColor: 'var(--navy)', color: 'var(--ink-on-dark)' }}
                    >
                      {a.avatarInitials || `${a.firstName[0]}${a.lastName[0]}`}
                    </div>
                    <div>
                      <div className="font-mono text-sm font-bold" style={{ color: 'var(--ink-on-dark)' }}>
                        {a.firstName} {a.lastName}
                      </div>
                      <div className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                        {getFlagEmoji(a.countryCode)} {a.country} · {a.ageGroup}
                      </div>
                    </div>
                    <div className="ml-auto">
                      <TransplantBadge type={a.transplantType} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <p className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
              {selected.length}/{MAX_ATHLETES} athletes selected
            </p>
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="font-mono text-xs uppercase tracking-widest transition-colors"
                style={{ color: 'var(--muted-on-dark)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-on-dark)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-on-dark)')}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {selected.length === 0 && (
          <div
            className="border py-20 flex flex-col items-center text-center"
            style={{ borderColor: 'var(--navy-light)' }}
          >
            <div
              className="w-16 h-16 border-2 flex items-center justify-center mb-6"
              style={{ borderColor: 'var(--navy-light)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--muted-on-dark)' }}>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="15" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 21c0-4 3-7 7-7M22 21c0-4-3-7-7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="font-bold text-xl" style={{ color: 'var(--ink-on-dark)' }}>
              No athletes selected
            </h3>
            <p className="mt-2 font-mono text-sm max-w-xs" style={{ color: 'var(--muted-on-dark)' }}>
              Search for athletes above to start comparing personal bests across events.
            </p>
          </div>
        )}

        {/* Comparison table */}
        {selected.length > 0 && (
          <div
            className="border overflow-x-auto"
            style={{ borderColor: 'var(--navy-light)' }}
          >
            {/* Table header — athlete columns */}
            <div
              className="grid border-b"
              style={{
                borderColor: 'var(--navy-light)',
                gridTemplateColumns: `200px repeat(${selected.length}, 1fr)`,
                minWidth: `${200 + selected.length * 160}px`,
              }}
            >
              <div
                className="px-4 py-4 border-r"
                style={{ backgroundColor: 'var(--navy-mid)', borderColor: 'var(--navy-light)' }}
              >
                <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                  Event
                </span>
              </div>
              {selected.map(a => (
                <div
                  key={a.id}
                  className="px-4 py-4 border-r last:border-r-0 text-center"
                  style={{ backgroundColor: 'var(--navy-mid)', borderColor: 'var(--navy-light)' }}
                >
                  <div
                    className="w-10 h-10 mx-auto mb-2 flex items-center justify-center font-mono font-bold text-sm"
                    style={{ backgroundColor: 'var(--navy)', color: 'var(--ink-on-dark)' }}
                  >
                    {a.avatarInitials || `${a.firstName[0]}${a.lastName[0]}`}
                  </div>
                  <div className="font-bold text-sm leading-snug" style={{ color: 'var(--ink-on-dark)' }}>
                    {a.firstName} {a.lastName}
                  </div>
                  <div className="mt-0.5 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                    {getFlagEmoji(a.countryCode)} {a.country}
                  </div>
                  <div className="mt-2 flex justify-center">
                    <TransplantBadge type={a.transplantType} />
                  </div>
                </div>
              ))}
            </div>

            {/* Rows */}
            {relevantEvents.length === 0 ? (
              <div
                className="py-12 text-center"
                style={{ backgroundColor: 'var(--navy)' }}
              >
                <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                  No matching events
                </p>
              </div>
            ) : (
              relevantEvents.map((ev, rowIdx) => {
                const times = selected.map(a => getPB(a, ev));
                const fastestSec = findFastest(times);

                return (
                  <div
                    key={ev}
                    className="grid border-b last:border-b-0"
                    style={{
                      borderColor: 'var(--navy-light)',
                      backgroundColor: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      gridTemplateColumns: `200px repeat(${selected.length}, 1fr)`,
                      minWidth: `${200 + selected.length * 160}px`,
                    }}
                  >
                    {/* Event name */}
                    <div
                      className="px-4 py-3.5 border-r flex items-center"
                      style={{ borderColor: 'var(--navy-light)' }}
                    >
                      <span className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                        {ev}
                      </span>
                    </div>

                    {/* Times per athlete */}
                    {selected.map(a => {
                      const time = getPB(a, ev);
                      const isFastest = time !== null && timeToSeconds(time) === fastestSec;
                      return (
                        <div
                          key={a.id}
                          className="px-4 py-3.5 border-r last:border-r-0 text-center flex items-center justify-center"
                          style={{
                            borderColor: 'var(--navy-light)',
                            backgroundColor: isFastest ? 'rgba(199,243,104,0.07)' : 'transparent',
                          }}
                        >
                          {time ? (
                            <span
                              className="font-mono font-bold text-sm"
                              style={{ color: isFastest ? 'var(--accent)' : 'var(--ink-on-dark)' }}
                            >
                              {time}
                            </span>
                          ) : (
                            <span className="font-mono text-sm" style={{ color: 'var(--navy-light)' }}>
                              —
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        )}

        {selected.length > 0 && (
          <p className="font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
            Times shown are LCM personal bests where available, otherwise SCM. Highlighted cells indicate the fastest time in each event.
          </p>
        )}
      </div>
    </div>
  );
}
