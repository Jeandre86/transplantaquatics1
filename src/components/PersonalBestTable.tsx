import type { PersonalBest, Gender, AgeGroup } from '../types';
import VerificationBadge from './VerificationBadge';
import TimeStandard from './TimeStandard';
import { formatDate } from '../lib/utils';
import EmptyState from './EmptyState';

interface PersonalBestTableProps {
  pbs: PersonalBest[];
  gender?: Gender;
  ageGroup?: AgeGroup;
}

export default function PersonalBestTable({ pbs, gender, ageGroup }: PersonalBestTableProps) {
  if (pbs.length === 0) {
    return <EmptyState title="No personal bests recorded" subtitle="Personal best times will appear here when they are added to this profile." />;
  }

  const headers = ['Event', 'Course', 'Time', 'WTG', 'Date', 'Meet', 'Status'];

  return (
    <div className="ta-table-shell overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="ta-table-header">
            {headers.map(h => (
              <th
                key={h}
                className={`font-mono text-[10px] font-semibold tracking-widest uppercase py-3 text-left px-3 sm:px-5 ${
                  h === 'Time' ? 'text-right pr-4' : h === 'WTG' ? 'pl-5' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pbs.map((pb, i) => (
            <tr key={i} className="ta-table-row">
              <td className="px-3 py-4 font-medium text-base text-[var(--ink)] sm:px-5">{pb.event}</td>
              <td className="px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{pb.course}</td>
              <td className="px-3 py-4 text-right font-mono font-bold text-base text-[var(--navy)] sm:px-5">{pb.time}</td>
              <td className="px-3 py-4 sm:px-5">
                {gender && (
                  <TimeStandard
                    time={pb.time}
                    event={pb.event}
                    course={pb.course}
                    gender={gender}
                    ageGroup={ageGroup}
                  />
                )}
              </td>
              <td className="px-3 py-4 font-mono text-xs text-[var(--muted)] sm:px-5">{formatDate(pb.date)}</td>
              <td className="px-3 py-4 text-xs text-[var(--muted)] max-w-[180px] truncate sm:px-5">{pb.meet}</td>
              <td className="px-3 py-4 sm:px-5"><VerificationBadge status={pb.verified} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
