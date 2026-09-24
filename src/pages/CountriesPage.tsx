import { useState } from 'react';
import { countries } from '../data/countries';
import { athletes } from '../data/athletes';
import type { Country } from '../types';
import CountryCard from '../components/CountryCard';
import AthleteCard from '../components/AthleteCard';
import SearchInput from '../components/SearchInput';
import Eyebrow from '../components/Eyebrow';
import { X } from 'lucide-react';

export default function CountriesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Country | null>(null);

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const countryAthletes = selected
    ? athletes.filter(a => a.countryCode === selected.code)
    : [];

  return (
    <div style={{ backgroundColor: 'var(--paper)' }}>
      <div style={{ backgroundColor: "var(--navy)" }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <Eyebrow light className="mb-3">Global</Eyebrow>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
            86 countries.
            <br />
            One pool.
          </h1>
          <p style={{ color: "var(--muted-on-dark)" }} className="mt-4 text-base max-w-xl">
            Transplant swimmers compete from every corner of the world.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-6 max-w-md">
          <SearchInput value={search} onChange={setSearch} placeholder="Search countries..." />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(c => (
            <CountryCard
              key={c.code}
              country={c}
              selected={selected?.code === c.code}
              onClick={() => setSelected(selected?.code === c.code ? null : c)}
            />
          ))}
        </div>

        {selected && (
          <div className="mt-10 border border-neutral-200 bg-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selected.flag}</span>
                <div>
                  <h2 className="font-black text-xl">{selected.name}</h2>
                  {selected.topAthlete && (
                    <div className="font-mono text-xs text-neutral-400 mt-0.5">
                      Top athlete: {selected.topAthlete}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-black"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-6">
              {countryAthletes.length > 0 ? (
                <>
                  <Eyebrow className="mb-4">Athletes from {selected.name}</Eyebrow>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {countryAthletes.map(a => (
                      <AthleteCard key={a.id} athlete={a} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-8 text-center font-mono text-sm text-neutral-400">
                  No athletes in the demo database for {selected.name}.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
