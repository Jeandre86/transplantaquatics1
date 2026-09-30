import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChartNoAxesCombined, ClipboardList, Goal, MapPin, Trophy, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getFlagEmoji, timeToSeconds } from '../lib/utils';
import Button from '../components/Button';
import { loadAthleteGoals, type AthleteGoal } from '../lib/athleteGoals';
import { loadMyAccountResults, loadPublicSubmittedResults, type SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import { Skeleton, SkeletonTable } from '../components/Skeleton';
import DatabaseResultsTable from '../components/DatabaseResultsTable';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import type { Ranking } from '../types';

const RANKING_PREVIEW_SIZE = 4;

function buildOwnEventRankings(results: SubmittedSwimmerResult[], rankings: Ranking[]) {
  const personalBests = new Map<string, SubmittedSwimmerResult>();
  for (const result of results) {
    const course = result.submitted_meets?.course;
    if (!result.swimmer_id || !course || result.status === 'rejected') continue;
    if (!result.current_age_group) continue;
    const key = [result.swimmer_id, result.event, result.gender, course].join('|');
    const current = personalBests.get(key);
    if (!current || timeToSeconds(result.time) < timeToSeconds(current.time)) personalBests.set(key, result);
  }

  return [...personalBests.values()].map(result => {
    const course = result.submitted_meets?.course ?? '';
    const eventRankings = rankings.filter(ranking => ranking.event === result.event
      && ranking.ageGroup === result.current_age_group
      && ranking.gender === result.gender
      && ranking.course === course);
    const ownTime = timeToSeconds(result.time);
    const rank = eventRankings.filter(ranking => timeToSeconds(ranking.time) < ownTime).length + 1;
    return { result, rank };
  }).sort((a, b) => a.result.swimmer_name.localeCompare(b.result.swimmer_name)
    || a.result.event.localeCompare(b.result.event)
    || (a.result.submitted_meets?.course ?? '').localeCompare(b.result.submitted_meets?.course ?? ''));
}

function DashboardCard({
  eyebrow,
  title,
  icon: Icon,
  children,
  className = '',
}: {
  eyebrow?: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex items-start gap-3 border-b border-[var(--border)] pb-4">
        <span className="flex size-9 shrink-0 items-center justify-center bg-[var(--paper)] text-[var(--blue)]">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div>
          {eyebrow && <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{eyebrow}</p>}
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[var(--ink)]">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [personalGoals, setPersonalGoals] = useState<AthleteGoal[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [goalsLoadFailed, setGoalsLoadFailed] = useState(false);
  const [submittedResults, setSubmittedResults] = useState<SubmittedSwimmerResult[]>([]);
  const [resultsLoaded, setResultsLoaded] = useState(false);
  const [resultsLoadFailed, setResultsLoadFailed] = useState(false);
  const [databaseRankings, setDatabaseRankings] = useState<Ranking[]>([]);
  const [rankingsLoaded, setRankingsLoaded] = useState(false);
  const [rankingsLoadFailed, setRankingsLoadFailed] = useState(false);
  const [rankingCourse, setRankingCourse] = useState<'LCM' | 'SCM'>('LCM');
  const [worldResults, setWorldResults] = useState<SubmittedSwimmerResult[]>([]);
  const [worldResultsLoaded, setWorldResultsLoaded] = useState(false);
  const [worldResultsLoadFailed, setWorldResultsLoadFailed] = useState(false);

  useEffect(() => {
    if (!auth.isLoading && !auth.isLoggedIn) navigate('/login', { replace: true });
  }, [auth.isLoading, auth.isLoggedIn, navigate]);

  useEffect(() => {
    let cancelled = false;
    if (!auth.isLoggedIn) return () => { cancelled = true; };
    setGoalsLoaded(false);
    setGoalsLoadFailed(false);
    loadAthleteGoals().then(goals => {
      if (!cancelled) setPersonalGoals(goals);
    }).catch(() => {
      if (!cancelled) {
        setPersonalGoals([]);
        setGoalsLoadFailed(true);
      }
    }).finally(() => {
      if (!cancelled) setGoalsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [auth.isLoggedIn]);

  useEffect(() => {
    let cancelled = false;
    if (!auth.isLoggedIn) return () => { cancelled = true; };
    setWorldResultsLoaded(false);
    setWorldResultsLoadFailed(false);
    loadPublicSubmittedResults().then(rows => {
      if (!cancelled) setWorldResults(rows);
    }).catch(() => {
      if (!cancelled) {
        setWorldResults([]);
        setWorldResultsLoadFailed(true);
      }
    }).finally(() => { if (!cancelled) setWorldResultsLoaded(true); });
    return () => { cancelled = true; };
  }, [auth.isLoggedIn]);

  useEffect(() => {
    let cancelled = false;
    if (!auth.isLoggedIn) return () => { cancelled = true; };
    setRankingsLoaded(false);
    setRankingsLoadFailed(false);
    loadDatabaseRankings().then(rows => {
      if (!cancelled) setDatabaseRankings(rows);
    }).catch(() => {
      if (!cancelled) {
        setDatabaseRankings([]);
        setRankingsLoadFailed(true);
      }
    }).finally(() => { if (!cancelled) setRankingsLoaded(true); });
    return () => { cancelled = true; };
  }, [auth.isLoggedIn]);

  useEffect(() => {
    let cancelled = false;
    if (!auth.isLoggedIn) return () => { cancelled = true; };
    setResultsLoaded(false);
    setResultsLoadFailed(false);
    loadMyAccountResults().then(items => {
      if (!cancelled) setSubmittedResults(items);
    }).catch(() => {
      if (!cancelled) {
        setSubmittedResults([]);
        setResultsLoadFailed(true);
      }
    }).finally(() => { if (!cancelled) setResultsLoaded(true); });
    return () => { cancelled = true; };
  }, [auth.isLoggedIn]);

  const user = auth.user;
  if (auth.isLoading || !user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const profileFields = [user.firstName, user.lastName, user.country, user.countryCode, user.transplantType, user.ageGroup, user.gender, user.primaryEvent];
  const completedFields = profileFields.filter(value => Boolean(value?.trim())).length;
  const completeness = Math.round((completedFields / profileFields.length) * 100);
  const flag = user.countryCode ? getFlagEmoji(user.countryCode) : '';
  const countryLabel = user.country || user.countryCode || 'Not added yet';
  const ownEventRankings = buildOwnEventRankings(submittedResults, databaseRankings);
  const rankedEventCount = ownEventRankings.filter(item => item.rank !== null).length;
  const bestEventRank = ownEventRankings.reduce<number | null>((best, item) => item.rank !== null && (best === null || item.rank < best) ? item.rank : best, null);
  const courseEventRankings = ownEventRankings.filter(({ result }) => result.submitted_meets?.course === rankingCourse);
  const visibleOwnEventRankings = courseEventRankings.slice(0, RANKING_PREVIEW_SIZE);
  return (
    <div className="min-h-full bg-[var(--paper)]">
      <section className="ta-page-top text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-12">
          <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Dashboard</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Hey, {user.firstName || 'there'} 👋</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
              A quick overview of your activity, progress, and what’s next.
            </p>
          </div>
          <div className="flex items-center gap-4 self-start sm:self-center">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-[var(--navy-light)] text-base font-bold text-white">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.avatarInitials}
            </div>
            <div>
              <p className="font-semibold text-white">{fullName}</p>
              <p className="mt-0.5 text-sm text-white/55">{user.email}</p>
              <Link to="/profile" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline">View profile <ArrowRight size={12} /></Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        {user.accountRole === 'coach' && <Link to="/coach/club" className="flex flex-wrap items-center justify-between gap-3 bg-[var(--navy)] px-5 py-4 text-white transition-colors hover:bg-[var(--navy-light)] sm:px-6"><span><span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">Coach workspace</span><span className="mt-1 block font-semibold">Create or manage your club</span></span><ArrowRight size={18} className="text-[var(--accent)]" /></Link>}
        <section className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Profile details', value: `${completeness}%`, detail: completeness === 100 ? 'Complete' : 'Complete your details' },
            { label: 'My results', value: resultsLoaded ? String(submittedResults.length) : '—', detail: !resultsLoaded ? 'Loading results' : resultsLoadFailed ? 'Results unavailable' : `${submittedResults.length} submitted result${submittedResults.length === 1 ? '' : 's'}` },
            { label: 'My goals', value: goalsLoaded ? String(personalGoals.length) : '—', detail: !goalsLoaded ? 'Loading goals' : goalsLoadFailed ? 'Goals unavailable' : personalGoals.length ? `${personalGoals.length} active target${personalGoals.length === 1 ? '' : 's'}` : 'No goals set yet' },
            { label: 'My ranking', value: !resultsLoaded || !rankingsLoaded || resultsLoadFailed || rankingsLoadFailed ? '—' : bestEventRank === null ? '—' : `#${bestEventRank}`, detail: !resultsLoaded || !rankingsLoaded ? 'Loading ranking' : resultsLoadFailed || rankingsLoadFailed ? 'Ranking unavailable' : rankedEventCount ? `Best of ${rankedEventCount} event ranking${rankedEventCount === 1 ? '' : 's'}` : 'Add results to calculate a ranking' },
          ].map(item => (
            <div key={item.label} className="bg-white px-5 py-5 sm:px-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{item.label}</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{item.label === 'My results' && !resultsLoaded || item.label === 'My goals' && !goalsLoaded || item.label === 'My ranking' && (!resultsLoaded || !rankingsLoaded) ? <Skeleton className="mt-2 h-8 w-16" /> : item.value}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{item.label === 'My results' && !resultsLoaded || item.label === 'My goals' && !goalsLoaded || item.label === 'My ranking' && (!resultsLoaded || !rankingsLoaded) ? <Skeleton className="h-3 w-28" /> : item.detail}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6">
          <DashboardCard eyebrow="Coming up" title="World Transplant Games" icon={Trophy}>
            <div className="flex flex-col justify-center gap-5 sm:flex-row sm:items-stretch">
              <div className="flex min-w-0 flex-1 flex-col items-start justify-center py-1">
                <span className="inline-flex items-center gap-1.5 border border-[var(--accent)]/40 bg-[var(--ice)] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--navy)]">
                  <MapPin size={12} /> Leuven, Belgium
                </span>
                <p className="mt-3 text-4xl font-black leading-none tracking-tight text-[var(--ink)]">2027</p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted)]">The transplant swimming community meets in Leuven for the next World Transplant Games.</p>
                <Link to="/games" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--blue)] hover:text-[var(--accent-dark)]">Explore the Games <ArrowRight size={15} /></Link>
              </div>
              <div className="flex w-full shrink-0 flex-col justify-center border-l-4 border-[var(--accent)] bg-[var(--navy)] px-4 py-5 text-white sm:w-1/2">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">Next World Transplant Games</p>
                <p className="mt-3 text-2xl font-bold text-[var(--accent)]">Leuven · 2027</p>
                <p className="mt-2 text-xs text-white/65">Event dates will be added when confirmed.</p>
              </div>
            </div>
          </DashboardCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardCard eyebrow="Performance" title="My results" icon={ClipboardList}>
            <div className="flex min-h-36 flex-col items-start">
              {!resultsLoaded ? <SkeletonTable rows={3} columns={3} /> : submittedResults.length ? <div className="w-full divide-y divide-[var(--border)]">
                {submittedResults.slice(0, 4).map(result => <div key={result.id} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--ink)]">{result.swimmer_name} · {result.event}</p><p className="mt-1 truncate text-xs text-[var(--muted)]">{result.submitted_meets?.name || 'Meet'} · {result.age_group} · {result.submitted_meets?.course || 'Course'}</p></div>
                  <span className="font-mono text-sm font-bold text-[var(--blue)]">{result.time}</span>
                  <span className={`w-fit px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${result.record_candidate ? 'bg-amber-50 text-amber-800' : 'bg-[var(--ice)] text-[var(--navy)]'}`}>{result.record_candidate ? 'Record candidate' : result.status === 'verified' ? 'Verified' : 'Swimmer-submitted'}</span>
                </div>)}
              </div> : <div className="flex flex-1 flex-col justify-center"><p className="font-semibold text-[var(--ink)]">{resultsLoadFailed ? 'Your results could not be loaded' : 'Start with your next meet'}</p><p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--muted)]">{resultsLoadFailed ? 'Check the meet submission tables in Supabase and try refreshing.' : 'Add a meet and record each event your swimmer competed in. Results show as swimmer-submitted immediately.'}</p></div>}
              <Link to="/submit" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] transition-colors hover:text-[var(--accent-dark)]">Submit results <ArrowRight size={15} /></Link>
            </div>
          </DashboardCard>

          <DashboardCard eyebrow="Training" title="My goals" icon={Goal}>
            <div className="flex min-h-36 flex-col items-start">
              {!goalsLoaded ? <SkeletonTable rows={3} columns={3} /> : personalGoals.length ? <div className="w-full divide-y divide-[var(--border)]">
                {personalGoals.slice(0, 3).map(goal => <div key={goal.id} className="flex items-center justify-between gap-4 py-3 first:pt-0"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--ink)]">{goal.event} <span className="font-mono text-xs font-normal text-[var(--muted)]">· {goal.course}</span></p><p className="mt-1 text-xs text-[var(--muted)]">Target time</p></div><span className="shrink-0 font-mono text-lg font-bold text-[var(--blue)]">{goal.targetTime}</span></div>)}
              </div> : <div className="flex flex-1 flex-col justify-center"><p className="font-semibold text-[var(--ink)]">{goalsLoadFailed ? 'Goal data is unavailable' : 'Set a target for your next swim'}</p><p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--muted)]">{goalsLoadFailed ? 'Check the Supabase goals table setup from your Goals tab.' : 'Your personal swim goals will appear here.'}</p></div>}
              <Link to="/profile" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">{personalGoals.length ? 'Manage goals' : 'Set your first goal'} <ArrowRight size={15} /></Link>
            </div>
          </DashboardCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <DashboardCard eyebrow="Your account" title="Profile snapshot" icon={UserRound} className="lg:col-span-3">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Country</p><p className="mt-1 text-sm font-semibold text-[var(--ink)]">{flag} {countryLabel}</p></div>
              <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Transplant type</p><p className="mt-1 text-sm font-semibold text-[var(--ink)]">{user.transplantType || 'Not added yet'}</p></div>
              <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Club</p><p className="mt-1 text-sm font-semibold text-[var(--ink)]">{user.club || 'Not added yet'}</p></div>
            </div>
            <Link to="/profile" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">Manage your profile <ArrowRight size={15} /></Link>
          </DashboardCard>

          <DashboardCard eyebrow="Your standing" title="Rankings" icon={ChartNoAxesCombined} className="lg:col-span-2">
            <div className="min-h-52">
              {!resultsLoaded || !rankingsLoaded ? <SkeletonTable rows={4} columns={4} />
                : resultsLoadFailed || rankingsLoadFailed ? <p role="status" className="py-8 text-sm text-[var(--muted)]">Your event rankings could not be loaded. Please refresh to try again.</p>
                  : ownEventRankings.length ? <>
                    <div role="tablist" aria-label="Ranking course" className="mb-4 flex border-b border-[var(--border)]">
                      {(['LCM', 'SCM'] as const).map(course => <button key={course} type="button" role="tab" aria-selected={rankingCourse === course} onClick={() => setRankingCourse(course)} className={`border-b-2 px-4 py-2.5 font-mono text-xs font-bold tracking-widest transition-colors ${rankingCourse === course ? 'border-[var(--blue)] text-[var(--blue)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>{course}</button>)}
                    </div>
                    {courseEventRankings.length ? <>
                    <p className="mb-3 text-sm text-[var(--muted)]">Your best time and world position for each event you’ve swum.</p>
                    <div className="ta-table-shell">
                      <div className="ta-table-header grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] gap-3 px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest sm:px-4">
                        <span>Rank</span><span>Event</span><span>Age</span><span>Time</span><span>Pts</span>
                      </div>
                      {visibleOwnEventRankings.map(({ result, rank }) => <Link key={`${result.swimmer_id}-${result.event}-${result.gender}-${result.submitted_meets?.course}`} to={`/rankings/${result.gender.toLowerCase()}?ageGroup=${encodeURIComponent(result.current_age_group ?? '')}&event=${encodeURIComponent(result.event)}&course=${encodeURIComponent(rankingCourse)}&rankBy=Time`} className="ta-table-row grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--paper)] sm:px-4">
                        <span className="whitespace-nowrap font-mono text-sm font-bold text-[var(--ink)]">{rank === null ? '—' : `#${rank}`}</span>
                        <span className="min-w-0 truncate text-sm font-semibold text-[var(--ink)]">{result.event}</span>
                        <span className="whitespace-nowrap text-xs text-[var(--muted)]">{result.current_age_group}</span>
                        <span className="whitespace-nowrap font-mono text-sm font-bold text-[var(--blue)]">{result.time}</span>
                        <span className="whitespace-nowrap font-mono text-xs text-[var(--muted)]">{result.points ?? '—'}</span>
                      </Link>)}
                    </div>
                    {courseEventRankings.length > RANKING_PREVIEW_SIZE && <p className="mt-3 text-xs text-[var(--muted)]">Showing {RANKING_PREVIEW_SIZE} of {courseEventRankings.length} {rankingCourse} events.</p>}
                    <Link to="/rankings" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">Explore more rankings <ArrowRight size={15} /></Link>
                    </> : <div className="py-8 text-center"><p className="font-semibold text-[var(--ink)]">No {rankingCourse} rankings yet</p><p className="mt-1 text-sm text-[var(--muted)]">Your {rankingCourse} event rankings will appear here when results are added.</p></div>}
                  </> : <div className="flex min-h-36 flex-col items-start justify-center"><p className="font-semibold text-[var(--ink)]">Your event rankings will appear here</p><p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Submit a swim result to see your best time, points, and world position for each event.</p><Link to="/submit" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">Submit results <ArrowRight size={15} /></Link></div>}
            </div>
          </DashboardCard>
        </div>

        <section className="flex flex-col gap-4 bg-[var(--navy)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center bg-white/10 text-[var(--accent)]"><CalendarDays size={19} /></span>
            <div>
              <p className="font-semibold">Plan your next competition</p>
              <p className="mt-1 text-sm text-white/60">Browse upcoming meets and find an event that suits you.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/calendar')}>
            Explore meet calendar <ArrowRight size={15} />
          </Button>
        </section>

        <DashboardCard eyebrow="Public competition results" title="World Results" icon={Trophy}>
          {!worldResultsLoaded ? <SkeletonTable rows={3} columns={2} />
            : worldResultsLoadFailed ? <div className="flex flex-wrap items-center justify-between gap-4"><p role="status" className="text-sm text-[var(--muted)]">World results could not be loaded. Please refresh to try again.</p><Link to="/results" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">Browse results <ArrowRight size={15} /></Link></div>
              : worldResults.length ? <>
                <DatabaseResultsTable results={worldResults.slice(0, 4)} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--muted)]">Showing {Math.min(4, worldResults.length)} of {worldResults.length} public result{worldResults.length === 1 ? '' : 's'}.</p><Link to="/results" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">Browse all results <ArrowRight size={15} /></Link></div>
              </> : <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-[var(--muted)]">No public competition results have been added yet.</p><Link to="/results" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">Browse results <ArrowRight size={15} /></Link></div>}
        </DashboardCard>

      </div>
    </div>
  );
}
