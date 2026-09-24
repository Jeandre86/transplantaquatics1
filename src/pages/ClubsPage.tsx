import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clubs } from '../data/clubs';
import { getFlagEmoji } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';

export default function ClubsPage() {
  const [search, setSearch] = useState('');

  const filtered = clubs.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
      {/* Header */}
      <section
        className="border-b"
        style={{
          backgroundColor: 'var(--navy-mid)',
          borderColor: 'var(--navy-light)',
          backgroundImage:
            'repeating-linear-gradient(-55deg, transparent, transparent 18px, rgba(255,255,255,0.015) 18px, rgba(255,255,255,0.015) 19px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-16">
          <Eyebrow color="accent" className="mb-4">Clubs</Eyebrow>
          <h1
            className="display text-4xl md:text-6xl font-black uppercase leading-tight tracking-tight"
            style={{ color: 'var(--ink-on-dark)' }}
          >
            Transplant Swim Clubs
          </h1>
          <p className="mt-3 font-mono text-sm" style={{ color: 'var(--muted-on-dark)' }}>
            {clubs.length} clubs registered worldwide · Find your nearest club
          </p>
        </div>
      </section>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-6 pt-8">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2"
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{ color: 'var(--muted-on-dark)' }}
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search by club name, city or country…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border font-mono text-sm"
            style={{
              backgroundColor: 'var(--navy-mid)',
              borderColor: 'var(--navy-light)',
              color: 'var(--ink-on-dark)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 py-8 pb-16">
        {filtered.length === 0 ? (
          <div
            className="py-16 text-center border"
            style={{ borderColor: 'var(--navy-light)' }}
          >
            <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
              No clubs match your search
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(club => (
              <Link
                key={club.id}
                to={`/clubs/${club.id}`}
                className="border flex flex-col gap-4 p-6 group transition-colors"
                style={{
                  borderColor: 'var(--navy-light)',
                  backgroundColor: 'var(--navy-mid)',
                  textDecoration: 'none',
                }}
              >
                {/* Avatar / initials */}
                <div
                  className="w-12 h-12 flex items-center justify-center font-mono font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: 'var(--navy)', color: 'var(--accent)' }}
                >
                  {club.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}
                </div>

                {/* Name */}
                <div>
                  <h2
                    className="font-bold text-base leading-snug group-hover:underline"
                    style={{ color: 'var(--ink-on-dark)' }}
                  >
                    {club.name}
                  </h2>
                  <p className="mt-1 font-mono text-xs" style={{ color: 'var(--muted-on-dark)' }}>
                    {getFlagEmoji(club.countryCode)} {club.city}, {club.country}
                  </p>
                </div>

                {/* Stats */}
                <div className="mt-auto pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--navy-light)' }}>
                  <div>
                    <div className="font-mono font-bold text-lg" style={{ color: 'var(--aqua)' }}>
                      {club.memberCount}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                      Members
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-lg" style={{ color: 'var(--muted-on-dark)' }}>
                      {club.foundedYear}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--muted-on-dark)' }}>
                      Founded
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
