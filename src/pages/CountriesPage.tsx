import { useEffect, useState } from 'react';
import { countries } from '../data/countries';
import SearchInput from '../components/SearchInput';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import FilterBar from '../components/FilterBar';
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
      <section style={{ backgroundColor: 'var(--navy)' }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Eyebrow light className="mb-3">Global</Eyebrow>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
            86 countries.
            <br />
            One pool.
          </h1>
          <p style={{ color: 'var(--muted-on-dark)' }} className="mt-4 text-base max-w-xl">
            Transplant swimmers compete from every corner of the world. Choose a country to see its swimmers.
          </p>
        </div>
      </section>

      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <FilterBar className="mb-6 max-w-md">
            <SearchInput value={search} onChange={setSearch} placeholder="Search countries..." />
          </FilterBar>
          {filtered.length ? (
            <div className="overflow-hidden border border-neutral-200 bg-white">
              <div className="grid grid-cols-[minmax(0,1fr)_28px] items-center gap-3 border-b border-neutral-200 bg-[#f4f5f6] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-neutral-600 sm:grid-cols-[minmax(200px,1.7fr)_100px_120px_110px_minmax(150px,1fr)_28px] sm:gap-4 sm:px-5 sm:text-xs">
                <span>Country</span><span className="hidden text-right sm:block">Athletes</span><span className="hidden text-right sm:block">Results</span><span className="hidden text-right sm:block">Records</span><span className="hidden sm:block">Top event</span><span aria-hidden="true" />
              </div>
              {pageCountries.map((country, index) => (
                <Link
                  key={country.code}
                  to={`/countries/${country.code}`}
                  className={`group grid grid-cols-[minmax(0,1fr)_28px] items-center gap-3 border-b border-neutral-200 px-3 py-4 transition-colors hover:bg-neutral-50 sm:grid-cols-[minmax(200px,1.7fr)_100px_120px_110px_minmax(150px,1fr)_28px] sm:gap-4 sm:px-5 ${index % 2 ? 'bg-[#f7f8fa]' : 'bg-white'}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="text-3xl leading-none" aria-hidden="true">{country.flag}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-[#303846] group-hover:text-[#1769c2] sm:text-lg">{country.name}</span>
                      <span className="mt-0.5 block font-mono text-xs tracking-wider text-neutral-500">{COUNTRY_ALPHA3[country.code] ?? country.code}</span>
                      <span className="mt-1 block font-mono text-[10px] text-neutral-600 sm:hidden">{country.athletes} athletes · {country.results.toLocaleString()} results · {country.records} records</span>
                    </span>
                  </span>
                  <span className="hidden text-right font-mono text-sm font-semibold text-[#303846] sm:block">{country.athletes}</span>
                  <span className="hidden text-right font-mono text-sm text-[#4b5563] sm:block">{country.results.toLocaleString()}</span>
                  <span className="hidden text-right font-mono text-sm font-semibold text-[#1769c2] sm:block">{country.records}</span>
                  <span className="hidden truncate text-sm text-[#4b5563] sm:block">{country.topEvent ?? '—'}</span>
                  <span className="flex justify-end text-neutral-400 transition-colors group-hover:text-[#1769c2]"><ArrowRight size={20} aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center font-mono text-sm text-neutral-600">No countries match your search.</p>
          )}
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Country pages" />
        </div>
      </section>
    </div>
  );
}
