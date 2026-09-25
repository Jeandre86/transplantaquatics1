import { Fragment, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Record as WorldRecord } from '../types';
import { formatDate, getFlagEmoji } from '../lib/utils';
import { getSavedAvatar } from '../lib/avatars';

const COUNTRY_CODES: { [country: string]: string } = {
  Australia: 'AU', Brazil: 'BR', Canada: 'CA', Finland: 'FI', France: 'FR',
  'Great Britain & Northern Ireland': 'GB', 'Great Britain': 'GB', Germany: 'DE',
  Greece: 'GR', Hungary: 'HU', Ireland: 'IE', Israel: 'IL', Italy: 'IT', Japan: 'JP',
  Mexico: 'MX', Netherlands: 'NL', Portugal: 'PT', 'South Africa': 'ZA', Spain: 'ES',
  'United Kingdom': 'GB', 'Northern Ireland': 'GB', 'United States': 'US',
};
const COUNTRY_ALPHA3: { [code: string]: string } = {
  AU: 'AUS', BR: 'BRA', CA: 'CAN', FI: 'FIN', FR: 'FRA', GB: 'GBR', DE: 'GER',
  GR: 'GRE', HU: 'HUN', IE: 'IRL', IL: 'ISR', IT: 'ITA', JP: 'JPN', MX: 'MEX',
  NL: 'NED', PT: 'POR', ZA: 'RSA', ES: 'ESP', US: 'USA',
};

function Country({ name }: { name: string }) {
  const code = COUNTRY_CODES[name];
  return <span className="flex items-center gap-1.5" title={name}><span className="text-2xl leading-none" aria-hidden="true">{code ? getFlagEmoji(code) : '🏳️'}</span><span className="font-mono text-[10px] font-semibold tracking-wider text-neutral-600 sm:text-xs">{code ? COUNTRY_ALPHA3[code] : name.slice(0, 3).toUpperCase()}</span></span>;
}

function AthleteAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts.pop()! : '';
  const firstName = parts.join(' ');
  const image = getSavedAvatar(firstName, lastName);
  const initials = `${firstName[0] ?? name[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase();

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef0f2] font-mono text-[10px] font-bold text-[#334155] sm:h-11 sm:w-11 sm:text-xs">
      {image ? <img src={image} alt={`${name} profile`} className="h-full w-full object-cover" /> : initials}
    </span>
  );
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
    <div className="overflow-hidden border border-neutral-200 bg-white">
      <div className="grid grid-cols-[minmax(0,1fr)_28px] items-center gap-3 border-b border-neutral-200 bg-[#f4f5f6] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-neutral-600 sm:grid-cols-[minmax(170px,1.6fr)_minmax(100px,1.1fr)_65px_70px_minmax(115px,1fr)_85px_28px] sm:gap-4 sm:px-5 sm:text-xs md:grid-cols-[minmax(190px,1.6fr)_minmax(120px,1.1fr)_75px_80px_minmax(140px,1fr)_95px_28px]">
        <span>Record holder</span><span className="hidden sm:block">Event</span><span className="hidden sm:block">Age</span><span className="hidden sm:block">Gender</span><span className="hidden sm:block">Games</span><span className="hidden sm:block text-right">Time</span><span aria-hidden="true" />
      </div>
      <div>
        {records.map((record, index) => {
            const isExpanded = expanded.has(record.id);
            const hasHistory = Boolean(record.history?.length);
            return (
              <Fragment key={record.id}>
                <div className={`group grid grid-cols-[minmax(0,1fr)_28px] items-center gap-3 border-b border-neutral-200 px-3 py-4 transition-colors hover:bg-neutral-50 sm:grid-cols-[minmax(170px,1.6fr)_minmax(100px,1.1fr)_65px_70px_minmax(115px,1fr)_85px_28px] sm:gap-4 sm:px-5 md:grid-cols-[minmax(190px,1.6fr)_minmax(120px,1.1fr)_75px_80px_minmax(140px,1fr)_95px_28px] ${index % 2 === 1 ? 'bg-[#f7f8fa]' : 'bg-white'}`}>
                  <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <AthleteAvatar name={record.athleteName} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#303846] sm:text-base">{record.athleteName}</span>
                      <span className="mt-1 flex items-center gap-2 truncate text-xs text-neutral-500"><Country name={record.country} />{record.date && <span>{formatDate(record.date)}</span>}</span>
                      <span className="mt-1 hidden truncate text-xs text-neutral-400 md:block">{record.date ? formatDate(record.date) : ''}</span>
                      <span className="mt-1 block truncate font-mono text-[10px] text-neutral-600 sm:hidden">{record.event} · {record.ageGroup} {record.gender} · {record.games ?? record.meet} · {record.time}</span>
                    </span>
                  </span>
                  <span className="hidden truncate text-sm text-[#4b5563] sm:block">{record.event}</span>
                  <span className="hidden min-w-0 text-sm text-[#4b5563] sm:block">{record.ageGroup}{record.category && record.category.toLowerCase() !== 'adult' && <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-wide text-[#1769c2]">{record.category}</span>}</span>
                  <span className="hidden text-sm text-[#4b5563] sm:block">{record.gender}</span>
                  <span className="hidden truncate text-xs text-[#4b5563] sm:block">{record.games ?? record.meet}</span>
                  <span className="hidden text-right font-mono text-base font-bold text-[#1769c2] sm:block">{record.time}</span>
                  <span className="flex justify-end sm:justify-center">
                    {hasHistory && (
                      <button type="button" onClick={() => toggle(record.id)} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} record history for ${record.event}`} className="inline-flex items-center justify-center p-1 text-neutral-400 hover:text-[#1769c2]">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </span>
                </div>
                {isExpanded && hasHistory && (
                  <div className="border-b border-neutral-200 bg-[#f7f8fa] px-5 py-4 sm:pl-24">
                    <div className="space-y-2 border-l-2 border-[#1769c2]/30 pl-4">
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
