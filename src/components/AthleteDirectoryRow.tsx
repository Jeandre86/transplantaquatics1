import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Athlete } from '../types';
import { getCountryAlpha3, getFlagEmoji } from '../lib/utils';
import { getSavedAvatar } from '../lib/avatars';
import TransplantBadge from './TransplantBadge';

function formatDateOfBirth(dateOfBirth: string) {
  const [year, month, day] = dateOfBirth.split('-');
  return `${day}/${month}/${year}`;
}

export default function AthleteDirectoryRow({ athlete, showCountryColumn = false }: { athlete: Athlete; showCountryColumn?: boolean }) {
  const initials = athlete.avatarInitials || `${athlete.firstName[0]}${athlete.lastName[0]}`;
  const image = getSavedAvatar(athlete.firstName, athlete.lastName);
  const gender = athlete.gender === 'Men' ? 'Male' : 'Female';

  return (
    <Link
      to={`/athletes/${athlete.id}`}
      className={`ta-table-row group grid items-center gap-4 px-5 py-5 no-underline ${showCountryColumn ? 'grid-cols-[100px_minmax(180px,1.5fr)_100px_145px_minmax(140px,1fr)_28px]' : 'grid-cols-[minmax(220px,1.5fr)_110px_145px_minmax(160px,1fr)_28px]'}`}
      aria-label={`View ${athlete.firstName} ${athlete.lastName}'s profile`}
    >
      {showCountryColumn && <span className="flex items-center gap-1.5 sm:gap-2" title={athlete.country}>
        <span className="ta-table-flag" aria-hidden="true">{getFlagEmoji(athlete.countryCode)}</span>
        <span className="font-mono text-xs font-semibold tracking-wider text-neutral-600">{getCountryAlpha3(athlete.countryCode)}</span>
      </span>}
      <span className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ice)] font-mono text-xs font-bold text-[var(--navy)]">
          {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-[var(--ink)] group-hover:text-[var(--accent-dark)]">{athlete.firstName} {athlete.lastName}</span>
          {!showCountryColumn && <span className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-[var(--muted)]" title={athlete.country}>
            <span className="ta-table-flag" aria-hidden="true">{getFlagEmoji(athlete.countryCode)}</span>
            <span className="font-semibold tracking-wider">{getCountryAlpha3(athlete.countryCode)}</span>
            <span className="sr-only">{athlete.country}</span>
          </span>}
        </span>
      </span>

      <span className="text-base text-[var(--ink)]">{gender}</span>
      <span className="font-mono text-sm text-[var(--muted)]">{formatDateOfBirth(athlete.dateOfBirth)}</span>
      <span><TransplantBadge type={athlete.transplantType} size="md" /></span>

      <span className="flex items-center justify-end gap-2 text-[var(--muted)] group-hover:text-[var(--accent-dark)]">
        <span className="text-xs uppercase leading-tight tracking-wider">View profile</span>
        <ArrowRight size={22} aria-hidden="true" />
      </span>
    </Link>
  );
}
