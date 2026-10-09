import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { TRANSPLANT_TYPES } from '../types';
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

function normalizeGender(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'men' || normalized === 'male' || normalized === 'man' || normalized === 'boys' || normalized === 'm') return 'Men';
  if (normalized === 'women' || normalized === 'woman' || normalized === 'female' || normalized === 'girls' || normalized === 'f') return 'Women';
  return '—';
}

function normalizeTransplant(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/\s+transplant$/, '');
  if (normalized === 'kidney') return 'Kidney';
  if (normalized === 'liver') return 'Liver';
  if (normalized === 'heart') return 'Heart';
  if (normalized === 'lung') return 'Lung';
  if (normalized === 'pancreas') return 'Pancreas';
  if (normalized === 'bone marrow' || normalized === 'marrow') return 'Bone Marrow';
  if (normalized === 'donor' || normalized === 'living donor') return 'Donor';
  return value || 'Not shared';
}

export default function CountryPage() {
  const { code = '' } = useParams();
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('All');
  const [transplant, setTransplant] = useState('All');
  const [recordSearch, setRecordSearch] = useState('');
  const [recordGender, setRecordGender] = useState('All');
  const [recordTransplant, setRecordTransplant] = useState('All');
  const [recordAge, setRecordAge] = useState('All');
  const [recordEvent, setRecordEvent] = useState('All');
  const [donorSearch, setDonorSearch] = useState('');
  const [donorGender, setDonorGender] = useState('All');
  const [donorAge, setDonorAge] = useState('All');
  const [donorEvent, setDonorEvent] = useState('All');
  const [page, setPage] = useState(1);
  const [swimmerRecordPage, setSwimmerRecordPage] = useState(1);
  const [donorRecordPage, setDonorRecordPage] = useState(1);
  const [swimmers, setSwimmers] = useState<PublicSwimmerProfile[]>([]);
  const [records, setRecords] = useState<WorldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recordLoadError, setRecordLoadError] = useState('');

  useEffect(() => {
    setGender('All');
    setSearch('');
    setTransplant('All');
    setRecordSearch('');
    setRecordGender('All');
    setRecordTransplant('All');
    setRecordAge('All');
    setRecordEvent('All');
    setDonorSearch('');
    setDonorGender('All');
    setDonorAge('All');
    setDonorEvent('All');
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
    const byName = (swimmer.country ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase();
    return byCode || byName;
  }).sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)), [swimmers, code]);
  const visibleSwimmers = useMemo(() => gender === 'All'
    ? countrySwimmers
    : countrySwimmers.filter(swimmer => normalizeGender(swimmer.gender) === gender), [countrySwimmers, gender]);
  const filteredSwimmers = useMemo(() => visibleSwimmers.filter(swimmer => {
    const query = search.trim().toLowerCase();
    const swimmerName = `${swimmer.first_name} ${swimmer.last_name}`.toLowerCase();
    const searchable = `${swimmerName} ${swimmer.club_name ?? ''}`.toLowerCase();
    return (!query || searchable.includes(query))
      && (transplant === 'All' || normalizeTransplant(swimmer.transplant_type) === transplant);
  }), [visibleSwimmers, search, transplant]);
  const sample = countrySwimmers[0];
  const requestedCode = getCountryIso2(code);
  const recordSample = records.find(record => (requestedCode.length === 2 && getCountryIso2(record.countryCode ?? '') === requestedCode)
    || (record.country ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase());
  const countryMeta = countryReference.find(country => country.code.toLowerCase() === requestedCode.toLowerCase())
    ?? countryReference.find(country => country.name.toLowerCase() === (sample?.country ?? recordSample?.country)?.toLowerCase());
  const countryName = countryMeta?.name ?? sample?.country ?? recordSample?.country ?? '';
  const countryFlag = getFlagEmoji(sample?.country_code ?? recordSample?.countryCode ?? countryMeta?.code ?? requestedCode);
  const countryRecords = records.filter(record => (requestedCode.length === 2 && getCountryIso2(record.countryCode ?? '') === requestedCode)
    || (record.country ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === code.toLowerCase());
  const swimmerRecords = countryRecords.filter(record => record.category?.trim().toLowerCase() !== 'donor');
  const donorRecords = countryRecords.filter(record => record.category?.trim().toLowerCase() === 'donor');
  const transplantByAthleteId = new Map(countrySwimmers.map(swimmer => [swimmer.id, normalizeTransplant(swimmer.transplant_type)]));
  const filterSwimmerRecords = (rows: WorldRecord[]) => rows.filter(record => {
    const query = recordSearch.trim().toLowerCase();
    const searchable = `${record.athleteName} ${record.event} ${record.meet} ${record.games ?? ''} ${record.country}`.toLowerCase();
    const recordType = record.athleteId ? transplantByAthleteId.get(record.athleteId) : undefined;
    return (!query || searchable.includes(query))
      && (recordGender === 'All' || normalizeGender(record.gender) === recordGender)
      && (recordAge === 'All' || record.ageGroup === recordAge)
      && (recordEvent === 'All' || record.event === recordEvent)
      && (recordTransplant === 'All' || recordType === recordTransplant);
  });
  const filteredSwimmerRecords = filterSwimmerRecords(swimmerRecords);
  const filteredDonorRecords = donorRecords.filter(record => {
    const query = donorSearch.trim().toLowerCase();
    const searchable = `${record.athleteName} ${record.event} ${record.meet} ${record.games ?? ''} ${record.country}`.toLowerCase();
    return (!query || searchable.includes(query))
      && (donorGender === 'All' || normalizeGender(record.gender) === donorGender)
      && (donorAge === 'All' || record.ageGroup === donorAge)
      && (donorEvent === 'All' || record.event === donorEvent);
  });
  const recordAgeOptions = [...new Set(countryRecords.map(record => record.ageGroup).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const recordEventOptions = [...new Set(countryRecords.map(record => record.event).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const donorAgeOptions = [...new Set(donorRecords.map(record => record.ageGroup).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const donorEventOptions = [...new Set(donorRecords.map(record => record.event).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const pageCount = Math.ceil(filteredSwimmers.length / PAGE_SIZE);
  const pageSwimmers = filteredSwimmers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const recordGroups = [
    { key: 'swimmers', title: 'Swimmer records', rows: filteredSwimmerRecords, page: swimmerRecordPage, setPage: setSwimmerRecordPage },
    { key: 'donors', title: 'Donor records', rows: filteredDonorRecords, page: donorRecordPage, setPage: setDonorRecordPage },
  ];

  return (
    <div>
      <section className="ta-page-top">
        <div className="max-w-7xl mx-auto px-4 py-14">
          <Link to="/countries" className="mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/65 hover:text-white"><ArrowLeft size={14} /> All countries</Link>
          <Eyebrow color="accent" onDark>Country directory</Eyebrow>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-5xl leading-none" aria-hidden="true">{countryFlag}</span>
            <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">{countryName || 'Country'}</h1>
          </div>
          <p className="mt-5 max-w-2xl text-sm text-white/70">{countrySwimmers.length} registered {countrySwimmers.length === 1 ? 'swimmer' : 'swimmers'} · {recordLoadError ? 'World record count unavailable' : `${countryRecords.length} World ${countryRecords.length === 1 ? 'record' : 'records'}`}</p>
        </div>
      </section>

      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6 flex items-end justify-between border-b border-[var(--border)] pb-5">
            <div><Eyebrow>Athlete directory</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Swimmers from {countryName || 'this country'}</h2></div>
            {!loading && !loadError && <span className="font-mono text-xs text-neutral-600">{filteredSwimmers.length} {filteredSwimmers.length === 1 ? 'swimmer' : 'swimmers'}</span>}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
                <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search swimmers" aria-label="Search swimmers" className="h-[42px] w-full border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-dark)]" />
              </div>
              <label className="flex h-[42px] items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">
                <span className="shrink-0">Transplant:</span>
                <select value={transplant} onChange={event => { setTransplant(event.target.value); setPage(1); }} className="min-w-0 appearance-none bg-transparent pr-5 text-sm font-medium text-[var(--ink)] outline-none">
                  {['All', ...TRANSPLANT_TYPES.filter(type => type !== 'Donor')].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="inline-flex shrink-0 border border-[var(--border)] bg-white p-1" role="group" aria-label="Filter country swimmers by gender">
              {['All', 'Men', 'Women'].map(option => <button
                key={option}
                type="button"
                aria-pressed={gender === option}
                onClick={() => { setGender(option); setPage(1); }}
                className={`min-h-9 px-4 text-sm transition-colors ${gender === option ? 'bg-[var(--navy)] font-semibold text-white' : 'text-[var(--ink)] hover:bg-[var(--ice)]'}`}
              >{option}</button>)}
            </div>
          </div>

          {loading ? <SkeletonTable rows={5} columns={3} /> : loadError ? <EmptyState title="Country data is unavailable" subtitle={loadError} /> : filteredSwimmers.length ? (
            <div className="ta-table-shell">
              <div className="ta-table-header grid grid-cols-[minmax(0,1fr)_100px_minmax(120px,auto)] items-center gap-4 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 sm:text-xs"><span>Athlete</span><span>Gender</span><span>Transplant type</span></div>
              <div>{pageSwimmers.map(swimmer => <Link key={swimmer.id} to={`/athletes/${swimmer.id}`} className="ta-table-row group grid grid-cols-[minmax(0,1fr)_100px_minmax(120px,auto)] items-center gap-4 px-3 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent-dark)] sm:px-5"><span className="min-w-0 truncate text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">{[swimmer.first_name, swimmer.last_name].filter(Boolean).join(' ') || '—'}</span><span className="text-sm text-[var(--muted)]">{swimmer.gender || '—'}</span><span className="text-sm text-[var(--muted)]">{swimmer.transplant_type || '—'}</span></Link>)}</div>
            </div>
          ) : <EmptyState title={countrySwimmers.length ? 'No swimmers match these filters' : 'No public swimmer profiles yet'} subtitle={countrySwimmers.length ? 'Adjust the search, gender, or transplant type to see more swimmers.' : `Public swimmer profiles from ${countryName || 'this country'} will appear here when athletes join.`} />}
          {!loading && !loadError && filteredSwimmers.length > 0 && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Country swimmer pages" />}
        </div>
      </section>

      <section style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6 flex items-end justify-between border-b border-[var(--border)] pb-5">
            <div><Eyebrow>World records</Eyebrow><h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Records held for {countryName || 'this country'}</h2></div>
            {!loading && !recordLoadError && <span className="font-mono text-xs text-neutral-600">{filteredSwimmerRecords.length} swimmer · {filteredDonorRecords.length} donor</span>}
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
                <input value={recordSearch} onChange={event => { setRecordSearch(event.target.value); setSwimmerRecordPage(1); setDonorRecordPage(1); }} placeholder="Search record holders" aria-label="Search record holders" className="h-[42px] w-full border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-dark)]" />
              </div>
              <label className="flex h-[42px] items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">
                <span className="shrink-0">Transplant:</span>
                <select value={recordTransplant} onChange={event => { setRecordTransplant(event.target.value); setSwimmerRecordPage(1); setDonorRecordPage(1); }} className="min-w-0 appearance-none bg-transparent pr-5 text-sm font-medium text-[var(--ink)] outline-none">
                  {['All', ...TRANSPLANT_TYPES.filter(type => type !== 'Donor')].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="flex h-[42px] items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">
                <span className="shrink-0">Age:</span>
                <select value={recordAge} onChange={event => { setRecordAge(event.target.value); setSwimmerRecordPage(1); setDonorRecordPage(1); }} className="min-w-0 appearance-none bg-transparent pr-5 text-sm font-medium text-[var(--ink)] outline-none">
                  {['All', ...recordAgeOptions].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="flex h-[42px] items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">
                <span className="shrink-0">Event:</span>
                <select value={recordEvent} onChange={event => { setRecordEvent(event.target.value); setSwimmerRecordPage(1); setDonorRecordPage(1); }} className="min-w-0 appearance-none bg-transparent pr-5 text-sm font-medium text-[var(--ink)] outline-none">
                  {['All', ...recordEventOptions].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="inline-flex shrink-0 border border-[var(--border)] bg-white p-1" role="group" aria-label="Filter records by gender">
              {['All', 'Men', 'Women'].map(option => <button key={option} type="button" aria-pressed={recordGender === option} onClick={() => { setRecordGender(option); setSwimmerRecordPage(1); setDonorRecordPage(1); }} className={`min-h-9 px-4 text-sm transition-colors ${recordGender === option ? 'bg-[var(--navy)] font-semibold text-white' : 'text-[var(--ink)] hover:bg-[var(--ice)]'}`}>{option}</button>)}
            </div>
          </div>
          {loading ? <SkeletonTable rows={5} columns={5} /> : recordLoadError ? <EmptyState title="World record data is unavailable" subtitle={recordLoadError} /> : (filteredSwimmerRecords.length + filteredDonorRecords.length) ? <>
            {recordGroups.map(group => {
              const groupPageCount = Math.ceil(group.rows.length / PAGE_SIZE);
              const pageRows = group.rows.slice((group.page - 1) * PAGE_SIZE, group.page * PAGE_SIZE);
              return <section key={group.key} className="mb-10 last:mb-0">
                <div className="mb-3 flex items-end justify-between border-b border-[var(--border)] pb-3"><h3 className="text-lg font-bold text-[var(--ink)]">{group.title}</h3><span className="font-mono text-xs text-[var(--muted)]">{group.rows.length}</span></div>
                {group.key === 'donors' && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <div className="relative min-w-[220px] flex-1">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
                      <input value={donorSearch} onChange={event => { setDonorSearch(event.target.value); setDonorRecordPage(1); }} placeholder="Search donor record holders" aria-label="Search donor record holders" className="h-[42px] w-full border border-[var(--border)] bg-white pl-9 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-dark)]" />
                    </div>
                    <label className="flex h-[42px] items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">
                      <span className="shrink-0">Age:</span>
                      <select value={donorAge} onChange={event => { setDonorAge(event.target.value); setDonorRecordPage(1); }} className="min-w-0 appearance-none bg-transparent pr-5 text-sm font-medium text-[var(--ink)] outline-none">
                        {['All', ...donorAgeOptions].map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="flex h-[42px] items-center gap-1.5 border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted)]">
                      <span className="shrink-0">Event:</span>
                      <select value={donorEvent} onChange={event => { setDonorEvent(event.target.value); setDonorRecordPage(1); }} className="min-w-0 appearance-none bg-transparent pr-5 text-sm font-medium text-[var(--ink)] outline-none">
                        {['All', ...donorEventOptions].map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="inline-flex shrink-0 border border-[var(--border)] bg-white p-1" role="group" aria-label="Filter donor records by gender">
                    {['All', 'Men', 'Women'].map(option => <button key={option} type="button" aria-pressed={donorGender === option} onClick={() => { setDonorGender(option); setDonorRecordPage(1); }} className={`min-h-9 px-4 text-sm transition-colors ${donorGender === option ? 'bg-[var(--navy)] font-semibold text-white' : 'text-[var(--ink)] hover:bg-[var(--ice)]'}`}>{option}</button>)}
                  </div>
                </div>}
                <div className="ta-table-shell">
                  <div className="ta-table-header grid grid-cols-[minmax(160px,1fr)_80px_95px_100px_minmax(130px,1fr)_90px] items-center gap-4 px-5 py-3 font-mono text-xs font-semibold uppercase tracking-widest"><span>Event</span><span>Age</span><span>Gender</span><span>Record holder</span><span>Games</span><span className="text-right">Time</span></div>
                  <div>{pageRows.length ? pageRows.map(record => <div key={record.id} className="ta-table-row grid grid-cols-[minmax(160px,1fr)_80px_95px_100px_minmax(130px,1fr)_90px] items-center gap-4 px-5 py-4"><span className="min-w-0 truncate text-sm font-semibold text-[var(--ink)]">{record.event || '—'}</span><span className="text-xs text-[var(--muted)]">{record.ageGroup || '—'}</span><span className="text-xs text-[var(--muted)]">{record.gender || '—'}</span>{record.athleteId ? <Link to={`/athletes/${record.athleteId}`} className="truncate text-sm font-semibold text-[var(--ink)] hover:text-[var(--accent-dark)]">{record.athleteName || '—'}</Link> : <span className="truncate text-sm text-[var(--ink)]">{record.athleteName || '—'}</span>}<span className="truncate text-xs text-[var(--muted)]">{record.games || record.meet || '—'}</span><span className="text-right font-mono text-sm font-bold text-[var(--navy)]">{record.time || '—'}</span></div>) : <p className="px-4 py-6 text-sm text-[var(--muted)]">No {group.key === 'donors' ? 'donor' : 'swimmer'} records listed for {countryName || 'this country'}.</p>}</div>
                </div>
                {group.rows.length > 0 && <Pagination page={group.page} pageCount={groupPageCount} onPageChange={group.setPage} label={`${group.title} pages`} />}
              </section>;
            })}
          </> : <EmptyState title={countryRecords.length ? 'No records match these filters' : 'No world records listed'} subtitle={countryRecords.length ? 'Adjust the search, gender, or transplant type to see more record holders.' : `There are no records attributed to ${countryName || 'this country'} in the current database.`} />}
        </div>
      </section>
    </div>
  );
}
