import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { countries as countryReference } from '../data/countries';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { loadWorldRecords } from '../lib/worldRecords';
import type { Record as WorldRecord } from '../types';
import { describeSupabaseError } from '../lib/supabase';
import { getFlagEmoji } from '../lib/utils';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import Button from '../components/Button';
import { SkeletonTable } from '../components/Skeleton';

const PAGE_SIZE = 10;

type ListedCountry = { code: string; name: string; flag: string; swimmerCount: number; recordCount: number | null };

function toListedCountries(swimmers: PublicSwimmerProfile[], records: WorldRecord[], recordsAvailable: boolean): ListedCountry[] {
  const grouped = new Map<string, ListedCountry>();
  swimmers.forEach(swimmer => {
    const name = swimmer.country.trim();
    if (!name) return;
    const reference = countryReference.find(country =>
      (swimmer.country_code && country.code.toLowerCase() === swimmer.country_code.toLowerCase())
      || country.name.toLowerCase() === name.toLowerCase(),
    );
    const code = swimmer.country_code?.trim().toUpperCase() || reference?.code || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const key = code.toLowerCase();
    const current = grouped.get(key);
    if (current) {
      current.swimmerCount += 1;
      return;
    }
    grouped.set(key, {
      code,
      name: reference?.name ?? name,
      flag: getFlagEmoji(swimmer.country_code || reference?.code || ''),
      swimmerCount: 1,
      recordCount: recordsAvailable ? 0 : null,
    });
  });

  records.forEach(record => {
    const reference = countryReference.find(country => country.code.toLowerCase() === record.countryCode?.toLowerCase())
      ?? countryReference.find(country => country.name.toLowerCase() === record.country.toLowerCase());
    const code = record.countryCode?.trim().toUpperCase() || reference?.code || record.country.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const key = code.toLowerCase();
    const current = grouped.get(key);
    if (current) {
      if (current.recordCount !== null) current.recordCount += 1;
      return;
    }
    grouped.set(key, {
      code,
      name: reference?.name ?? record.country,
      flag: getFlagEmoji(record.countryCode ?? reference?.code ?? ''),
      swimmerCount: 0,
      recordCount: recordsAvailable ? 1 : null,
    });
  });
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function CountriesPage() {
  const [search, setSearch] = useState('');
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
  const filtered = allCountries.filter(country => country.name.toLowerCase().includes(search.trim().toLowerCase()));
  useEffect(() => setPage(1), [search]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageCountries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <PageHeading eyebrow="Global directory" title="Countries" description="Browse registered swimmers and countries with World Transplant Games records." />
      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <FilterBar className="mb-6 max-w-md">
            <SearchInput value={search} onChange={setSearch} placeholder="Search countries..." />
          </FilterBar>
          {loading ? (
            <SkeletonTable rows={6} columns={4} />
          ) : loadError ? (
            <EmptyState title="Country data is unavailable" subtitle={loadError} />
          ) : filtered.length ? (
            <div className="ta-table-shell">
              <div className="ta-table-header grid grid-cols-[minmax(0,1fr)_auto_auto_20px] items-center gap-3 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:grid-cols-[minmax(0,1fr)_100px_100px_28px] sm:px-5 sm:text-xs">
                <span>Country</span><span className="text-right">Swimmers</span><span className="text-right">Records</span><span aria-hidden="true" />
              </div>
              <div>{pageCountries.map(country => (
                <Link key={country.code} to={`/countries/${encodeURIComponent(country.code)}`} className="ta-table-row group grid grid-cols-[minmax(0,1fr)_auto_auto_20px] items-center gap-3 px-3 py-5 sm:grid-cols-[minmax(0,1fr)_100px_100px_28px] sm:px-5">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="ta-table-flag" aria-hidden="true">{country.flag}</span>
                    <span className="truncate text-base font-semibold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">{country.name}</span>
                  </span>
                  <span className="text-right font-mono text-sm text-[var(--muted)]">{country.swimmerCount}</span>
                  <span className="text-right font-mono text-sm text-[var(--muted)]">{country.recordCount ?? '—'}</span>
                  <span className="flex justify-end text-[var(--muted)] transition-colors group-hover:text-[var(--accent-dark)]"><ArrowRight size={20} aria-hidden="true" /></span>
                </Link>
              ))}</div>
            </div>
          ) : search ? (
            <EmptyState title="No countries match your search" subtitle="Try a different country name or clear the search." action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button>} />
          ) : (
            <EmptyState title="No swimmer countries yet" subtitle="Countries will appear here when swimmer profiles with a country are in the database." />
          )}
          {!loading && !loadError && recordLoadError && <p className="mt-4 text-xs text-[var(--muted)]">World record counts are temporarily unavailable.</p>}
          {!loading && !loadError && filtered.length > 0 && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Country pages" />}
        </div>
      </section>
    </div>
  );
}
