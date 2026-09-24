import type { PersonalBest, Event, Course } from '../types';
import { timeToSeconds } from '../lib/utils';

interface ProgressionChartProps {
  pbs: PersonalBest[];
  event: Event;
  course: Course;
}

export default function ProgressionChart({ pbs, event, course }: ProgressionChartProps) {
  // Filter to relevant event/course, sort by date
  const data = pbs
    .filter(pb => pb.event === event && pb.course === course)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (data.length < 1) {
    return (
      <div className="h-40 flex items-center justify-center bg-neutral-50 border border-neutral-200">
        <span className="font-mono text-xs text-neutral-400">No progression data available for {event} {course}</span>
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="h-40 border border-neutral-200 bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono font-black text-3xl">{data[0].time}</div>
          <div className="font-mono text-xs text-neutral-400 mt-1">{new Date(data[0].date).getFullYear()}</div>
        </div>
      </div>
    );
  }

  const W = 600;
  const H = 180;
  const PAD = { top: 20, right: 30, bottom: 40, left: 60 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const times = data.map(d => timeToSeconds(d.time));
  const minTime = Math.min(...times) * 0.99;
  const maxTime = Math.max(...times) * 1.01;
  const dates = data.map(d => new Date(d.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);

  const xScale = (d: number) =>
    maxDate === minDate ? innerW / 2 : ((d - minDate) / (maxDate - minDate)) * innerW;
  const yScale = (t: number) =>
    ((t - minTime) / (maxTime - minTime)) * innerH;
  // Invert y: lower time = higher position
  const yPos = (t: number) => innerH - yScale(t);

  const points = data.map((d, i) => ({
    x: PAD.left + xScale(dates[i]),
    y: PAD.top + yPos(times[i]),
    time: d.time,
    year: new Date(d.date).getFullYear(),
  }));

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: '100%', minWidth: 280 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = PAD.top + innerH * t;
          const timeVal = minTime + (maxTime - minTime) * (1 - t);
          const mins = Math.floor(timeVal / 60);
          const secs = (timeVal % 60).toFixed(2).padStart(5, '0');
          const label = mins > 0 ? `${mins}:${secs}` : `${timeVal.toFixed(2)}`;
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#e5e5e5" strokeWidth={1} />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af" fontFamily="monospace">
                {label}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#c8f135"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots + labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} fill="#0a0a0a" />
            <circle cx={p.x} cy={p.y} r={3} fill="#c8f135" />
            <text
              x={p.x}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
              fontFamily="monospace"
            >
              {p.year}
            </text>
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fontSize={9}
              fill="#0a0a0a"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {p.time}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={PAD.left - 40} y={PAD.top + innerH / 2} textAnchor="middle" fontSize={9} fill="#6b7280" fontFamily="monospace"
          transform={`rotate(-90, ${PAD.left - 40}, ${PAD.top + innerH / 2})`}>
          TIME
        </text>
      </svg>
    </div>
  );
}
