import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChartNoAxesCombined, ClipboardList, Goal, MapPin, Trophy, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getFlagEmoji } from '../lib/utils';
import Button from '../components/Button';
import { loadAthleteGoals, type AthleteGoal } from '../lib/athleteGoals';
import { loadMySubmittedResults, type SubmittedSwimmerResult } from '../lib/swimmerSubmissions';
import { Skeleton, SkeletonTable } from '../components/Skeleton';

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
    setResultsLoaded(false);
    setResultsLoadFailed(false);
    loadMySubmittedResults().then(items => {
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

  return (
    <div className="min-h-full bg-[var(--paper)]">
      <section className="bg-[var(--navy)] text-white">
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
            { label: 'My ranking', value: '—', detail: 'Available when results are linked' },
          ].map(item => (
            <div key={item.label} className="bg-white px-5 py-5 sm:px-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{item.label}</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{item.label === 'My results' && !resultsLoaded || item.label === 'My goals' && !goalsLoaded ? <Skeleton className="mt-2 h-8 w-16" /> : item.value}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{item.label === 'My results' && !resultsLoaded || item.label === 'My goals' && !goalsLoaded ? <Skeleton className="h-3 w-28" /> : item.detail}</p>
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
              <Link to="/submit" className="mt-4 inline-flex items-center gap-2 bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--blue)]">Submit results <ArrowRight size={15} /></Link>
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
            <div className="flex min-h-52 flex-col items-start justify-center">
              <p className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">Your ranking starts with your results</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Once your verified swims are linked to your profile, your time and points rankings will be shown here.
              </p>
              <Link to="/rankings" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">
                Explore world rankings <ArrowRight size={15} />
              </Link>
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[var(--muted)]">Public meet results will appear here when they are added to the platform.</p>
            <Link to="/results" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--blue)] hover:text-[var(--accent-dark)]">Browse results <ArrowRight size={15} /></Link>
          </div>
        </DashboardCard>

      </div>
    </div>
  );
}
