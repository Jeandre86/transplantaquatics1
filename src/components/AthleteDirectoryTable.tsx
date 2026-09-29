import type { Athlete } from '../types';
import AthleteDirectoryRow from './AthleteDirectoryRow';

export default function AthleteDirectoryTable({ athletes, showCountryColumn = false }: { athletes: Athlete[]; showCountryColumn?: boolean }) {
  const columns = showCountryColumn
    ? 'grid-cols-[76px_minmax(0,1fr)_28px] sm:grid-cols-[92px_minmax(140px,1.5fr)_90px_minmax(130px,1fr)_28px] md:grid-cols-[98px_minmax(160px,1.5fr)_100px_145px_minmax(140px,1fr)_28px] lg:grid-cols-[110px_minmax(200px,1.7fr)_110px_155px_minmax(160px,1fr)_28px]'
    : 'grid-cols-[minmax(0,1fr)_28px] sm:grid-cols-[minmax(180px,1.5fr)_90px_minmax(130px,1fr)_28px] md:grid-cols-[minmax(200px,1.5fr)_100px_130px_minmax(130px,1fr)_28px] lg:grid-cols-[minmax(220px,1.7fr)_110px_145px_minmax(160px,1fr)_28px]';
  return (
    <div className="ta-table-shell">
      <div className={`ta-table-header grid ${columns} items-center gap-3 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:gap-4 sm:px-5 sm:text-xs`}>
        {showCountryColumn && <span>Country</span>}
        <span>Athlete</span>
        <span className="hidden sm:block">Gender</span>
        <span className="hidden md:block">DOB</span>
        <span className="hidden sm:block">Transplant Type</span><span aria-hidden="true" />
      </div>
      <div>{athletes.map(athlete => <AthleteDirectoryRow key={athlete.id} athlete={athlete} showCountryColumn={showCountryColumn} />)}</div>
    </div>
  );
}
