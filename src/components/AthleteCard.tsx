import { Link } from 'react-router-dom';
import type { Athlete } from '../types';
import { getFlagEmoji } from '../lib/utils';
import TransplantBadge from './TransplantBadge';

interface AthleteCardProps {
  athlete: Athlete;
}

export default function AthleteCard({ athlete }: AthleteCardProps) {
  const bestPB = athlete.personalBests[0];
  const flag = getFlagEmoji(athlete.countryCode);

  return (
    <Link
      to={`/athletes/${athlete.id}`}
      className="block p-5 transition-all duration-150 group"
      style={{
        textDecoration: 'none',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--aqua)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-mono text-sm font-bold"
          style={{ backgroundColor: 'var(--navy)', color: '#fff' }}
        >
          {athlete.avatarInitials || `${athlete.firstName[0]}${athlete.lastName[0]}`}
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="font-black text-lg leading-tight tracking-tight truncate"
            style={{ color: 'var(--ink)' }}
          >
            {athlete.firstName} {athlete.lastName}
          </div>
          <div className="mt-0.5 font-mono text-sm" style={{ color: 'var(--muted)' }}>
            {flag} {athlete.country}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="font-mono text-xs px-2 py-0.5"
              style={{ backgroundColor: 'var(--ice)', color: 'var(--muted)' }}
            >
              {athlete.ageGroup}
            </span>
            <TransplantBadge type={athlete.transplantType} />
          </div>
        </div>
      </div>

      {bestPB && (
        <div
          className="mt-4 pt-4 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="font-mono text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            {bestPB.event} · {bestPB.course}
          </span>
          <span className="font-mono font-bold text-sm" style={{ color: 'var(--blue)' }}>
            {bestPB.time}
          </span>
        </div>
      )}
    </Link>
  );
}
