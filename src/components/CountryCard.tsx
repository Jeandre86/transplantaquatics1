import type { Country } from '../types';

interface CountryCardProps {
  country: Country;
  onClick?: () => void;
  selected?: boolean;
}

export default function CountryCard({ country, onClick, selected = false }: CountryCardProps) {
  return (
    <div
      onClick={onClick}
      className={`border p-5 cursor-pointer transition-all duration-150 ${
        selected
          ? 'border-neutral-400 text-white'
          : 'border-neutral-200 hover:border-neutral-400'
      }`}
      style={{ backgroundColor: selected ? 'var(--navy-light)' : 'var(--navy-mid)' }}
    >
      <div className="text-3xl mb-2">{country.flag}</div>
      <div className="font-bold text-base leading-tight text-white">
        {country.name}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 border-neutral-200">
        <div className="text-center">
          <div className="font-mono font-bold text-sm text-white">{country.athletes}</div>
          <div className="font-mono text-xs mt-0.5 text-neutral-400">Athletes</div>
        </div>
        <div className="text-center">
          <div className="font-mono font-bold text-sm text-white">{country.results.toLocaleString()}</div>
          <div className="font-mono text-xs mt-0.5 text-neutral-400">Results</div>
        </div>
        <div className="text-center">
          <div className="font-mono font-bold text-sm text-white">{country.records}</div>
          <div className="font-mono text-xs mt-0.5 text-neutral-400">Records</div>
        </div>
      </div>
    </div>
  );
}
