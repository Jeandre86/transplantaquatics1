import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { countries as countryReference } from '../data/countries';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { loadWorldRecords } from '../lib/worldRecords';
import type { Record as WorldRecord } from '../types';
import { getFlagEmoji } from '../lib/utils';
import { describeSupabaseError } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import { SkeletonTable } from '../components/Skeleton';

const PAGE_SIZE = 10;

export default function CountryPage() {
  const { code = '' } = useParams();
  const [page, setPage] = useState(1);
  const [recordPage, setRecordPage] = useState(1);
  const [swimmers, setSwimmers] = useState<PublicSwimmerProfile[]>([]);
  const [records, setRecords] = useState<WorldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recordLoadError, setRecordLoadError] = useState('');

  useEffect(() => {
    setPage(1);
    setRecordPage(1);
    setLoading(true);
    setLoadError('');
    setRecordLoadError('');
    let active = true;
    Promise.allSettled([loadPublicSwimmerDirectory(), loadWorldRecords()]).then(([swimmerResult, recordResult]) => {
      if (!active) return;
      if (swimmerResult.status === 'fulfilled') setSwimmers(swimmerResult.value);
      else setLoadError(`The public swimmer directory could not be loaded. ${describeSupabaseError(swimmerResult.reason)}`);
      if (recordResult.status === 'fulfilled') setRecords(recordResult.value);
      else setRecordLoadError(`World records could not be loaded. ${describeSupabaseError(recordResult.reason)}`);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  const countrySwimmers = useMemo(() => swimmers.filter(swimmer => {
    const byCode = swimmer.country_code?.toLowerCase() === code.toLowerCase();
    const byName = swimmer.country.toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase();
    return byCode || byName;
  }).sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)), [swimmers, code]);
  const sample = countrySwimmers[0];
  const recordSample = records.find(record => record.countryCode?.toLowerCase() === code.toLowerCase()
    || record.country.toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase());
  const countryMeta = countryReference.find(country => country.code.toLowerCase() === code.toLowerCase())
    ?? countryReference.find(country => country.name.toLowerCase() === (sample?.country ?? recordSample?.country)?.toLowerCase());
  const countryName = countryMeta?.name ?? sample?.country ?? recordSample?.country ?? '';
  const countryFlag = getFlagEmoji(sample?.country_code ?? recordSample?.countryCode ?? countryMeta?.code ?? '');
  const countryRecords = records.filter(record => record.countryCode?.toLowerCase() === code.toLowerCase()
    || record.country.toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase());
  const pageCount = Math.ceil(countrySwimmers.length / PAGE_SIZE);
  const pageSwimmers = countrySwimmers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const recordPageCount = Math.ceil(countryRecords.length / PAGE_SIZE);
  const pageRecords = countryRecords.slice((recordPage - 1) * PAGE_SIZE, recordPage * PAGE_SIZE);

  return (
    <div>
      <section style={{ backgroundColor: 'var(--navy)' }}>
        <div className="max-w-7xl mx-auto px-4 py-14">
          <Link to="/countries" className="mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/65 hover:text-white"><ArrowLeft size={14} /> All countries</Link>
          <div className="flex items-center gap-4">
            <span className="text-5xl" aria-hidden="true">{countryFlag}</span>
            <div><Eyebrow color="accent" onDark>Country directory</Eyebrow><h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">{countryName || 'Country'}</h1></div>
          </div>
          <p className="mt-5 max-w-2xl text-sm text-white/70">{countrySwimmers.length} registered {countrySwimmers.length === 1 ? 'swimmer' : 'swimmers'} · {recordLoadError ? 'World record count unavailable' : `${countryRecords.length} World ${countryRecords.length === 1 ? 'record' : 'records'}`}</p>
        </div>
      </section>

      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6 flex items-end justify-between border-b border-[var(--border)] pb-5">
            <div><Eyebrow>Athlete directory</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Swimmers from {countryName || 'this country'}</h2></div>
            {!loading && !loadError && <span className="font-mono text-xs text-neutral-600">{countrySwimmers.length} {countrySwimmers.length === 1 ? 'swimmer' : 'swimmers'}</span>}
          </div>

          {loading ? <SkeletonTable rows={5} columns={3} /> : loadError ? <EmptyState title="Country data is unavailable" subtitle={loadError} /> : countrySwimmers.length ? (
            <div className="ta-table-shell">
              <div className="ta-table-header grid grid-cols-[minmax(0,1fr)_100px_minmax(120px,auto)] items-center gap-4 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 sm:text-xs"><span>Athlete</span><span>Gender</span><span>Transplant type</span></div>
              <div>{pageSwimmers.map(swimmer => <Link key={swimmer.id} to={`/athletes/${swimmer.id}`} className="ta-table-row group grid grid-cols-[minmax(0,1fr)_100px_minmax(120px,auto)] items-center gap-4 px-3 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent-dark)] sm:px-5"><span className="min-w-0 truncate text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">{[swimmer.first_name, swimmer.last_name].filter(Boolean).join(' ') || '—'}</span><span className="text-sm text-[var(--muted)]">{swimmer.gender || '—'}</span><span className="text-sm text-[var(--muted)]">{swimmer.transplant_type || '—'}</span></Link>)}</div>
            </div>
          ) : <EmptyState title="No public swimmer profiles yet" subtitle={`Public swimmer profiles from ${countryName || 'this country'} will appear here when athletes join.`} />}
          {!loading && !loadError && countrySwimmers.length > 0 && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Country swimmer pages" />}
        </div>
      </section>

      <section style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6 flex items-end justify-between border-b border-[var(--border)] pb-5">
            <div><Eyebrow>World records</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Records held for {countryName || 'this country'}</h2></div>
            {!loading && !recordLoadError && <span className="font-mono text-xs text-neutral-600">{countryRecords.length} {countryRecords.length === 1 ? 'record' : 'records'}</span>}
          </div>
          {loading ? <SkeletonTable rows={5} columns={5} /> : recordLoadError ? <EmptyState title="World record data is unavailable" subtitle={recordLoadError} /> : countryRecords.length ? <>
            <div className="ta-table-shell">
              <div className="ta-table-header grid grid-cols-[minmax(0,1fr)_65px_minmax(0,1fr)] items-center gap-3 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_minmax(120px,auto)_90px] sm:px-5 sm:text-xs"><span>Event</span><span>Age</span><span>Record holder</span><span className="hidden sm:block">Games</span><span className="hidden text-right sm:block">Time</span></div>
              <div>{pageRecords.map(record => <div key={record.id} className="ta-table-row grid grid-cols-[minmax(0,1fr)_65px_minmax(0,1fr)] items-center gap-3 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_minmax(120px,auto)_90px] sm:px-5"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--ink)]">{record.event || '—'}</span><span className="font-mono text-[10px] text-[var(--muted)] sm:hidden">{record.gender || '—'} · {record.time || '—'}</span></span><span className="text-xs text-[var(--muted)]">{record.ageGroup || '—'}</span>{record.athleteId ? <Link to={`/athletes/${record.athleteId}`} className="truncate text-sm font-semibold text-[var(--ink)] hover:text-[var(--accent-dark)]">{record.athleteName || '—'}</Link> : <span className="truncate text-sm text-[var(--ink)]">{record.athleteName || '—'}</span>}<span className="hidden truncate text-xs text-[var(--muted)] sm:block">{record.games || record.meet || '—'}</span><span className="hidden text-right font-mono text-sm font-bold text-[var(--navy)] sm:block">{record.time || '—'}</span></div>)}</div>
            </div>
            <Pagination page={recordPage} pageCount={recordPageCount} onPageChange={setRecordPage} label="Country record pages" />
          </> : <EmptyState title="No world records listed" subtitle={`There are no records attributed to ${countryName || 'this country'} in the current database.`} />}
        </div>
      </section>
    </div>
  );
}
