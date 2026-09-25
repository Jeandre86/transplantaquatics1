import type { Country } from '../types';
import { Link } from 'react-router-dom';

interface CountryCardProps {
  country: Country;
  onClick?: () => void;
  to?: string;
  selected?: boolean;
}

export default function CountryCard({ country, onClick, to, selected = false }: CountryCardProps) {
  const className = `block border p-5 transition-all duration-150 ${
    to || onClick ? 'cursor-pointer' : ''
  } ${
    selected
      ? 'border-neutral-400 text-white'
      : 'border-neutral-200 hover:border-neutral-400'
  }`;
  const style = { backgroundColor: selected ? 'var(--navy-light)' : 'var(--navy-mid)' };
  const content = (
    <>
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
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} style={style}>
        {content}
      </Link>
    );
  }

  return (
    <div
      onClick={onClick}
      onKeyDown={event => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={className}
      style={style}
    >
      {content}
    </div>
  );
}
