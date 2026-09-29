import { useEffect, useState } from 'react';
import { countries } from '../data/countries';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import PageHeading from '../components/PageHeading';
import DatasetNotice from '../components/DatasetNotice';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import Button from '../components/Button';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const PAGE_SIZE = 10;
const COUNTRY_ALPHA3: Record<string, string> = {
  ZA: 'ZAF', GB: 'GBR', US: 'USA', AU: 'AUS', CA: 'CAN', DE: 'DEU', FR: 'FRA',
  NL: 'NLD', BR: 'BRA', JP: 'JPN', NZ: 'NZL', SE: 'SWE', IT: 'ITA', ES: 'ESP',
  IL: 'ISR', PL: 'POL', NO: 'NOR', DK: 'DNK', IE: 'IRL', PT: 'PRT',
};

export default function CountriesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filtered = countries.filter(country =>
    country.name.toLowerCase().includes(search.toLowerCase())
  );
  useEffect(() => setPage(1), [search]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageCountries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <PageHeading eyebrow="Global directory" title="Many countries. One pool." description="Browse the country directory and select a country to see its swimmers." />

      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6"><DatasetNotice /></div>
          <FilterBar className="mb-6 max-w-md">
            <SearchInput value={search} onChange={setSearch} placeholder="Search countries..." />
          </FilterBar>
          {filtered.length ? (
            <div className="ta-table-shell">
              <div className="ta-table-header grid grid-cols-[minmax(0,1fr)_28px] items-center gap-3 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:grid-cols-[minmax(200px,1.7fr)_100px_120px_110px_minmax(150px,1fr)_28px] sm:gap-4 sm:px-5 sm:text-xs">
                <span>Country</span><span className="hidden text-right sm:block">Athletes</span><span className="hidden text-right sm:block">Results</span><span className="hidden text-right sm:block">Records</span><span className="hidden sm:block">Top event</span><span aria-hidden="true" />
              </div>
              <div>
              {pageCountries.map(country => (
                <Link
                  key={country.code}
                  to={`/countries/${country.code}`}
                  className="ta-table-row group grid grid-cols-[minmax(0,1fr)_28px] items-center gap-3 px-3 py-5 sm:grid-cols-[minmax(200px,1.7fr)_100px_120px_110px_minmax(150px,1fr)_28px] sm:gap-4 sm:px-5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="ta-table-flag" aria-hidden="true">{country.flag}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">{country.name}</span>
                      <span className="mt-0.5 block font-mono text-xs tracking-wider text-neutral-500">{COUNTRY_ALPHA3[country.code] ?? country.code}</span>
                      <span className="mt-1 block font-mono text-[10px] text-neutral-600 sm:hidden">{country.athletes} athletes · {country.results.toLocaleString()} results · {country.records} records</span>
                    </span>
                  </span>
                  <span className="hidden text-right font-mono text-sm font-semibold text-[var(--ink)] sm:block">{country.athletes}</span>
                  <span className="hidden text-right font-mono text-sm text-[var(--muted)] sm:block">{country.results.toLocaleString()}</span>
                  <span className="hidden text-right font-mono text-sm font-semibold text-[var(--accent-dark)] sm:block">{country.records}</span>
                  <span className="hidden truncate text-sm text-[var(--muted)] sm:block">{country.topEvent ?? '—'}</span>
                  <span className="flex justify-end text-[var(--muted)] transition-colors group-hover:text-[var(--accent-dark)]"><ArrowRight size={20} aria-hidden="true" /></span>
                </Link>
              ))}
              </div>
            </div>
          ) : (
            <EmptyState title="No countries match your search" subtitle="Try a different country name or clear the search." action={search ? <Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button> : undefined} />
          )}
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Country pages" />
        </div>
      </section>
    </div>
  );
}
