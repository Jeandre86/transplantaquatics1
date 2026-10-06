import { useState } from 'react';
import type { Result } from '../types';
import VerificationBadge from './VerificationBadge';
import { formatDate, getCountryAlpha3, getFlagEmoji } from '../lib/utils';
import { athletes } from '../data/athletes';
import { getSavedAvatar } from '../lib/avatars';
import { Link, useNavigate } from 'react-router-dom';

interface ResultsTableProps {
  results: Result[];
  showAthlete?: boolean;
  dark?: boolean;
}

const TABS = ['All', 'PBs', 'SBs', 'LCM', 'SCM'] as const;
type Tab = typeof TABS[number];

export default function ResultsTable({ results, showAthlete = false, dark = false }: ResultsTableProps) {
  const navigate = useNavigate();
  const primaryText = dark ? 'text-white' : 'text-[var(--ink)]';
  const secondaryText = dark ? 'text-[var(--muted-on-dark)]' : 'text-[var(--muted)]';
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
              ? `border-[#00c2d7] ${primaryText}`
                : `border-transparent ${secondaryText} ${dark ? 'hover:text-white' : 'hover:text-neutral-900'}`
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={`ta-table-scroll ${dark ? 'border-0 bg-transparent' : 'ta-table-shell'}`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="ta-table-header">
              {[
                ...(showAthlete ? ['Athlete'] : []),
                'Event', 'Course', 'Time', 'Date', 'Meet', 'Status', '',
              ].map(h => (
                <th
                  key={h}
                  aria-label={h || 'Result badges'}
                  className={`whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 ${h === 'Time' ? 'text-right' : ''}`}
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
              filtered.map(r => {
                const athlete = athletes.find(a => a.id === r.athleteId);
                const fullName = athlete ? `${athlete.firstName} ${athlete.lastName}` : getAthleteName(r.athleteId);
                const photo = athlete ? getSavedAvatar(athlete.firstName, athlete.lastName) : null;
                const initials = athlete?.avatarInitials || fullName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
                return (
                <tr
                  key={r.id}
                  className={`cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-dark)] ${dark ? 'ta-table-row-dark' : 'ta-table-row'}`}
                  tabIndex={0}
                  aria-label={`Open ${fullName} athlete profile`}
                  onClick={event => {
                    if ((event.target as HTMLElement).closest('a, button')) return;
                    navigate(`/athletes/${r.athleteId}`);
                  }}
                  onKeyDown={event => {
                    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                      event.preventDefault();
                      navigate(`/athletes/${r.athleteId}`);
                    }
                  }}
                >
                  {showAthlete && (
                  <td className={`px-3 py-4 font-semibold text-base whitespace-nowrap sm:px-5 ${primaryText}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-mono text-[10px] font-bold ${dark ? 'bg-[var(--navy-light)] text-white' : 'bg-[var(--ice)] text-[var(--navy)]'}`}>
                        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials}
                      </span>
                      <span className="min-w-0">
                        <Link to={`/athletes/${r.athleteId}`} className={`block truncate hover:underline ${dark ? 'text-white hover:text-[var(--accent)]' : 'text-[var(--ink)] hover:text-[var(--accent-dark)]'}`}>{fullName}</Link>
                        {athlete && <span className={`mt-1 flex items-center gap-1.5 font-mono text-xs ${secondaryText}`} title={athlete.country}><span className="ta-table-flag">{getFlagEmoji(athlete.countryCode)}</span><span className="font-semibold tracking-wider">{getCountryAlpha3(athlete.countryCode)}</span></span>}
                      </span>
                    </div>
                    </td>
                  )}
                  <td className={`px-3 py-4 text-sm sm:px-5 ${primaryText}`}>{r.event || '—'}</td>
                  <td className={`px-3 py-4 font-mono text-xs sm:px-5 ${secondaryText}`}><span className={`inline-flex min-w-12 justify-center border px-2 py-1 ${dark ? 'border-white/15 bg-white/5' : 'border-[var(--accent)]/25 bg-[var(--ice)] text-[var(--navy)]'}`}>{r.course || '—'}</span></td>
                  <td className={`px-3 py-4 text-right font-mono font-bold text-base sm:px-5 ${dark ? primaryText : 'text-[var(--navy)]'}`}>{r.time || '—'}</td>
                  <td className={`px-3 py-4 font-mono text-xs whitespace-nowrap sm:px-5 ${secondaryText}`}>{formatDate(r.date)}</td>
                  <td className={`px-3 py-4 text-xs max-w-[180px] truncate sm:px-5 ${secondaryText}`}>{r.meet || '—'}</td>
                  <td className="px-3 py-4 sm:px-5"><VerificationBadge status={r.verified} dark={dark} /></td>
                  <td className="px-3 py-4 sm:px-5">
                    <div className="flex min-h-5 items-center gap-1.5">
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
                      {!r.isPB && !r.isSB && <span className={`font-mono text-xs ${secondaryText}`}>—</span>}
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
