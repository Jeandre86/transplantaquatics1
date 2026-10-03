import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { countries as countryReference } from '../data/countries';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { loadWorldRecords } from '../lib/worldRecords';
import type { Record as WorldRecord } from '../types';
import { getCountryIso2, getFlagEmoji } from '../lib/utils';
import { describeSupabaseError } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import { SkeletonTable } from '../components/Skeleton';

const PAGE_SIZE = 10;

export default function CountryPage() {
  const { code = '' } = useParams();
  const [page, setPage] = useState(1);
  const [swimmerRecordPage, setSwimmerRecordPage] = useState(1);
  const [donorRecordPage, setDonorRecordPage] = useState(1);
  const [swimmers, setSwimmers] = useState<PublicSwimmerProfile[]>([]);
  const [records, setRecords] = useState<WorldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recordLoadError, setRecordLoadError] = useState('');

  useEffect(() => {
    setPage(1);
    setSwimmerRecordPage(1);
    setDonorRecordPage(1);
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
    const requestedCode = getCountryIso2(code);
    const swimmerCode = getCountryIso2(swimmer.country_code ?? '');
    const byCode = requestedCode.length === 2 && swimmerCode === requestedCode;
    const byName = swimmer.country.toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase();
    return byCode || byName;
  }).sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)), [swimmers, code]);
  const sample = countrySwimmers[0];
  const requestedCode = getCountryIso2(code);
  const recordSample = records.find(record => (requestedCode.length === 2 && getCountryIso2(record.countryCode ?? '') === requestedCode)
    || record.country.toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase());
  const countryMeta = countryReference.find(country => country.code.toLowerCase() === requestedCode.toLowerCase())
    ?? countryReference.find(country => country.name.toLowerCase() === (sample?.country ?? recordSample?.country)?.toLowerCase());
  const countryName = countryMeta?.name ?? sample?.country ?? recordSample?.country ?? '';
  const countryFlag = getFlagEmoji(sample?.country_code ?? recordSample?.countryCode ?? countryMeta?.code ?? requestedCode);
  const countryRecords = records.filter(record => (requestedCode.length === 2 && getCountryIso2(record.countryCode ?? '') === requestedCode)
    || record.country.toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase());
  const swimmerRecords = countryRecords.filter(record => record.category?.trim().toLowerCase() !== 'donor');
  const donorRecords = countryRecords.filter(record => record.category?.trim().toLowerCase() === 'donor');
  const pageCount = Math.ceil(countrySwimmers.length / PAGE_SIZE);
  const pageSwimmers = countrySwimmers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const recordGroups = [
    { key: 'swimmers', title: 'Swimmer records', rows: swimmerRecords, page: swimmerRecordPage, setPage: setSwimmerRecordPage },
    { key: 'donors', title: 'Donor records', rows: donorRecords, page: donorRecordPage, setPage: setDonorRecordPage },
  ];

  return (
    <div>
      <section className="ta-page-top">
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
            {!loading && !recordLoadError && <span className="font-mono text-xs text-neutral-600">{swimmerRecords.length} swimmer · {donorRecords.length} donor</span>}
          </div>
          {loading ? <SkeletonTable rows={5} columns={5} /> : recordLoadError ? <EmptyState title="World record data is unavailable" subtitle={recordLoadError} /> : countryRecords.length ? <>
            {recordGroups.map(group => {
              const groupPageCount = Math.ceil(group.rows.length / PAGE_SIZE);
              const pageRows = group.rows.slice((group.page - 1) * PAGE_SIZE, group.page * PAGE_SIZE);
              return <section key={group.key} className="mb-10 last:mb-0">
                <div className="mb-3 flex items-end justify-between border-b border-[var(--border)] pb-3"><h3 className="text-lg font-bold text-[var(--ink)]">{group.title}</h3><span className="font-mono text-xs text-[var(--muted)]">{group.rows.length}</span></div>
                <div className="ta-table-shell">
                  <div className="ta-table-header grid grid-cols-[minmax(160px,1fr)_80px_95px_100px_minmax(130px,1fr)_90px] items-center gap-4 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-widest"><span>Event</span><span>Age</span><span>Gender</span><span>Record holder</span><span>Games</span><span className="text-right">Time</span></div>
                  <div>{pageRows.length ? pageRows.map(record => <div key={record.id} className="ta-table-row grid grid-cols-[minmax(160px,1fr)_80px_95px_100px_minmax(130px,1fr)_90px] items-center gap-4 px-5 py-4"><span className="min-w-0 truncate text-sm font-semibold text-[var(--ink)]">{record.event || '—'}</span><span className="text-xs text-[var(--muted)]">{record.ageGroup || '—'}</span><span className="text-xs text-[var(--muted)]">{record.gender || '—'}</span>{record.athleteId ? <Link to={`/athletes/${record.athleteId}`} className="truncate text-sm font-semibold text-[var(--ink)] hover:text-[var(--accent-dark)]">{record.athleteName || '—'}</Link> : <span className="truncate text-sm text-[var(--ink)]">{record.athleteName || '—'}</span>}<span className="truncate text-xs text-[var(--muted)]">{record.games || record.meet || '—'}</span><span className="text-right font-mono text-sm font-bold text-[var(--navy)]">{record.time || '—'}</span></div>) : <p className="px-4 py-6 text-sm text-[var(--muted)]">No {group.key === 'donors' ? 'donor' : 'swimmer'} records listed for {countryName || 'this country'}.</p>}</div>
                </div>
                {group.rows.length > 0 && <Pagination page={group.page} pageCount={groupPageCount} onPageChange={group.setPage} label={`${group.title} pages`} />}
              </section>;
            })}
          </> : <EmptyState title="No world records listed" subtitle={`There are no records attributed to ${countryName || 'this country'} in the current database.`} />}
        </div>
      </section>
    </div>
  );
}
