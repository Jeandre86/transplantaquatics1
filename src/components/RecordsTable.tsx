import type { Record as WorldRecord } from '../types';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getFlagEmoji, timeToSeconds } from '../lib/utils';

function sexColumn(gender: string): 'women' | 'men' | null {
  const value = gender.trim().toLowerCase();
  if (value === 'women' || value === 'woman' || value === 'girls') return 'women';
  if (value === 'men' || value === 'man' || value === 'boys') return 'men';
  return null;
}

function standing(record: WorldRecord) {
  const year = Number(record.date?.slice(0, 4) ?? (record.games ?? record.meet).match(/\d{4}/)?.[0]);
  if (!Number.isFinite(year) || year < 1) return '';
  const years = Math.max(0, new Date().getFullYear() - year);
  return years === 0 ? 'Held for under 1 year' : `Held for ${years} ${years === 1 ? 'year' : 'years'}`;
}

function RecordCell({ record }: { record?: WorldRecord }) {
  if (!record) return <span className="text-sm text-[var(--muted)]">No record yet. <Link to="/submit" className="font-medium text-[var(--accent-dark)] hover:underline">Set the first one</Link></span>;
  const location = record.games || record.meet;
  return <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--ink)]">
        {record.countryCode && <span className="shrink-0 text-base" aria-hidden="true">{getFlagEmoji(record.countryCode)}</span>}
        {record.athleteId ? <Link to={`/athletes/${record.athleteId}`} className="truncate hover:text-[var(--accent-dark)] hover:underline">{record.athleteName}</Link> : <span className="truncate">{record.athleteName}</span>}
      </div>
      <p className="mt-1 truncate text-xs text-[var(--muted)]">{location}{standing(record) ? ` · ${standing(record)}` : ''}</p>
    </div>
    <span className="shrink-0 font-mono text-xl font-bold tracking-wider text-[var(--navy)]">{record.time}</span>
  </div>;
}

export default function RecordsTable({ records }: { records: WorldRecord[] }) {
  const [sort, setSort] = useState<{ key: 'age' | 'women' | 'men'; direction: 'asc' | 'desc' }>({ key: 'age', direction: 'asc' });
  const rows = new Map<string, { women?: WorldRecord; men?: WorldRecord }>();
  for (const record of records) {
    const gender = sexColumn(record.gender);
    if (!gender) continue;
    const row = rows.get(record.ageGroup) ?? {};
    if (!row[gender]) row[gender] = record;
    rows.set(record.ageGroup, row);
  }
  const changeSort = (key: typeof sort.key) => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const ageGroups = [...rows.keys()].sort((a, b) => {
    const rowA = rows.get(a)!;
    const rowB = rows.get(b)!;
    const order = sort.key === 'age'
      ? a.localeCompare(b, undefined, { numeric: true })
      : timeToSeconds(rowA[sort.key]?.time ?? '') - timeToSeconds(rowB[sort.key]?.time ?? '');
    return sort.direction === 'asc' ? order : -order;
  });

  return <div className="ta-table-shell overflow-hidden">
    <div className="grid grid-cols-[minmax(90px,0.2fr)_1fr_1fr] bg-[var(--navy)] text-white">
      {([['age', 'Age'], ['women', 'Women'], ['men', 'Men']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => changeSort(key)} aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={`flex items-center gap-1 px-4 py-3 text-left text-sm sm:px-5 ${key !== 'age' ? 'border-l border-white/15 font-semibold' : 'text-white/75'}`}>{label}<span aria-hidden="true" className="text-[var(--accent)]">{sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button>)}
    </div>
    {ageGroups.map(ageGroup => {
      const row = rows.get(ageGroup)!;
      return <div key={ageGroup} className="grid min-h-[72px] grid-cols-[minmax(90px,0.2fr)_1fr_1fr] border-t border-[var(--border)] bg-white">
        <div className="flex items-center px-4 py-4 text-sm font-semibold text-[var(--ink)] sm:px-5">{ageGroup.replace(/\s+years?$/i, '')}</div>
        <div className="flex min-w-0 items-center border-l border-[var(--border)] px-4 py-4 sm:px-5"><RecordCell record={row.women} /></div>
        <div className="flex min-w-0 items-center border-l border-[var(--border)] px-4 py-4 sm:px-5"><RecordCell record={row.men} /></div>
      </div>;
    })}
    <p className="border-t border-[var(--border)] bg-[var(--paper)] px-4 py-4 text-sm text-[var(--muted)] sm:px-5">Girls and boys are listed with women and men for ages under 18.</p>
  </div>;
}
