import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Athlete } from '../types';
import { getFlagEmoji } from '../lib/utils';
import TransplantBadge from './TransplantBadge';

const COUNTRY_ALPHA3: Record<string, string> = {
  ZA: 'ZAF', GB: 'GBR', US: 'USA', AU: 'AUS', CA: 'CAN', DE: 'DEU', FR: 'FRA',
  NL: 'NLD', BR: 'BRA', JP: 'JPN', NZ: 'NZL', SE: 'SWE', IT: 'ITA', ES: 'ESP',
  IL: 'ISR', PL: 'POL', NO: 'NOR', DK: 'DNK', IE: 'IRL', PT: 'PRT',
};

function formatDateOfBirth(dateOfBirth: string) {
  const [year, month, day] = dateOfBirth.split('-');
  return `${day}/${month}/${year}`;
}

export default function AthleteDirectoryRow({ athlete, index }: { athlete: Athlete; index: number }) {
  const initials = athlete.avatarInitials || `${athlete.firstName[0]}${athlete.lastName[0]}`;
  const gender = athlete.gender === 'Men' ? 'Male' : 'Female';

  return (
    <Link
      to={`/athletes/${athlete.id}`}
      className={`group grid grid-cols-[76px_minmax(0,1fr)_28px] items-center gap-3 border-b border-neutral-200 px-3 py-5 no-underline transition-colors sm:grid-cols-[92px_minmax(140px,1.5fr)_90px_minmax(130px,1fr)_28px] sm:gap-4 sm:px-5 md:grid-cols-[98px_minmax(160px,1.5fr)_100px_145px_minmax(140px,1fr)_28px] lg:grid-cols-[110px_minmax(200px,1.7fr)_110px_155px_minmax(160px,1fr)_28px] ${index % 2 === 1 ? 'bg-[#f7f8fa]' : 'bg-white'}`}
      aria-label={`View ${athlete.firstName} ${athlete.lastName}'s profile`}
    >
      <span className="flex items-center gap-1.5 sm:gap-2" title={athlete.country}>
        <span className="text-3xl leading-none" aria-hidden="true">{getFlagEmoji(athlete.countryCode)}</span>
        <span className="font-mono text-xs font-semibold tracking-wider text-neutral-600 sm:text-sm">{COUNTRY_ALPHA3[athlete.countryCode] ?? athlete.countryCode}</span>
      </span>

      <span className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef0f2] font-mono text-[10px] font-bold text-[#334155] sm:h-11 sm:w-11 sm:text-xs">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-medium text-[#303846] group-hover:text-[#1769c2] sm:text-lg">{athlete.firstName} {athlete.lastName}</span>
          <span className="mt-1 block truncate font-mono text-xs text-neutral-600 sm:hidden">{gender} · {formatDateOfBirth(athlete.dateOfBirth)} · {athlete.transplantType}</span>
        </span>
      </span>

      <span className="hidden text-base text-[#4b5563] sm:block">{gender}</span>
      <span className="hidden font-mono text-base text-[#4b5563] md:block">{formatDateOfBirth(athlete.dateOfBirth)}</span>
      <span className="hidden sm:block"><TransplantBadge type={athlete.transplantType} size="md" /></span>

      <span className="flex items-center justify-end gap-2 text-neutral-400 group-hover:text-[#1769c2]">
        <span className="hidden text-xs uppercase leading-tight tracking-wider sm:block">View<br />profile</span>
        <ArrowRight size={22} aria-hidden="true" />
      </span>
    </Link>
  );
}
