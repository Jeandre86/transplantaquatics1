import { useState } from 'react';
import type { Record } from '../types';
import { formatDate } from '../lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface RecordCardProps {
  record: Record;
}

export default function RecordCard({ record }: RecordCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-neutral-200" style={{ backgroundColor: 'var(--navy-mid)' }}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-xs text-neutral-400 uppercase tracking-widest mb-1">
              {record.ageGroup} · {record.gender} · {record.course}
            </div>
            <div className="font-black text-lg tracking-tight text-white">{record.event}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono font-black text-2xl" style={{ color: 'var(--ink-on-dark)' }}>
              {record.time}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-white">{record.athleteName}</span>
          <span className="text-neutral-400">{record.country}</span>
          <span className="font-mono text-xs text-neutral-400">{formatDate(record.date)}</span>
        </div>
        <div className="mt-1 text-xs text-neutral-400 truncate">{record.meet}</div>
      </div>
      {record.history && record.history.length > 0 && (
        <>
          <div
            className="border-t border-neutral-200 px-5 py-2 flex items-center justify-between cursor-pointer hover:bg-neutral-50"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="font-mono text-xs text-neutral-400 uppercase tracking-wide">
              Record History ({record.history.length})
            </span>
            {expanded ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
          </div>
          {expanded && (
            <div className="border-t border-neutral-200">
              {record.history.map((h, i) => (
                <div key={i} className="px-5 py-3 border-b border-neutral-200 last:border-b-0 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">{h.athleteName}</span>
                    <span className="ml-3 text-xs text-neutral-400">{h.country}</span>
                    <span className="ml-3 font-mono text-xs text-neutral-400">{formatDate(h.date)}</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-neutral-400">{h.time}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
