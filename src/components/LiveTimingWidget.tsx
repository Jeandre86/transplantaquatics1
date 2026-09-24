import { useState, useEffect, useRef } from 'react';

const ATHLETES = [
  { lane: 1, name: 'M. SCHMIDT', country: 'GER' },
  { lane: 2, name: 'J. TRAN',    country: 'AUS' },
  { lane: 3, name: 'A. OKAFOR',  country: 'NGR' },
  { lane: 4, name: 'P. SANTOS',  country: 'BRA' },
];

const RACE_DURATION_MS = 58000; // 58-second race
const SPLIT_AT_MS      = 29000; // 50m split
const TICK_MS          = 83;    // ~12 fps
const END_HOLD_MS      = 3000;  // show results for 3 s before reset

function padTime(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs      = totalCs % 100;
  const secs    = Math.floor(totalCs / 100) % 60;
  const mins    = Math.floor(totalCs / 6000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// Each athlete gets a slightly different pace so they don't tie
const LANE_OFFSETS_MS = [0, 420, 910, 1360]; // final time deltas

export default function LiveTimingWidget() {
  const [elapsed, setElapsed]   = useState(0);
  const [phase, setPhase]       = useState<'running' | 'finished'>('running');
  const [splits, setSplits]     = useState<(number | null)[]>([null, null, null, null]);
  const startRef   = useRef<number>(Date.now());
  const rafRef     = useRef<number>(0);
  const holdRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    startRef.current = Date.now();
    setElapsed(0);
    setPhase('running');
    setSplits([null, null, null, null]);
  }

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const e   = now - startRef.current;

      if (e >= RACE_DURATION_MS) {
        setElapsed(RACE_DURATION_MS);
        setPhase('finished');
        // capture splits for any lane that hadn't split yet
        setSplits(prev => prev.map((s, i) => s ?? Math.floor(SPLIT_AT_MS * 0.97 + i * 180)));
        holdRef.current = setTimeout(reset, END_HOLD_MS);
        return;
      }

      setElapsed(e);

      // capture 50m split
      if (e >= SPLIT_AT_MS) {
        setSplits(prev =>
          prev.map((s, i) => s !== null ? s : Math.floor(SPLIT_AT_MS * 0.97 + i * 180))
        );
      }

      rafRef.current = window.setTimeout(tick, TICK_MS);
    }

    rafRef.current = window.setTimeout(tick, TICK_MS);
    return () => {
      clearTimeout(rafRef.current);
      if (holdRef.current) clearTimeout(holdRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'running' ? 'run' : 'stop']);

  const isFinished = phase === 'finished';

  const finalTimes = ATHLETES.map((_, i) => RACE_DURATION_MS + LANE_OFFSETS_MS[i]);
  const winnerLane = isFinished ? 0 : -1; // lane index 0 wins (lowest offset)

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        backgroundColor: 'var(--navy-mid)',
        border: '1px solid var(--navy-light)',
        maxHeight: '320px',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--navy-light)', backgroundColor: 'var(--navy)' }}
      >
        <span className="mono text-xs uppercase tracking-widest" style={{ color: 'var(--aqua)' }}>
          EVENT 04: 100M FREE — LCM
        </span>

        {/* Status badge */}
        {isFinished ? (
          <span
            className="mono text-xs uppercase tracking-widest px-2 py-0.5 font-bold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--black)' }}
          >
            Finished
          </span>
        ) : (
          <span className="flex items-center gap-1.5 mono text-xs uppercase tracking-widest font-bold" style={{ color: '#ff3b30' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#ff3b30',
                display: 'inline-block',
                animation: 'livePulse 1s ease-in-out infinite',
              }}
            />
            Live
          </span>
        )}
      </div>

      {/* Clock */}
      <div className="px-4 pt-3 pb-1">
        <span
          className="display leading-none"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
            color: isFinished ? 'var(--accent)' : 'var(--ink-on-dark)',
          }}
        >
          {padTime(isFinished ? RACE_DURATION_MS : elapsed)}
        </span>
        <span className="ml-3 mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
          {isFinished ? 'FINAL' : elapsed < SPLIT_AT_MS ? '50M →' : 'HOME STRETCH'}
        </span>
      </div>

      {/* Lane rows */}
      <div className="px-4 pb-4 mt-2 flex flex-col gap-1.5">
        {ATHLETES.map((athlete, i) => {
          const isWinner = isFinished && i === winnerLane;
          const laneTime = isFinished
            ? finalTimes[i]
            : elapsed + Math.floor(i * (elapsed / RACE_DURATION_MS) * 200);

          return (
            <div
              key={athlete.lane}
              className="flex items-center gap-3 px-3 py-2"
              style={{
                backgroundColor: isWinner ? 'rgba(199,243,104,0.08)' : 'var(--navy)',
                border: `1px solid ${isWinner ? 'var(--accent)' : 'var(--navy-light)'}`,
                transition: 'border-color 0.3s',
              }}
            >
              {/* Lane number */}
              <span
                className="mono text-xs font-bold w-5 text-center shrink-0"
                style={{ color: 'var(--muted-on-dark)' }}
              >
                {athlete.lane}
              </span>

              {/* Progress bar */}
              <div
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--navy-light)' }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, ((isFinished ? RACE_DURATION_MS : elapsed) / (RACE_DURATION_MS + LANE_OFFSETS_MS[i])) * 100)}%`,
                    backgroundColor: isWinner ? 'var(--accent)' : 'var(--aqua)',
                    transition: 'width 0.1s linear',
                    borderRadius: 9999,
                  }}
                />
              </div>

              {/* Name */}
              <span
                className="display text-sm leading-none w-24 shrink-0"
                style={{ color: isWinner ? 'var(--accent)' : 'var(--ink-on-dark)' }}
              >
                {athlete.name}
              </span>

              {/* Split */}
              {splits[i] !== null && (
                <span className="mono text-xs shrink-0" style={{ color: 'var(--muted-on-dark)' }}>
                  {padTime(splits[i]!)}
                </span>
              )}

              {/* Time */}
              <span
                className="display text-base leading-none shrink-0 ml-auto"
                style={{
                  color: isWinner ? 'var(--accent)' : isFinished ? 'var(--ink-on-dark)' : 'var(--aqua)',
                  minWidth: '5.5rem',
                  textAlign: 'right',
                }}
              >
                {isFinished ? padTime(finalTimes[i]) : padTime(laneTime)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Inline keyframe for the live pulse — injected once */}
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
