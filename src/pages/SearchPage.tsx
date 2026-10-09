import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { records } from '../data/records';
import { countries } from '../data/countries';
import { usePublishedArticles } from '../hooks/usePublishedArticles';
import { getFlagEmoji } from '../lib/utils';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';

type SearchCategory = 'All' | 'Athletes' | 'Records' | 'Countries' | 'Stories';
const CATEGORIES: SearchCategory[] = ['All', 'Athletes', 'Records', 'Countries', 'Stories'];
const PAGE_SIZE = 10;

export default function SearchPage() {
  const { articles } = usePublishedArticles();
  const [athletes, setAthletes] = useState<PublicSwimmerProfile[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('All');
  const [page, setPage] = useState(1);
  const q = query.toLowerCase().trim();

  useEffect(() => {
    let active = true;
    loadPublicSwimmerDirectory()
      .then(directory => { if (active) setAthletes(directory); })
      .catch(() => { if (active) setAthletes([]); })
      .finally(() => { if (active) setAthletesLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { setCategory('All'); setPage(1); }, [q]);

  const matchedAthletes = q ? athletes.filter(athlete =>
    `${athlete.first_name} ${athlete.last_name}`.toLowerCase().includes(q)
    || (athlete.country ?? '').toLowerCase().includes(q)
    || String(athlete.transplant_type ?? '').toLowerCase().includes(q)
  ) : [];
  const matchedRecords = q ? records.filter(record =>
    record.event.toLowerCase().includes(q)
    || record.athleteName.toLowerCase().includes(q)
    || record.country.toLowerCase().includes(q)
  ) : [];
  const matchedCountries = q ? countries.filter(country => country.name.toLowerCase().includes(q)) : [];
  const matchedArticles = q ? articles.filter(article =>
    article.title.toLowerCase().includes(q)
    || article.excerpt.toLowerCase().includes(q)
    || article.category.toLowerCase().includes(q)
  ) : [];

  const counts: Record<SearchCategory, number> = {
    All: matchedAthletes.length + matchedRecords.length + matchedCountries.length + matchedArticles.length,
    Athletes: matchedAthletes.length,
    Records: matchedRecords.length,
    Countries: matchedCountries.length,
    Stories: matchedArticles.length,
  };
  const hasResults = counts.All > 0;
  const showAll = category === 'All';
  const showAthletes = showAll || category === 'Athletes';
  const showRecords = showAll || category === 'Records';
  const showCountries = showAll || category === 'Countries';
  const showStories = showAll || category === 'Stories';
  const selectedCount = category === 'All' ? counts.All : counts[category];
  const pageCount = Math.ceil(selectedCount / PAGE_SIZE);
  const visibleItems = <T,>(items: T[]) => showAll ? items.slice(0, 5) : items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sectionHeader = (label: string, count: number, target: SearchCategory) => (
    <div className="mb-1.5 flex items-center justify-between border-b border-[var(--border)] pb-1.5">
      <h2 className="text-sm font-bold text-[var(--ink)]">{label} <span className="font-normal text-[var(--muted)]">({count})</span></h2>
      {showAll && count > 0 && <button type="button" onClick={() => setCategory(target)} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent-dark)] hover:underline">See all <ArrowRight size={14} /></button>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <section className="border-b border-[var(--navy-light)] bg-[var(--navy)]">
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search athletes, records, countries or stories"
              aria-label="Search athletes, records, countries or stories"
              className="h-[42px] w-full border border-[var(--accent-dark)] bg-white pl-9 pr-10 text-sm text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--ink)]"><X size={15} /></button>}
          </div>
          <div className="mt-3 flex gap-5 overflow-x-auto" role="tablist" aria-label="Search result categories">
            {CATEGORIES.map(item => <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              onClick={() => { setCategory(item); setPage(1); }}
              className={`shrink-0 border-b-2 px-1 pb-2 text-sm transition-colors ${category === item ? 'border-[var(--accent)] font-semibold text-white' : 'border-transparent text-white/65 hover:text-white'}`}
            >{item} <span className="ml-1 font-mono text-sm text-white/55">{counts[item]}</span></button>)}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-4 sm:py-7">
        {!q ? <div className="py-12 text-center text-sm text-[var(--muted)]">Search across athletes, records, countries and stories.</div>
          : !hasResults && !showAll ? <EmptyState title={`No results for “${query}”`} subtitle="Try a different name, country, event, record or story title." />
            : <div className={showAll ? 'grid gap-x-6 gap-y-5 lg:grid-cols-5' : 'space-y-7'}>
              {showAthletes && (showAll || matchedAthletes.length > 0) && <section className={showAll ? 'lg:col-span-3 lg:row-span-2' : ''}>
                {sectionHeader('Athletes', matchedAthletes.length, 'Athletes')}
                  {matchedAthletes.length ? <div className="divide-y divide-[var(--border)] border-b border-[var(--border)]">
                  {visibleItems(matchedAthletes).map(athlete => {
                    return <Link key={athlete.id} to={`/athletes/${athlete.id}`} className="flex items-center gap-3 bg-white px-3 py-2.5 transition-colors hover:bg-[var(--ice)]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ice)] text-sm font-semibold text-[var(--navy)]">{`${athlete.first_name[0] ?? ''}${athlete.last_name[0] ?? ''}`}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--ink)]">{athlete.first_name} {athlete.last_name}</span><span className="block truncate text-sm text-[var(--muted)]">{getFlagEmoji(athlete.country_code ?? '')} {athlete.country ?? 'Country not listed'}{athlete.club_name ? ` · ${athlete.club_name}` : ''}</span></span>
                    </Link>;
                  })}
                </div> : <p className="border border-[var(--border)] bg-white px-3 py-5 text-sm text-[var(--muted)]">{athletesLoading ? 'Loading athletes…' : 'No athletes found.'}</p>}
              </section>}

              <div className={showAll ? 'space-y-5 lg:col-span-2' : 'contents'}>
                {showRecords && (showAll || matchedRecords.length > 0) && <section>
                  {sectionHeader('Records', matchedRecords.length, 'Records')}
                  {matchedRecords.length ? <div className="divide-y divide-[var(--border)] border-b border-[var(--border)]">
                    {visibleItems(matchedRecords).map(record => <Link key={record.id} to={record.athleteId ? `/athletes/${record.athleteId}` : '/records'} className="flex items-center gap-3 bg-white px-3 py-2.5 transition-colors hover:bg-[var(--ice)]">
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--ink)]">{record.event}</span><span className="block truncate text-sm text-[var(--muted)]">{record.athleteName} · {record.gender} · {record.ageGroup}</span></span>
                      <span className="shrink-0 font-mono text-sm font-bold text-[var(--ink)]">{record.time}</span>
                    </Link>)}
                  </div> : <p className="border border-[var(--border)] bg-white px-3 py-5 text-sm text-[var(--muted)]">No records found.</p>}
                </section>}

                {showCountries && (showAll || matchedCountries.length > 0) && <section>
                  {sectionHeader('Countries', matchedCountries.length, 'Countries')}
                  {matchedCountries.length ? <div className="divide-y divide-[var(--border)] border-b border-[var(--border)]">
                    {visibleItems(matchedCountries).map(country => {
                      const swimmerCount = athletes.filter(athlete => athlete.country === country.name).length;
                      return <Link key={country.code} to={`/countries/${encodeURIComponent(country.code)}`} className="flex items-center gap-3 bg-white px-3 py-2.5 transition-colors hover:bg-[var(--ice)]">
                        <span className="text-sm" aria-hidden="true">{country.flag}</span>
                        <span className="flex-1 text-sm font-semibold text-[var(--ink)]">{country.name}</span>
                        <span className="text-sm text-[var(--muted)]">{swimmerCount} swimmers</span>
                      </Link>;
                    })}
                  </div> : <p className="border border-[var(--border)] bg-white px-3 py-5 text-sm text-[var(--muted)]">No countries found.</p>}
                </section>}
              </div>

              {showStories && (!showAll || matchedArticles.length > 0) && <section className={showAll ? 'lg:col-span-5' : ''}>
                {sectionHeader('Stories', matchedArticles.length, 'Stories')}
                {matchedArticles.length ? <div className="grid gap-3 sm:grid-cols-2">
                  {visibleItems(matchedArticles).map(article => <Link key={article.id} to={`/from-the-pool-deck/${article.slug}`} className="border border-[var(--border)] bg-white p-3 transition-colors hover:bg-[var(--ice)]"><span className="text-sm font-semibold uppercase tracking-wider text-[var(--accent-dark)]">{article.category}</span><span className="mt-1 block text-sm font-semibold text-[var(--ink)]">{article.title}</span><span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">{article.excerpt}</span></Link>)}
                </div> : <p className="border border-[var(--border)] bg-white px-3 py-5 text-sm text-[var(--muted)]">No stories found.</p>}
              </section>}
            </div>}
        {q && hasResults && category !== 'All' && selectedCount > 0 && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label={`Search ${category.toLowerCase()} pages`} totalCount={selectedCount} pageSize={PAGE_SIZE} enhanced />}
      </main>
    </div>
  );
}
