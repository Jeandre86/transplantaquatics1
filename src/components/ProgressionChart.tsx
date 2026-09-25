import type { Result, Event, Course } from '../types';
import { timeToSeconds } from '../lib/utils';

interface ProgressionChartProps {
  results: Result[];
  event: Event;
  course: Course;
}

export default function ProgressionChart({ results, event, course }: ProgressionChartProps) {
  // Use every dated swim for this event so the chart shows a real season trend.
  const data = results
    .filter(result => result.event === event && result.course === course)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (data.length < 1) {
    return (
      <div className="h-48 flex items-center justify-center bg-white border border-neutral-200">
        <span className="font-mono text-xs text-neutral-400">No progression data available for {event} {course}</span>
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="h-48 border border-neutral-200 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono font-black text-3xl">{data[0].time}</div>
          <div className="font-mono text-xs text-neutral-400 mt-1">{new Date(data[0].date).getFullYear()}</div>
        </div>
      </div>
    );
  }

  const W = 600;
  const H = 240;
  const PAD = { top: 20, right: 30, bottom: 40, left: 60 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const times = data.map(d => timeToSeconds(d.time));
  const spread = Math.max(...times) - Math.min(...times);
  const padding = Math.max(spread * 0.2, 0.5);
  const minTime = Math.min(...times) - padding;
  const maxTime = Math.max(...times) + padding;
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
    <div className="w-full overflow-x-auto border border-neutral-200 bg-white p-3 sm:p-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label={`${event} ${course} swim times over time`}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = PAD.top + innerH * t;
          const timeVal = minTime + (maxTime - minTime) * (1 - t);
          const mins = Math.floor(timeVal / 60);
          const secs = (timeVal % 60).toFixed(2).padStart(5, '0');
          const label = mins > 0 ? `${mins}:${secs}` : `${timeVal.toFixed(2)}`;
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#d6dbe1" strokeWidth={1} />
              <text x={PAD.left - 7} y={y + 4} textAnchor="end" fontSize={10} fill="#475569" fontFamily="monospace">
                {label}
              </text>
            </g>
          );
        })}

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#1769c2"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots + labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={6} fill="#ffffff" stroke="#1769c2" strokeWidth={3} />
            <text
              x={p.x}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill="#475569"
              fontFamily="monospace"
            >
              {p.year}
            </text>
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fontSize={10}
              fill="#17324d"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {p.time}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={PAD.left - 42} y={PAD.top + innerH / 2} textAnchor="middle" fontSize={10} fill="#475569" fontFamily="monospace"
          transform={`rotate(-90, ${PAD.left - 40}, ${PAD.top + innerH / 2})`}>
          TIME
        </text>
      </svg>
    </div>
  );
}
