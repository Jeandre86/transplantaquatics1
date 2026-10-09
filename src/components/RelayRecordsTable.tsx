import type { Record as WorldRecord } from '../types';
import SortableTable from './SortableTable';

export function getRelayAgeCategory(record: WorldRecord) {
  const totalAgeCategory = record.event.match(/\b\d+\+\s*Years?\b/i)?.[0];
  if (totalAgeCategory) return totalAgeCategory.replace(/\s+/g, ' ');
  if (record.ageGroup && !/open relay/i.test(record.ageGroup)) return record.ageGroup;
  return record.category || 'Relay';
}

export default function RelayRecordsTable({ records }: { records: WorldRecord[] }) {
  return <div className="ta-table-shell ta-table-scroll">
    <SortableTable><table className="w-full border-collapse">
      <thead><tr className="ta-table-header">
        {['Event', 'Gender', 'Team / swimmers', 'Meet', 'Time'].map(label => <th key={label} className={`whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 ${label === 'Time' ? 'text-right' : ''}`}>{label}</th>)}
      </tr></thead>
      <tbody>{records.map(record => <tr key={record.id} className="ta-table-row">
        <td className="px-3 py-3.5 text-sm font-semibold text-[var(--ink)] sm:px-5">{record.event}<span className="mt-1 block text-xs font-normal text-[var(--muted)]">{record.category || getRelayAgeCategory(record)}</span></td>
        <td className="whitespace-nowrap px-3 py-3.5 text-sm text-[var(--muted)] sm:px-5">{record.gender || '—'}</td>
        <td className="min-w-64 px-3 py-3.5 text-sm font-semibold text-[var(--ink)] sm:px-5">{record.athleteName || 'Team not listed'}<span className="mt-1 block text-xs font-normal text-[var(--muted)]">{record.country || 'Country not listed'}</span></td>
        <td className="px-3 py-3.5 text-sm text-[var(--muted)] sm:px-5">{record.meet || '—'}</td>
        <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-base font-bold text-[var(--navy)] sm:px-5">{record.time}</td>
      </tr>)}</tbody>
    </table></SortableTable>
  </div>;
}
