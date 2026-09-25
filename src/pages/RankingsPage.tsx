import { rankings } from '../data/rankings';
import { TRANSPLANT_TYPES } from '../types';
import RankingTable from '../components/RankingTable';
import Eyebrow from '../components/Eyebrow';
import { Link } from 'react-router-dom';
import { getFlagEmoji, getTransplantColor } from '../lib/utils';
import { getTransplantPoints } from '../lib/transplantPoints';
import TransplantCohortExplorer from '../components/TransplantCohortExplorer';

const GENDER_PREVIEW_SIZE = 5;

export default function RankingsPage() {
  const categoryRankings = rankings
    .sort((a, b) => {
      const pointsA = getTransplantPoints(a);
      const pointsB = getTransplantPoints(b);
      if (pointsA !== null && pointsB !== null && pointsA !== pointsB) return pointsB - pointsA;
      if (pointsA !== null && pointsB === null) return -1;
      if (pointsA === null && pointsB !== null) return 1;
      return a.rank - b.rank || a.athleteName.localeCompare(b.athleteName);
    });
  const rankPositions = new Map<string, number>();
  for (const group of ['Men', 'Women']) {
    categoryRankings.filter(r => r.gender === group).forEach((r, index) => {
      rankPositions.set([r.athleteId, r.ageGroup, r.gender, r.event, r.course].join('|'), index + 1);
    });
  }
  const menRankings = categoryRankings.filter(r => r.gender === 'Men');
  const womenRankings = categoryRankings.filter(r => r.gender === 'Women');

  return (
    <div>
      {/* Header */}
      <section style={{ backgroundColor: 'var(--navy)' }}>
        <div className="max-w-7xl mx-auto px-4 py-16">
          <Eyebrow color="accent" onDark>Official Rankings</Eyebrow>
          <h1 className="mt-4 font-bold text-5xl md:text-6xl" style={{ color: 'var(--ink-on-dark)' }}>World Rankings</h1>
          <p className="mt-4 max-w-2xl" style={{ color: 'var(--muted-on-dark)' }}>
            Official age-group rankings. Kidney, liver, heart, lung, pancreas and bone marrow transplant athletes compete together in the official ranking.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-1 uppercase tracking-wider" style={{ backgroundColor: 'var(--navy-mid)', color: 'var(--muted-on-dark)' }}>
              Age Group → Gender → Event → Course
            </span>
          </div>
        </div>
      </section>

      {/* Gender leaderboard previews */}
      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
            <div>
              <Eyebrow>Leaderboard</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Top swims by points</h2>
            </div>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8 xl:gap-12">
            <section>
              <RankingTable rankings={menRankings.slice(0, GENDER_PREVIEW_SIZE)} showVerified={false} rankByPoints rankPositions={rankPositions} showGap={false} genderCard showEventMeta={false} title="Men" />
              {menRankings.length > GENDER_PREVIEW_SIZE && (
                <Link to="/rankings/men" className="ml-auto mt-3 flex w-fit items-center gap-1 font-mono text-sm text-[#1769c2] hover:underline">
                  More <span aria-hidden="true">›</span>
                </Link>
              )}
            </section>
            <section>
              <RankingTable rankings={womenRankings.slice(0, GENDER_PREVIEW_SIZE)} showVerified={false} rankByPoints rankPositions={rankPositions} showGap={false} genderCard showEventMeta={false} title="Women" />
              {womenRankings.length > GENDER_PREVIEW_SIZE && (
                <Link to="/rankings/women" className="ml-auto mt-3 flex w-fit items-center gap-1 font-mono text-sm text-[#1769c2] hover:underline">
                  More <span aria-hidden="true">›</span>
                </Link>
              )}
            </section>
          </div>
        </div>
      </section>

      {/* Fastest by Transplant Type — Discovery */}
      <section style={{ backgroundColor: 'var(--navy-mid)', borderTop: '1px solid var(--navy-light)' }}>
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-8">
            <div>
              <Eyebrow>Discovery</Eyebrow>
              <h2 className="mt-2 font-bold text-3xl" style={{ color: 'var(--ink-on-dark)' }}>Fastest by Transplant Type</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {TRANSPLANT_TYPES.map(type => {
              const fastest = rankings.find(r => r.transplantType === type);
              return (
                <div key={type} className="p-4" style={{ backgroundColor: 'var(--navy)', border: '1px solid var(--navy-light)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getTransplantColor(type) }} />
                    <span className="font-mono text-xs uppercase tracking-widest truncate" style={{ color: 'var(--muted-on-dark)' }}>{type}</span>
                  </div>
                  {fastest ? (
                    <>
                      <Link to={`/athletes/${fastest.athleteId}`} className="font-bold text-sm leading-tight hover:underline block" style={{ color: 'var(--ink-on-dark)' }}>
                        {fastest.athleteName}
                      </Link>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted-on-dark)' }}>{getFlagEmoji(fastest.countryCode)}</div>
                      <div className="font-mono font-bold mt-2 text-base" style={{ color: 'var(--accent)' }}>{fastest.time}</div>
                      <div className="font-mono text-xs mt-0.5" style={{ color: 'var(--muted-on-dark)' }}>{fastest.event}</div>
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--muted-on-dark)' }}>No data</div>
                  )}
                </div>
              );
            })}
          </div>
          <Link
            to="/rankings/transplant-type"
            className="mt-8 inline-flex items-center gap-2 border border-[var(--accent)] px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--navy)]"
          >
            See my transplant ranking <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <TransplantCohortExplorer />
    </div>
  );
}
