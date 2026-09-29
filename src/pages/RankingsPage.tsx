import { useEffect, useState } from 'react';
import { TRANSPLANT_TYPES } from '../types';
import type { Ranking } from '../types';
import RankingTable from '../components/RankingTable';
import Eyebrow from '../components/Eyebrow';
import { Link } from 'react-router-dom';
import { getTransplantColor, timeToSeconds } from '../lib/utils';
import { getTransplantPoints } from '../lib/transplantPoints';
import TransplantCohortExplorer from '../components/TransplantCohortExplorer';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import { useFastestByTransplantType } from '../hooks/useFastestByTransplantType';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { Skeleton, SkeletonTable } from '../components/Skeleton';

const GENDER_PREVIEW_SIZE = 5;

export default function RankingsPage() {
  const { swims: fastestSwims, loading: fastestLoading, error: fastestError } = useFastestByTransplantType();
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingsError, setRankingsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadDatabaseRankings()
      .then(rows => { if (active) setRankings(rows); })
      .catch(error => { if (active) setRankingsError(describeSupabaseError(error)); })
      .finally(() => { if (active) setRankingsLoading(false); });
    return () => { active = false; };
  }, []);

  const categoryRankings = [...rankings]
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
      <PageHeading eyebrow="Leaderboard" title="World Rankings" description="Explore transplant swimming performances by points, time, age group, gender, event and course." />

      {/* Gender leaderboard previews */}
      <section style={{ backgroundColor: '#f4f2ed' }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
            <div>
              <Eyebrow>Leaderboard</Eyebrow>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">Top swims</h2>
            </div>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8 xl:gap-12">
            <section>
              {rankingsLoading ? (
                <SkeletonTable rows={5} columns={5} />
              ) : rankingsError ? (
                <p role="status" className="py-8 text-center text-sm text-red-700">Rankings could not be loaded: {rankingsError}</p>
              ) : (
                <RankingTable rankings={menRankings.slice(0, GENDER_PREVIEW_SIZE)} showVerified={false} rankByPoints rankPositions={rankPositions} showGap={false} genderCard showEventMeta={false} paperSurface title="Men" />
              )}
              {menRankings.length > GENDER_PREVIEW_SIZE && (
                <Link to="/rankings/men" className="ml-auto mt-3 flex w-fit items-center gap-1 font-mono text-sm text-[var(--accent-dark)] hover:underline">
                  More <span aria-hidden="true">›</span>
                </Link>
              )}
            </section>
            <section>
              {rankingsLoading ? (
                <SkeletonTable rows={5} columns={5} />
              ) : rankingsError ? (
                <p role="status" className="py-8 text-center text-sm text-red-700">Rankings could not be loaded: {rankingsError}</p>
              ) : womenRankings.length === 0 ? (
                <div className="ta-table-shell ta-table-shell-paper">
                  <h3 className="px-4 pt-4 text-xl font-semibold text-[var(--ink)]">Women</h3>
                  <div className="px-4 pt-3">
                    <EmptyState title="No women’s swims yet" subtitle="Women’s rankings will appear here when results are added." />
                  </div>
                </div>
              ) : (
                <RankingTable rankings={womenRankings.slice(0, GENDER_PREVIEW_SIZE)} showVerified={false} rankByPoints rankPositions={rankPositions} showGap={false} genderCard showEventMeta={false} paperSurface title="Women" />
              )}
              {womenRankings.length > GENDER_PREVIEW_SIZE && (
                <Link to="/rankings/women" className="ml-auto mt-3 flex w-fit items-center gap-1 font-mono text-sm text-[var(--accent-dark)] hover:underline">
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
              const fastest = fastestSwims
                .filter(swim => swim.transplantType === type)
                .sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time))[0];
              return (
                <div key={type} className="p-4" style={{ backgroundColor: 'var(--navy)', border: '1px solid var(--navy-light)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getTransplantColor(type) }} />
                    <span className="font-mono text-xs uppercase tracking-widest truncate" style={{ color: 'var(--muted-on-dark)' }}>{type}</span>
                  </div>
                  {fastestLoading ? <div className="space-y-2 py-1"><Skeleton dark className="h-3 w-3/4" /><Skeleton dark className="h-5 w-2/3" /></div> : fastestError ? <div className="text-xs" style={{ color: 'var(--muted-on-dark)' }}>Unable to load</div> : fastest ? (
                    <div className="space-y-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--accent)' }}>{fastest.event} · {fastest.gender}{fastest.course ? ` · ${fastest.course}` : ''}</div>
                        <div className="mt-1 flex items-baseline justify-between gap-2"><Link to={`/athletes/${fastest.athleteId}`} className="truncate text-sm font-bold hover:underline" style={{ color: 'var(--ink-on-dark)' }}>{fastest.athleteName}</Link><span className="shrink-0 font-mono text-sm font-bold" style={{ color: 'var(--ink-on-dark)' }}>{fastest.time}</span></div>
                        {fastest.status === 'swimmer_submitted' && <div className="mt-1 font-mono text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted-on-dark)' }}>Pending verification</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--muted-on-dark)' }}>No submitted swims</div>
                  )}
                </div>
              );
            })}
          </div>
          {fastestError && <p role="status" className="mt-4 text-sm text-red-200">Fastest swims could not be loaded: {fastestError}</p>}
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
