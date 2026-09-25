import { useEffect, useState } from 'react';
import { athletes } from '../data/athletes';
import { records } from '../data/records';
import { countries } from '../data/countries';
import { articles } from '../data/articles';
import SearchInput from '../components/SearchInput';
import AthleteCard from '../components/AthleteCard';
import RecordCard from '../components/RecordCard';
import CountryCard from '../components/CountryCard';
import ArticleCard from '../components/ArticleCard';
import Eyebrow from '../components/Eyebrow';
import type { Country } from '../types';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [athletePage, setAthletePage] = useState(1);
  const [recordPage, setRecordPage] = useState(1);
  const [countryPage, setCountryPage] = useState(1);
  const [articlePage, setArticlePage] = useState(1);

  const q = query.toLowerCase().trim();
  useEffect(() => {
    setAthletePage(1);
    setRecordPage(1);
    setCountryPage(1);
    setArticlePage(1);
  }, [q]);

  const matchedAthletes = q
    ? athletes.filter(a =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q) ||
        a.transplantType.toLowerCase().includes(q)
      )
    : [];

  const matchedRecords = q
    ? records.filter(r =>
        r.event.toLowerCase().includes(q) ||
        r.athleteName.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q)
      )
    : [];

  const matchedCountries = q
    ? countries.filter(c => c.name.toLowerCase().includes(q))
    : [];

  const matchedArticles = q
    ? articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      )
    : [];

  const hasResults = matchedAthletes.length + matchedRecords.length + matchedCountries.length + matchedArticles.length > 0;
  const athletePageCount = Math.ceil(matchedAthletes.length / PAGE_SIZE);
  const recordPageCount = Math.ceil(matchedRecords.length / PAGE_SIZE);
  const countryPageCount = Math.ceil(matchedCountries.length / PAGE_SIZE);
  const articlePageCount = Math.ceil(matchedArticles.length / PAGE_SIZE);

  return (
    <div style={{ backgroundColor: 'var(--paper)' }} className="min-h-screen">
      {/* Search hero */}
      <div style={{ backgroundColor: "var(--navy)" }} className="text-white py-16">
        <div className="max-w-3xl mx-auto px-4">
          <Eyebrow light className="mb-3">Search</Eyebrow>
          <h1 className="text-4xl font-black tracking-tight mb-8">
            Find athletes, records, countries and stories.
          </h1>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search Transplant Aquatics..."
            large
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {!q && (
          <div className="text-center py-16">
            <div className="font-mono text-xs tracking-widest uppercase text-neutral-400 mb-4">
              Search across
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {['Athletes', 'Records', 'Countries', 'Stories'].map(label => (
                <span
                  key={label}
                  className="font-mono text-sm border border-neutral-300 px-4 py-2 text-neutral-500"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {q && !hasResults && (
          <div className="text-center py-16">
            <div className="font-mono text-sm text-neutral-400">
              No results found for <strong className="text-black">"{query}"</strong>
            </div>
          </div>
        )}

        {q && hasResults && (
          <div className="space-y-12">
            {matchedAthletes.length > 0 && (
              <section>
                <Eyebrow className="mb-5">Athletes ({matchedAthletes.length})</Eyebrow>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {matchedAthletes.slice((athletePage - 1) * PAGE_SIZE, athletePage * PAGE_SIZE).map(a => (
                    <AthleteCard key={a.id} athlete={a} />
                  ))}
                </div>
                <Pagination page={athletePage} pageCount={athletePageCount} onPageChange={setAthletePage} label="Search athlete pages" />
              </section>
            )}

            {matchedRecords.length > 0 && (
              <section>
                <Eyebrow className="mb-5">Records ({matchedRecords.length})</Eyebrow>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchedRecords.slice((recordPage - 1) * PAGE_SIZE, recordPage * PAGE_SIZE).map(r => (
                    <RecordCard key={r.id} record={r} />
                  ))}
                </div>
                <Pagination page={recordPage} pageCount={recordPageCount} onPageChange={setRecordPage} label="Search record pages" />
              </section>
            )}

            {matchedCountries.length > 0 && (
              <section>
                <Eyebrow className="mb-5">Countries ({matchedCountries.length})</Eyebrow>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {matchedCountries.slice((countryPage - 1) * PAGE_SIZE, countryPage * PAGE_SIZE).map(c => (
                    <CountryCard
                      key={c.code}
                      country={c}
                      selected={selectedCountry?.code === c.code}
                      onClick={() => setSelectedCountry(selectedCountry?.code === c.code ? null : c)}
                    />
                  ))}
                </div>
                <Pagination page={countryPage} pageCount={countryPageCount} onPageChange={setCountryPage} label="Search country pages" />
              </section>
            )}

            {matchedArticles.length > 0 && (
              <section>
                <Eyebrow className="mb-5">Stories ({matchedArticles.length})</Eyebrow>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
                  {matchedArticles.slice((articlePage - 1) * PAGE_SIZE, articlePage * PAGE_SIZE).map(a => (
                    <div key={a.id} className="pr-0 md:pr-8 last:pr-0">
                      <ArticleCard article={a} />
                    </div>
                  ))}
                </div>
                <Pagination page={articlePage} pageCount={articlePageCount} onPageChange={setArticlePage} label="Search story pages" />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
