import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { athletes } from '../data/athletes';
import { countries } from '../data/countries';
import AthleteDirectoryRow from '../components/AthleteDirectoryRow';
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
          <div className="mb-6 flex items-end justify-between border-b border-[var(--border)] pb-5">
            <div>
              <Eyebrow>Athlete directory</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Swimmers from {country.name}</h2>
            </div>
            <span className="font-mono text-xs text-neutral-600">{countryAthletes.length} {countryAthletes.length === 1 ? 'swimmer' : 'swimmers'}</span>
          </div>

          {countryAthletes.length ? (
            <div className="overflow-hidden border border-neutral-200 bg-white">
              <div className="grid grid-cols-[76px_minmax(0,1fr)_28px] items-center gap-3 border-b border-neutral-200 bg-[#f4f5f6] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-neutral-600 sm:grid-cols-[92px_minmax(140px,1.5fr)_90px_minmax(130px,1fr)_28px] sm:gap-4 sm:px-5 sm:text-xs md:grid-cols-[98px_minmax(160px,1.5fr)_100px_145px_minmax(140px,1fr)_28px] lg:grid-cols-[110px_minmax(200px,1.7fr)_110px_155px_minmax(160px,1fr)_28px]">
                <span>Country</span>
                <span>Athlete</span>
                <span className="hidden sm:block">Gender</span>
                <span className="hidden md:block">DOB</span>
                <span className="hidden sm:block">Transplant Type</span>
                <span aria-hidden="true" />
              </div>
              {pageAthletes.map((athlete, index) => <AthleteDirectoryRow key={athlete.id} athlete={athlete} index={index} />)}
            </div>
          ) : (
            <div className="border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">No swimmers listed yet</p>
              <p className="mt-2 text-sm text-neutral-600">There are no athlete profiles from {country.name} in the directory yet.</p>
            </div>
          )}
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Country swimmer pages" />
        </div>
      </section>
    </div>
  );
}
