import { useState } from 'react';
import type { Result } from '../types';
import VerificationBadge from './VerificationBadge';
import { formatDate } from '../lib/utils';
import { athletes } from '../data/athletes';

interface ResultsTableProps {
  results: Result[];
  showAthlete?: boolean;
}

const TABS = ['All', 'PBs', 'SBs', 'LCM', 'SCM'] as const;
type Tab = typeof TABS[number];

export default function ResultsTable({ results, showAthlete = false }: ResultsTableProps) {
  const [tab, setTab] = useState<Tab>('All');

  const filtered = results.filter(r => {
    if (tab === 'PBs') return r.isPB;
    if (tab === 'SBs') return r.isSB;
    if (tab === 'LCM') return r.course === 'LCM';
    if (tab === 'SCM') return r.course === 'SCM';
    return true;
  });

  const getAthleteName = (id: string) => {
    const a = athletes.find(a => a.id === id);
    return a ? `${a.firstName} ${a.lastName}` : id;
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-neutral-200 mb-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-mono text-xs tracking-widest uppercase px-4 py-2.5 border-b-2 transition-colors ${
              tab === t
                ? 'border-neutral-400 text-white'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-200">
              {[
                ...(showAthlete ? ['Athlete'] : []),
                'Event', 'Course', 'Time', 'Date', 'Meet', 'Status', '',
              ].map(h => (
                <th
                  key={h}
                  className={`font-mono text-xs tracking-widest uppercase py-2 text-left text-neutral-400 ${h === 'Time' ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showAthlete ? 8 : 7} className="py-12 text-center font-mono text-sm text-neutral-400">
                  No results found.
                </td>
              </tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                  {showAthlete && (
                    <td className="py-3 pr-4 font-semibold text-sm text-white whitespace-nowrap">
                      {getAthleteName(r.athleteId)}
                    </td>
                  )}
                  <td className="py-3 pr-4 text-sm text-white">{r.event}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-neutral-400">{r.course}</td>
                  <td className="py-3 pr-4 text-right font-mono font-bold text-sm text-white">{r.time}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-neutral-400 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="py-3 pr-4 text-xs text-neutral-400 max-w-[180px] truncate">{r.meet}</td>
                  <td className="py-3 pr-4"><VerificationBadge status={r.verified} /></td>
                  <td className="py-3">
                    <div className="flex gap-1.5">
                      {r.isPB && (
                        <span
                          className="font-mono text-xs px-1.5 py-0.5 font-bold"
                          style={{ backgroundColor: 'var(--accent)', color: 'var(--black)' }}
                        >
                          PB
                        </span>
                      )}
                      {r.isSB && !r.isPB && (
                        <span className="font-mono text-xs px-1.5 py-0.5 border border-neutral-400 text-neutral-400">SB</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
