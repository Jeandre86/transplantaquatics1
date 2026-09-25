import { Link } from 'react-router-dom';
import { athletes } from '../data/athletes';
import { results } from '../data/results';
import type { Athlete, Gender, Ranking, Result } from '../types';
import { timeToSeconds } from '../lib/utils';
import { getTransplantPoints } from '../lib/transplantPoints';
import RankingTable from './RankingTable';

const PREVIEW_SIZE = 5;

function bestVerifiedSwims(gender: Gender): Ranking[] {
  const athleteById = new Map<string, Athlete>(athletes.map(athlete => [athlete.id, athlete]));
  const bestByEvent = new Map<string, Result>();

  for (const result of results) {
    if (result.gender !== gender || result.verified !== 'Verified' || result.course !== 'LCM') continue;
    const key = [result.athleteId, result.ageGroup, result.gender, result.event, result.course].join('|');
    const previous = bestByEvent.get(key);
    if (!previous || timeToSeconds(result.time) < timeToSeconds(previous.time)) bestByEvent.set(key, result);
  }

  return [...bestByEvent.values()]
    .map(result => ({ result, athlete: athleteById.get(result.athleteId), points: getTransplantPoints(result) }))
    .filter((entry): entry is typeof entry & { athlete: Athlete; points: number } => Boolean(entry.athlete && entry.points !== null))
    .sort((a, b) => b.points - a.points || timeToSeconds(a.result.time) - timeToSeconds(b.result.time))
    .map(({ result, athlete, points }, index) => ({
      rank: index + 1,
      athleteId: athlete.id,
      athleteName: `${athlete.firstName} ${athlete.lastName}`,
      country: athlete.country,
      countryCode: athlete.countryCode,
      ageGroup: result.ageGroup,
      gender: result.gender,
      event: result.event,
      course: result.course,
      time: result.time,
      transplantType: athlete.transplantType,
      date: result.date,
      points,
    }));
}

function TopSwimsCard({ gender, swims }: { gender: Gender; swims: Ranking[] }) {
  const visibleSwims = swims.slice(0, PREVIEW_SIZE);

  return (
    <section>
      <RankingTable
        rankings={visibleSwims}
        showVerified={false}
        rankByPoints
        showGap={false}
        genderCard
        showEventMeta={false}
        title={gender}
      />
      {swims.length > PREVIEW_SIZE && (
        <Link to={`/results/${gender.toLowerCase()}`} className="ml-auto mt-3 flex w-fit items-center gap-1 font-mono text-sm text-[#1769c2] hover:underline">
          More <span aria-hidden="true">›</span>
        </Link>
      )}
    </section>
  );
}

export default function TopSwimsSection() {
  const menSwims = bestVerifiedSwims('Men');
  const womenSwims = bestVerifiedSwims('Women');

  return (
    <section className="mb-12" aria-labelledby="top-swims-heading">
      <div className="mb-5">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TA points · verified long-course results</p>
        <h2 id="top-swims-heading" className="mt-2 text-2xl font-black tracking-tight text-neutral-900">Top swims</h2>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8 xl:gap-12">
        <TopSwimsCard gender="Men" swims={menSwims} />
        <TopSwimsCard gender="Women" swims={womenSwims} />
      </div>
    </section>
  );
}
