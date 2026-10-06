import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFlagEmoji } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import FilterBar from '../components/FilterBar';
import { ArrowRight } from 'lucide-react';
import { SkeletonTable } from '../components/Skeleton';
import { getClubLogoUrl, loadClubRecords, type ClubRecord } from '../lib/clubs';

type ListedClub = { id: string; slug: string; name: string; country: string; countryCode: string; city: string; logoUrl: string | null };

const PAGE_SIZE = 10;

export default function ClubsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [liveClubs, setLiveClubs] = useState<ClubRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadClubRecords().then(rows => { if (active) setLiveClubs(rows); }).catch(() => { if (active) setLiveClubs([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const allClubs: ListedClub[] = liveClubs.map(club => ({
    id: club.id, slug: club.slug, name: club.name, country: club.country,
    countryCode: club.country_code ?? '', city: club.city, logoUrl: getClubLogoUrl(club),
  }));

  const filtered = allClubs.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  });
  useEffect(() => setPage(1), [search]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageClubs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <section
        className="ta-page-top border-b"
        style={{
          borderColor: 'var(--navy-light)',
          backgroundImage: "linear-gradient(rgba(7, 26, 43, 0.7), rgba(7, 26, 43, 0.7)), url('/images/topsectionbg.png')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-16">
          <Eyebrow color="accent" className="mb-4">Clubs</Eyebrow>
          <h1
            className="display text-4xl md:text-6xl font-black uppercase leading-tight tracking-tight"
            style={{ color: 'var(--ink-on-dark)' }}
          >
            Transplant Swim Clubs
          </h1>
          <p className="mt-3 font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
            {allClubs.length} clubs registered worldwide · Find your nearest club
          </p>
        </div>
      </section>

      <section style={{ backgroundColor: '#f4f2ed' }}>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 pb-16 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
        <FilterBar className="mb-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by club name, city or country…" />
        </FilterBar>
        <p className="mb-4 text-sm font-semibold text-[var(--ink)]">{filtered.length} {filtered.length === 1 ? 'club' : 'clubs'} registered</p>
        {loading ? <SkeletonTable rows={6} columns={3} /> : filtered.length === 0 ? (
          <EmptyState title="No clubs match your search" subtitle="Try a different club, city or country name." action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button>} />
        ) : (
          <div className="ta-table-shell">
            <div className="ta-table-header grid grid-cols-[minmax(0,1fr)_28px] items-center gap-3 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest sm:grid-cols-[minmax(200px,1.6fr)_minmax(150px,1.2fr)_100px_90px_28px] sm:gap-4 sm:px-5 sm:text-xs">
              <span>Club</span><span className="hidden sm:block">Location</span><span aria-hidden="true" />
            </div>
            <div>
            {pageClubs.map(club => (
              <Link
                key={club.id}
                to={`/clubs/${club.slug}`}
                className="ta-table-row group grid grid-cols-[minmax(0,1fr)_28px] items-center gap-3 px-3 py-5 no-underline sm:grid-cols-[minmax(200px,1.6fr)_minmax(150px,1.2fr)_28px] sm:gap-4 sm:px-5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-mono text-xs font-bold text-[var(--navy)]" aria-hidden="true">
                    {club.logoUrl ? <img src={club.logoUrl} alt="" className="h-full w-full rounded-full object-contain p-0.5" /> : club.name.split(' ').map(word => word[0]).join('').slice(0, 3).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">{club.name}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm text-[var(--muted)] sm:hidden"><span className="ta-table-flag shrink-0">{getFlagEmoji(club.countryCode)}</span><span className="truncate">{club.city}, {club.country}</span></span>
                  </span>
                </span>
                  <span className="hidden min-w-0 truncate text-sm text-[var(--muted)] sm:block"><span className="ta-table-flag mr-2 align-middle" aria-hidden="true">{getFlagEmoji(club.countryCode)}</span>{club.city}, {club.country}</span>
                <span className="flex justify-end text-[var(--muted)] transition-colors group-hover:text-[var(--accent-dark)]"><ArrowRight size={20} aria-hidden="true" /></span>
              </Link>
            ))}
            </div>
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Club pages" />
        <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">We’re just getting started. If you train with a transplant swim group, ask them to register so others nearby can find it.</p>
        </div>
        <aside className="h-fit bg-[var(--navy)] p-6 text-white lg:p-8">
          <h2 className="text-2xl font-bold">Run a club? Register it.</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">It takes about five minutes and helps swimmers near you find a place to train.</p>
          <ol className="mt-6 space-y-4 text-sm text-white/85">
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--navy)]">1</span><span>Tell us the club name, pool and training times.</span></li>
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--navy)]">2</span><span>Add a contact so swimmers can reach you.</span></li>
            <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--navy)]">3</span><span>Invite members to link their athlete profiles.</span></li>
          </ol>
          <Link to="/join" className="mt-7 inline-flex w-full items-center justify-center gap-2 bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--navy)] hover:bg-white">Register your club <ArrowRight size={16} /></Link>
        </aside>
      </div>
      </section>
    </div>
  );
}
