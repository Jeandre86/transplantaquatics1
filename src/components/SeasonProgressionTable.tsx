import type { Result } from '../types';
import { timeToSeconds } from '../lib/utils';

interface SeasonProgressionTableProps {
  results: Result[];
}

export default function SeasonProgressionTable({ results }: SeasonProgressionTableProps) {
  if (results.length === 0) return null;

  // Build: eventKey -> year -> fastest time
  type EventKey = string; // "100m Freestyle|LCM"
  const eventMap = new Map<EventKey, Map<number, string>>();

  for (const r of results) {
    const key  = `${r.event}|${r.course}`;
    const year = new Date(r.date).getFullYear();
    if (!eventMap.has(key)) eventMap.set(key, new Map());
    const ym = eventMap.get(key)!;
    const ex = ym.get(year);
    if (!ex || timeToSeconds(r.time) < timeToSeconds(ex)) ym.set(year, r.time);
  }

  const allYears = Array.from(
    new Set(results.map(r => new Date(r.date).getFullYear()))
  ).sort();

  if (allYears.length === 0) return null;

  const eventKeys = Array.from(eventMap.keys()).sort();

  // Best time ever per event key
  const overallBest = new Map<EventKey, string>();
  eventMap.forEach((ym, key) => {
    let best: string | null = null;
    ym.forEach(t => {
      if (!best || timeToSeconds(t) < timeToSeconds(best)) best = t;
    });
    if (best) overallBest.set(key, best);
  });

  return (
    <div className="overflow-x-auto rounded border border-neutral-200" style={{ background: 'var(--paper)' }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th
              className="font-mono text-xs tracking-widest uppercase text-left py-3 px-4"
              style={{ color: 'var(--muted)' }}
            >
              Event / Course
            </th>
            {allYears.map(y => (
              <th
                key={y}
                className="font-mono text-xs tracking-widest uppercase text-right py-3 px-4"
                style={{ color: 'var(--muted)' }}
              >
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {eventKeys.map(key => {
            const [event, course] = key.split('|');
            const ym = eventMap.get(key)!;
            const best = overallBest.get(key);

            return (
              <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-3 px-4">
                  <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{event}</div>
                  <div className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{course}</div>
                </td>
                {allYears.map((year, yi) => {
                  const time = ym.get(year);
                  const isOverallBest = !!time && time === best;

                  // Improvement vs prior year
                  let improvStr: string | null = null;
                  if (yi > 0 && time) {
                    const prevTime = ym.get(allYears[yi - 1]);
                    if (prevTime) {
                      const delta = timeToSeconds(prevTime) - timeToSeconds(time);
                      if (delta > 0.001) improvStr = `▼ ${delta.toFixed(2)}s`;
                    }
                  }

                  return (
                    <td key={year} className="py-3 px-4 text-right align-top">
                      {time ? (
                        <>
                          <span
                            className="font-mono font-bold text-sm"
                            style={{ color: isOverallBest ? 'var(--accent)' : 'var(--ink)' }}
                          >
                            {time}
                          </span>
                          {isOverallBest && (
                            <span
                              className="ml-1 font-mono text-xs"
                              style={{ color: 'var(--accent)' }}
                            >PB</span>
                          )}
                          {improvStr && (
                            <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--aqua)' }}>
                              {improvStr}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
