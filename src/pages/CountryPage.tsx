import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { athletes } from '../data/athletes';
import { countries } from '../data/countries';
import AthleteDirectoryTable from '../components/AthleteDirectoryTable';
import DatasetNotice from '../components/DatasetNotice';
import EmptyState from '../components/EmptyState';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;

export default function CountryPage() {
  const { code = '' } = useParams();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [code]);
  const country = countries.find(item => item.code.toLowerCase() === code.toLowerCase());

  if (!country) {
    return (
      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-16">
          <Eyebrow>Country not found</Eyebrow>
          <h1 className="mt-3 text-4xl font-black text-[var(--ink)]">We couldn’t find that country.</h1>
          <Link to="/countries" className="mt-6 inline-flex items-center gap-2 font-mono text-sm text-[var(--blue)] hover:underline">
            <ArrowLeft size={16} /> All countries
          </Link>
        </div>
      </section>
    );
  }

  const countryAthletes = athletes
    .filter(athlete => athlete.countryCode.toLowerCase() === country.code.toLowerCase())
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const pageCount = Math.ceil(countryAthletes.length / PAGE_SIZE);
  const pageAthletes = countryAthletes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <section style={{ backgroundColor: 'var(--navy)' }}>
        <div className="max-w-7xl mx-auto px-4 py-14">
          <Link to="/countries" className="mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/65 hover:text-white">
            <ArrowLeft size={14} /> All countries
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-5xl" aria-hidden="true">{country.flag}</span>
            <div>
              <Eyebrow color="accent" onDark>Country directory</Eyebrow>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">{country.name}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm text-white/70">
            Swimmers from {country.name} listed in the Transplant Aquatics directory.
          </p>
        </div>
      </section>

      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="mb-6"><DatasetNotice /></div>
          <div className="mb-6 flex items-end justify-between border-b border-[var(--border)] pb-5">
            <div>
              <Eyebrow>Athlete directory</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Swimmers from {country.name}</h2>
            </div>
            <span className="font-mono text-xs text-neutral-600">{countryAthletes.length} {countryAthletes.length === 1 ? 'swimmer' : 'swimmers'}</span>
          </div>

          {countryAthletes.length ? (
            <AthleteDirectoryTable athletes={pageAthletes} />
          ) : (
            <EmptyState title="No swimmers listed yet" subtitle={`There are no athlete profiles from ${country.name} in the directory yet.`} />
          )}
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Country swimmer pages" />
        </div>
      </section>
    </div>
  );
}
