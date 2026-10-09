import type { Athlete } from '../types';
import AthleteDirectoryRow from './AthleteDirectoryRow';
import { useState } from 'react';

export default function AthleteDirectoryTable({ athletes, showCountryColumn = false }: { athletes: Athlete[]; showCountryColumn?: boolean }) {
  const [sort, setSort] = useState<{ key: 'country' | 'name' | 'gender' | 'birth' | 'transplant'; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const columns = showCountryColumn
    ? 'grid-cols-[100px_minmax(180px,1.5fr)_100px_145px_minmax(140px,1fr)_28px]'
    : 'grid-cols-[minmax(220px,1.5fr)_110px_145px_minmax(160px,1fr)_28px]';
  const sortedAthletes = [...athletes].sort((a, b) => {
    const value = (athlete: Athlete) => ({
      country: athlete.country,
      name: `${athlete.lastName} ${athlete.firstName}`,
      gender: athlete.gender,
      birth: athlete.dateOfBirth,
      transplant: athlete.transplantType,
    })[sort.key] ?? '';
    const result = value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: 'base' });
    return sort.direction === 'asc' ? result : -result;
  });
  const headers = [...(showCountryColumn ? [['country', 'Country'] as const] : []), ['name', 'Athlete'] as const, ['gender', 'Gender'] as const, ['birth', 'DOB'] as const, ['transplant', 'Transplant Type'] as const];
  return (
    <div className="ta-table-shell">
      <div className={`ta-table-header grid ${columns} items-center gap-3 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:gap-4 sm:px-5 sm:text-xs`}>
        {headers.map(([key, label]) => <button key={key} type="button" onClick={() => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))} className="flex items-center gap-1 text-left">{label}<span aria-hidden="true" className="text-[var(--accent)]">{sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button>)}
        <span aria-hidden="true" />
      </div>
      <div>{sortedAthletes.map(athlete => <AthleteDirectoryRow key={athlete.id} athlete={athlete} showCountryColumn={showCountryColumn} />)}</div>
    </div>
  );
}
