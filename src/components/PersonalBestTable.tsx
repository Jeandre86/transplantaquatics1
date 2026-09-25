import type { PersonalBest, Gender, AgeGroup } from '../types';
import VerificationBadge from './VerificationBadge';
import TimeStandard from './TimeStandard';
import { formatDate } from '../lib/utils';

interface PersonalBestTableProps {
  pbs: PersonalBest[];
  gender?: Gender;
  ageGroup?: AgeGroup;
}

export default function PersonalBestTable({ pbs, gender, ageGroup }: PersonalBestTableProps) {
  if (pbs.length === 0) {
    return <p className="text-sm text-neutral-500">No personal bests recorded.</p>;
  }

  const headers = ['Event', 'Course', 'Time', 'WTG', 'Date', 'Meet', 'Status'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            {headers.map(h => (
              <th
                key={h}
                className={`font-mono text-xs tracking-widest uppercase py-2 text-left text-neutral-400 ${
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
            <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="py-3 pr-4 font-medium text-sm text-black">{pb.event}</td>
              <td className="py-3 pr-4 font-mono text-xs text-neutral-500">{pb.course}</td>
              <td className="py-3 pr-4 text-right font-mono font-bold text-sm text-black">{pb.time}</td>
              <td className="py-3 pl-5 pr-4">
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
              <td className="py-3 pr-4 font-mono text-xs text-neutral-500">{formatDate(pb.date)}</td>
              <td className="py-3 pr-4 text-xs text-neutral-600 max-w-[180px] truncate">{pb.meet}</td>
              <td className="py-3"><VerificationBadge status={pb.verified} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
