import { useState } from 'react';
import type { Result } from '../types';
import VerificationBadge from './VerificationBadge';
import { formatDate, getFlagEmoji } from '../lib/utils';
import { athletes } from '../data/athletes';
import { getSavedAvatar } from '../lib/avatars';
import { Link } from 'react-router-dom';

interface ResultsTableProps {
  results: Result[];
  showAthlete?: boolean;
  dark?: boolean;
}

const TABS = ['All', 'PBs', 'SBs', 'LCM', 'SCM'] as const;
type Tab = typeof TABS[number];

export default function ResultsTable({ results, showAthlete = false, dark = false }: ResultsTableProps) {
  const primaryText = dark ? 'text-white' : 'text-neutral-900';
  const secondaryText = dark ? 'text-neutral-400' : 'text-neutral-600';
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
                ? `border-neutral-400 ${primaryText}`
                : `border-transparent ${secondaryText} ${dark ? 'hover:text-white' : 'hover:text-neutral-900'}`
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={`overflow-x-auto border ${dark ? 'border-[var(--navy-light)] bg-[var(--navy-mid)]' : 'border-neutral-200 bg-white'}`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className={`border-b ${dark ? 'border-[var(--navy-light)] bg-[var(--navy)]' : 'border-neutral-200 bg-[#f4f5f6]'}`}>
              {[
                ...(showAthlete ? ['Athlete'] : []),
                'Event', 'Course', 'Time', 'Date', 'Meet', 'Status', '',
              ].map(h => (
                <th
                  key={h}
                  className={`font-mono text-[10px] font-semibold tracking-widest uppercase py-3 text-left ${dark ? 'text-white/60' : 'text-neutral-600'} ${h === 'Time' ? 'text-right pr-4' : ''} ${h === 'Date' ? 'pl-4' : ''}`}
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
              filtered.map((r, index) => {
                const athlete = athletes.find(a => a.id === r.athleteId);
                const fullName = athlete ? `${athlete.firstName} ${athlete.lastName}` : getAthleteName(r.athleteId);
                const photo = athlete ? getSavedAvatar(athlete.firstName, athlete.lastName) : null;
                const initials = athlete?.avatarInitials || fullName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
                const stripe = index % 2 === 1;
                return (
                <tr key={r.id} className={`border-b transition-colors ${dark ? 'border-[var(--navy-light)] hover:bg-white/5' : `border-neutral-200 hover:bg-neutral-50 ${stripe ? 'bg-[#f7f8fa]' : 'bg-white'}`}`}>
                  {showAthlete && (
                  <td className={`py-4 pl-4 pr-5 font-semibold text-sm whitespace-nowrap ${primaryText}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-mono text-[10px] font-bold ${dark ? 'bg-[var(--navy-light)] text-white' : 'bg-[#eef0f2] text-[#334155]'}`}>
                        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials}
                      </span>
                      <span className="min-w-0">
                        <Link to={`/athletes/${r.athleteId}`} className={`block truncate hover:underline ${dark ? 'text-white' : 'text-[#303846] hover:text-[#1769c2]'}`}>{fullName}</Link>
                        {athlete && <span className={`mt-0.5 block text-xs ${secondaryText}`}><span className="mr-1.5">{getFlagEmoji(athlete.countryCode)}</span>{athlete.country}</span>}
                      </span>
                    </div>
                    </td>
                  )}
                  <td className={`py-4 pr-5 text-sm ${primaryText}`}>{r.event}</td>
                  <td className={`py-4 pr-5 font-mono text-xs ${secondaryText}`}><span className={`inline-flex min-w-12 justify-center border px-2 py-1 ${dark ? 'border-white/15 bg-white/5' : 'border-[#147d91]/20 bg-[#147d91]/5 text-[#126b7b]'}`}>{r.course}</span></td>
                  <td className={`py-4 pr-5 text-right font-mono font-bold text-sm ${dark ? primaryText : 'text-[#1769c2]'}`}>{r.time}</td>
                  <td className={`py-4 pl-5 pr-5 font-mono text-xs whitespace-nowrap ${secondaryText}`}>{formatDate(r.date)}</td>
                  <td className={`py-4 pr-5 text-xs max-w-[180px] truncate ${secondaryText}`}>{r.meet}</td>
                  <td className="py-4 pr-5"><VerificationBadge status={r.verified} /></td>
                  <td className="py-4 pr-3">
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
              );})
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
