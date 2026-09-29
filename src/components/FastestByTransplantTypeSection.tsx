import { Link } from 'react-router-dom';
import { TRANSPLANT_TYPES } from '../types';
import { getFlagEmoji, getTransplantColor, timeToSeconds } from '../lib/utils';
import { useFastestByTransplantType } from '../hooks/useFastestByTransplantType';
import { SkeletonTable } from './Skeleton';

export default function FastestByTransplantTypeSection() {
  const { swims, loading, error } = useFastestByTransplantType();

  return (
    <section className="mb-12" aria-labelledby="fastest-by-transplant-type-heading">
      <div className="mb-5">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">Database leader swims</p>
        <h2 id="fastest-by-transplant-type-heading" className="mt-2 text-2xl font-black tracking-tight text-neutral-900">Fastest by Transplant Type</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">One fastest submitted swim for each transplant type, with its event and course shown for context.</p>
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : error ? (
        <div role="alert" className="border border-red-300 bg-red-50 px-5 py-6 text-sm text-red-800">Fastest swims could not be loaded: {error}</div>
      ) : (
        <div className="ta-table-shell overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr className="ta-table-header">
              {['Transplant type', 'Athlete', 'Event', 'Time', 'Course', 'Status'].map(label => <th key={label} className={`whitespace-nowrap px-3 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 ${label === 'Time' ? 'text-right' : ''}`}>{label}</th>)}
            </tr></thead>
            <tbody>{TRANSPLANT_TYPES.map(type => {
              const fastest = swims
                .filter(swim => swim.transplantType === type)
                .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time))[0];

              return <tr key={type} className="ta-table-row">
                <td className="whitespace-nowrap px-3 py-4 sm:px-5"><span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--ink)]"><span className="size-2.5 rounded-full" style={{ backgroundColor: getTransplantColor(type) }} />{type}</span></td>
                <td className="px-3 py-4 text-sm font-semibold text-[var(--ink)] sm:px-5">{fastest ? <><Link to={`/athletes/${fastest.athleteId}`} className="hover:text-[var(--accent-dark)] hover:underline">{fastest.athleteName || '—'}</Link><span className="mt-1 block text-xs font-normal text-[var(--muted)]">{fastest.countryCode ? `${getFlagEmoji(fastest.countryCode)} ` : ''}{fastest.country || '—'}</span></> : <span className="text-[var(--muted)]">—</span>}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--ink)] sm:px-5">{fastest ? `${fastest.event} · ${fastest.gender}` : '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-base font-bold text-[var(--navy)] sm:px-5">{fastest?.time ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{fastest?.course ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-4 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)] sm:px-5">{fastest ? (fastest.status === 'verified' ? 'Verified' : 'Pending verification') : 'No results'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
