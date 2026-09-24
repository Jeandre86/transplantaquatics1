import { useState } from 'react';
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

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  const q = query.toLowerCase().trim();

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
            placeholder="Search Split Second..."
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
                  {matchedAthletes.map(a => (
                    <AthleteCard key={a.id} athlete={a} />
                  ))}
                </div>
              </section>
            )}

            {matchedRecords.length > 0 && (
              <section>
                <Eyebrow className="mb-5">Records ({matchedRecords.length})</Eyebrow>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchedRecords.slice(0, 4).map(r => (
                    <RecordCard key={r.id} record={r} />
                  ))}
                </div>
              </section>
            )}

            {matchedCountries.length > 0 && (
              <section>
                <Eyebrow className="mb-5">Countries ({matchedCountries.length})</Eyebrow>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {matchedCountries.map(c => (
                    <CountryCard
                      key={c.code}
                      country={c}
                      selected={selectedCountry?.code === c.code}
                      onClick={() => setSelectedCountry(selectedCountry?.code === c.code ? null : c)}
                    />
                  ))}
                </div>
              </section>
            )}

            {matchedArticles.length > 0 && (
              <section>
                <Eyebrow className="mb-5">Stories ({matchedArticles.length})</Eyebrow>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
                  {matchedArticles.map(a => (
                    <div key={a.id} className="pr-0 md:pr-8 last:pr-0">
                      <ArticleCard article={a} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
