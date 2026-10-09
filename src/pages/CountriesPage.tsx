import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { countries as countryReference } from '../data/countries';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { loadWorldRecords } from '../lib/worldRecords';
import type { Record as WorldRecord } from '../types';
import { describeSupabaseError } from '../lib/supabase';
import { getCountryIso2, getFlagEmoji } from '../lib/utils';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { SkeletonTable } from '../components/Skeleton';

const PAGE_SIZE = 10;

type ListedCountry = { code: string; name: string; flag: string; swimmerCount: number; recordCount: number | null };

function toListedCountries(swimmers: PublicSwimmerProfile[], records: WorldRecord[], recordsAvailable: boolean): ListedCountry[] {
  const grouped = new Map<string, ListedCountry>();
  swimmers.forEach(swimmer => {
    const name = (swimmer.country ?? '').trim();
    const normalizedCode = getCountryIso2(swimmer.country_code ?? '');
    const reference = countryReference.find(country =>
      (normalizedCode && country.code.toLowerCase() === normalizedCode.toLowerCase())
      || (name && country.name.toLowerCase() === name.toLowerCase()),
    );
    // Historical/imported rows can be missing a country name. Use a known
    // country code to recover it when possible; otherwise omit the row here.
    const resolvedName = reference?.name ?? name;
    if (!resolvedName) return;
    const code = reference?.code || (normalizedCode.length === 2 ? normalizedCode : name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    const key = code.toLowerCase();
    const current = grouped.get(key);
    if (current) {
      current.swimmerCount += 1;
      return;
    }
    grouped.set(key, {
      code,
      name: resolvedName,
      flag: getFlagEmoji(normalizedCode || reference?.code || ''),
      swimmerCount: 1,
      recordCount: recordsAvailable ? 0 : null,
    });
  });

  records.forEach(record => {
    const normalizedCode = getCountryIso2(record.countryCode ?? '');
    const recordCountry = (record.country ?? '').trim();
    const reference = countryReference.find(country => country.code.toLowerCase() === normalizedCode.toLowerCase())
      ?? countryReference.find(country => recordCountry && country.name.toLowerCase() === recordCountry.toLowerCase());
    const resolvedName = reference?.name ?? recordCountry;
    if (!resolvedName) return;
    const code = reference?.code || (normalizedCode.length === 2 ? normalizedCode : recordCountry.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    const key = code.toLowerCase();
    const current = grouped.get(key);
    if (current) {
      if (current.recordCount !== null) current.recordCount += 1;
      return;
    }
    grouped.set(key, {
      code,
      name: resolvedName,
      flag: getFlagEmoji(normalizedCode || reference?.code || ''),
      swimmerCount: 0,
      recordCount: recordsAvailable ? 1 : null,
    });
  });
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function CountriesPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'swimmers' | 'records' | 'name'>('swimmers');
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [swimmers, setSwimmers] = useState<PublicSwimmerProfile[]>([]);
  const [records, setRecords] = useState<WorldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recordLoadError, setRecordLoadError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([loadPublicSwimmerDirectory(), loadWorldRecords()]).then(([swimmerResult, recordResult]) => {
      if (!active) return;
      if (swimmerResult.status === 'fulfilled') setSwimmers(swimmerResult.value);
      else setLoadError(`The public swimmer directory could not be loaded. ${describeSupabaseError(swimmerResult.reason)}`);
      if (recordResult.status === 'fulfilled') setRecords(recordResult.value);
      else setRecordLoadError(`World record counts are unavailable. ${describeSupabaseError(recordResult.reason)}`);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const allCountries = useMemo(() => toListedCountries(swimmers, records, !recordLoadError), [swimmers, records, recordLoadError]);
  const maxSwimmers = Math.max(1, ...allCountries.map(country => country.swimmerCount));
  const filtered = allCountries.filter(country => country.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'records') return (b.recordCount ?? -1) - (a.recordCount ?? -1) || a.name.localeCompare(b.name);
    return b.swimmerCount - a.swimmerCount || a.name.localeCompare(b.name);
  });
  const visibleCountries = showAll || search.trim() ? filtered : filtered.slice(0, 17);
  useEffect(() => setPage(1), [search, sort, showAll]);
  const pageCount = Math.ceil(visibleCountries.length / PAGE_SIZE);
  const pageCountries = visibleCountries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <PageHeading eyebrow="Global directory" title="Countries" description="Browse registered swimmers and countries with World Transplant Games records." />
      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 pt-0 pb-10">
          <div className="ta-filter-bar-full-bleed mb-5 border-y border-[var(--border)] bg-white md:h-24">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:h-full md:py-0">
              <div className="min-w-[240px] flex-1">
                <SearchInput value={search} onChange={setSearch} placeholder="Search countries" />
              </div>
            </div>
          </div>
          <div className="mb-4 flex justify-end">
            <div className="inline-flex h-[42px] shrink-0 items-center border border-[var(--border)] bg-white p-0.5" role="group" aria-label="Sort countries">
              {[['swimmers', 'Most swimmers'], ['records', 'Most records'], ['name', 'A–Z']].map(([value, label]) => <button key={value} type="button" onClick={() => setSort(value as typeof sort)} aria-pressed={sort === value} className={`h-full px-3 text-sm font-medium transition-colors ${sort === value ? 'bg-[var(--navy)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{label}</button>)}
            </div>
          </div>
          {loading ? (
            <SkeletonTable rows={6} columns={4} />
          ) : loadError ? (
            <EmptyState title="Country data is unavailable" subtitle={loadError} />
          ) : filtered.length ? (
            <div className="ta-table-shell">
              <div className="ta-table-header grid grid-cols-[32px_minmax(0,1fr)_minmax(150px,1fr)_minmax(130px,0.7fr)] items-center gap-3 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-5 sm:text-xs">
                <span>#</span><span>Country</span><span className="hidden sm:block">Swimmers</span><span className="whitespace-nowrap text-right">World records</span>
              </div>
              <div>{pageCountries.map((country, index) => (
                <Link key={country.code} to={`/countries/${encodeURIComponent(country.code)}`} className="ta-table-row group grid grid-cols-[32px_minmax(0,1fr)_minmax(150px,1fr)_minmax(130px,0.7fr)] items-center gap-3 px-3 py-4 sm:px-5">
                  <span className="font-mono text-sm text-[var(--muted)]">{(page - 1) * PAGE_SIZE + index + 1}</span>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="ta-table-flag" aria-hidden="true">{country.flag}</span>
                    <span className="truncate text-base font-semibold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">{country.name}</span>
                  </span>
                  <span className="hidden items-center gap-3 sm:flex"><span className="w-8 text-right font-mono text-sm font-semibold text-[var(--ink)]">{country.swimmerCount}</span><span className="h-1.5 flex-1 bg-[var(--paper-dark)]"><span className="block h-full bg-[var(--accent-dark)]" style={{ width: `${Math.max(3, country.swimmerCount / maxSwimmers * 100)}%` }} /></span></span>
                  <span className="text-right font-mono text-sm text-[var(--muted)]">{country.recordCount ?? '—'}</span>
                </Link>
              ))}</div>
            </div>
          ) : search ? (
            <EmptyState title="No countries match your search" subtitle="Try a different country name or clear the search." action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button>} />
          ) : (
            <EmptyState title="No swimmer countries yet" subtitle="Countries will appear here when swimmer profiles with a country are in the database." />
          )}
          {!loading && !loadError && recordLoadError && <p className="mt-4 text-xs text-[var(--muted)]">World record counts are temporarily unavailable.</p>}
          {!loading && !loadError && filtered.length > 0 && !showAll && !search.trim() && filtered.length > 17 ? <div className="mt-6 text-center"><Button variant="secondary" size="sm" onClick={() => setShowAll(true)}>Show all {filtered.length} countries</Button></div> : null}
          {!loading && !loadError && filtered.length > 0 && (showAll || Boolean(search.trim())) && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Country pages" />}
        </div>
      </section>
    </div>
  );
}
