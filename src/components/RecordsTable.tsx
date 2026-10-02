import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Record as WorldRecord } from '../types';
import { formatDate, getCountryAlpha3, getFlagEmoji } from '../lib/utils';
import { getSavedAvatar } from '../lib/avatars';

const COUNTRY_CODES: { [country: string]: string } = {
  Australia: 'AU', Brazil: 'BR', Canada: 'CA', Finland: 'FI', France: 'FR',
  'Great Britain & Northern Ireland': 'GB', 'Great Britain': 'GB', Germany: 'DE',
  Greece: 'GR', Hungary: 'HU', Ireland: 'IE', Israel: 'IL', Italy: 'IT', Japan: 'JP',
  Mexico: 'MX', Netherlands: 'NL', Portugal: 'PT', 'South Africa': 'ZA', Spain: 'ES',
  'United Kingdom': 'GB', 'Northern Ireland': 'GB', 'United States': 'US',
};
function Country({ name }: { name: string }) {
  const country = name?.trim() ?? '';
  if (!country) return null;
  const code = COUNTRY_CODES[country];
  return <span className="flex items-center gap-1.5" title={country}><span className="text-base leading-none" aria-hidden="true">{code ? getFlagEmoji(code) : '🏳️'}</span><span className="font-mono text-xs font-semibold tracking-wider text-[var(--muted)]">{code ? getCountryAlpha3(code) : country.slice(0, 3).toUpperCase()}</span></span>;
}

function AthleteAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts.pop()! : '';
  const firstName = parts.join(' ');
  const image = getSavedAvatar(firstName, lastName);
  const initials = `${firstName[0] ?? name[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase();

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ice)] font-mono text-[10px] font-bold text-[var(--navy)] sm:h-11 sm:w-11 sm:text-xs">
      {image ? <img src={image} alt={`${name} profile`} className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

function getStandingDuration(record: WorldRecord) {
  const year = Number(record.date?.slice(0, 4) ?? (record.games ?? record.meet).match(/\d{4}/)?.[0]);
  if (!Number.isFinite(year) || year < 1) return '';
  const years = Math.max(0, new Date().getFullYear() - year);
  if (years === 0) return '<1 year';
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

export default function RecordsTable({ records }: { records: WorldRecord[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="ta-table-shell">
      <div className="ta-table-header grid grid-cols-[minmax(190px,1.6fr)_minmax(140px,1.2fr)_75px_80px_minmax(160px,1fr)_95px_95px_28px] items-center gap-4 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-widest">
        <span>Record holder</span><span>Event</span><span>Age</span><span>Gender</span><span>Games</span><span className="text-right" title="Approximate duration based on the Games year; exact record dates are not provided by the source.">Standing</span><span className="text-right">Time</span><span aria-hidden="true" />
      </div>
      <div>
        {records.map(record => {
            const isExpanded = expanded.has(record.id);
            const hasHistory = Boolean(record.history?.length);
            return (
              <Fragment key={record.id}>
                <div className="ta-table-row group grid grid-cols-[minmax(190px,1.6fr)_minmax(140px,1.2fr)_75px_80px_minmax(160px,1fr)_95px_95px_28px] items-center gap-4 px-5 py-5">
                  <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <AthleteAvatar name={record.athleteName} />
                    <span className="min-w-0">
                      {record.athleteId
                        ? <Link to={`/athletes/${record.athleteId}`} className="block truncate text-base font-semibold text-[var(--ink)] hover:text-[var(--accent-dark)]">{record.athleteName}</Link>
                        : <span className="block truncate text-base font-semibold text-[var(--ink)]">{record.athleteName}</span>}
                      {(record.country || record.date) && <span className="mt-1 flex items-center gap-2 truncate text-xs text-[var(--muted)]"><Country name={record.country} /><span>{formatDate(record.date ?? '') === '—' ? '' : formatDate(record.date ?? '')}</span></span>}
                      {formatDate(record.date ?? '') !== '—' && <span className="mt-1 hidden truncate text-xs text-[var(--muted)] md:block">{formatDate(record.date ?? '')}</span>}
                    </span>
                  </span>
                  <span className="truncate text-sm text-[var(--ink)]">{record.event}</span>
                  <span className="min-w-0 text-sm text-[var(--ink)]">{record.ageGroup}</span>
                  <span className="text-sm text-[var(--ink)]">{record.gender}</span>
                  <span className="truncate text-xs text-[var(--muted)]">{record.games || record.meet}</span>
                  <span className="text-right text-sm text-[var(--muted)]" title="Approximate duration since the Games edition listed as the record date">{getStandingDuration(record)}</span>
                  <span className="text-right font-mono text-base font-bold text-[var(--navy)]">{record.time}</span>
                  <span className="flex justify-center">
                    {hasHistory && (
                      <button type="button" onClick={() => toggle(record.id)} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} record history for ${record.event}`} className="inline-flex items-center justify-center p-1 text-[var(--muted)] hover:text-[var(--accent-dark)]">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </span>
                </div>
                {isExpanded && hasHistory && (
                  <div className="bg-[var(--paper)] px-5 py-4 sm:pl-24">
                    <div className="space-y-2 border-l-2 border-[var(--accent)] pl-4">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Previous record holders</p>
                      {record.history!.map((item, index) => (
                        <div key={`${record.id}-history-${index}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="font-medium text-neutral-800">{item.athleteName}</span>
                          <span className="text-neutral-500"><Country name={item.country} /></span>
                          <span className="text-xs text-neutral-500">{formatDate(item.date)} · {item.meet}</span>
                          <span className="ml-auto font-mono text-sm font-semibold text-neutral-700">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
      </div>
    </div>
  );
}
