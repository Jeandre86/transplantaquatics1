import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePublishedArticles } from '../hooks/usePublishedArticles';
import { latestRecords } from '../data/records';
import { TRANSPLANT_TYPES, type AgeGroup, type Course, type Event, type Gender, type Ranking } from '../types';
import { getFlagEmoji, getTransplantColor, is25mEvent } from '../lib/utils';
import ArticleCard from '../components/ArticleCard';
import Eyebrow from '../components/Eyebrow';
import RankingFilters from '../components/RankingFilters';
import { useFastestByTransplantType } from '../hooks/useFastestByTransplantType';
import { loadDatabaseRankings } from '../lib/databaseRankings';
import { describeSupabaseError } from '../lib/supabase';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { Skeleton } from '../components/Skeleton';

const section = 'mx-auto w-full max-w-7xl px-4 py-16 sm:py-20';
const title = 'mt-3 text-3xl font-extrabold tracking-tight text-[var(--ink)] sm:text-4xl';
const ALL = 'All';

function AnimatedStat({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1400;
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (now: number) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{count.toLocaleString('en-US')}{suffix}</>;
}

export default function HomePage() {
  const { articles } = usePublishedArticles();
  const [ageGroup, setAgeGroup] = useState<AgeGroup | typeof ALL>(ALL);
  const [gender, setGender] = useState<Gender | typeof ALL>(ALL);
  const [event, setEvent] = useState<Event | typeof ALL>(ALL);
  const [course, setCourse] = useState<Course | typeof ALL>(ALL);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [databaseRankings, setDatabaseRankings] = useState<Ranking[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const [athleteProfiles, setAthleteProfiles] = useState<PublicSwimmerProfile[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(true);
  const [athletesError, setAthletesError] = useState<string | null>(null);
  const { swims: fastestSwims, loading: fastestLoading, error: fastestError } = useFastestByTransplantType();

  useEffect(() => {
    let active = true;
    loadDatabaseRankings()
      .then(rows => { if (active) setDatabaseRankings(rows); })
      .catch(error => { if (active) setRankingsError(describeSupabaseError(error)); })
      .finally(() => { if (active) setRankingsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    loadPublicSwimmerDirectory()
      .then(rows => { if (active) setAthleteProfiles(rows); })
      .catch(error => { if (active) setAthletesError(describeSupabaseError(error)); })
      .finally(() => { if (active) setAthletesLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const topRankings = databaseRankings
    .filter(r => (ageGroup === ALL || r.ageGroup === ageGroup)
      && (gender === ALL || r.gender === gender)
      && (event === ALL || r.event === event)
      && (event !== ALL || !is25mEvent(r.event))
      && (course === ALL || r.course === course))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);
  const featuredAthletes = athleteProfiles.slice(0, 4);
  const countryCount = new Set(athleteProfiles.map(profile => profile.country_code).filter(Boolean)).size;
  const featuredRecords = [...latestRecords]
    .sort((a, b) => Number(is25mEvent(a.event)) - Number(is25mEvent(b.event)))
    .slice(0, 4);
  const featuredArticles = articles.slice(0, 3);

  return (
    <div className="flex flex-col bg-[var(--paper)]">
      <section className="order-1 relative isolate flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden bg-[var(--navy)]" style={{ backgroundImage: "linear-gradient(90deg, rgba(7, 26, 43, 0.94) 0%, rgba(7, 26, 43, 0.82) 52%, rgba(7, 26, 43, 0.45) 100%), url('/assets/aquatics-hero.png')", backgroundPosition: 'center', backgroundSize: 'cover' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-30">
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="absolute inset-y-0 border-l border-white/30" style={{ left: `${(i + 1) * 12.5}%` }} />)}
          <div className="absolute inset-y-0 left-1/2 border-l-2 border-[var(--lime)]/70" />
        </div>
        <div aria-label="Race split times" className="absolute right-6 top-6 z-10 hidden font-mono text-right text-xs leading-6 tracking-wider text-[var(--lime)]/30 sm:block lg:right-8 lg:top-8">
          <div>58.92</div><div>1:01.14</div><div>1:01.77</div><div>1:02.88</div>
        </div>
        <div aria-label="Race splits" className="absolute bottom-6 left-6 z-10 hidden font-mono text-[10px] leading-5 tracking-wider text-[var(--lime)]/30 sm:block lg:bottom-8 lg:left-8">SPLIT 01 / 29.11<br />SPLIT 02 / 29.81<br />FINAL / 58.92</div>
        <div className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <Eyebrow color="accent" onDark>World Transplant Aquatics</Eyebrow>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-7xl">
              The global home of transplant aquatic sport.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              Measuring, verifying, and celebrating elite athletic achievements for transplant recipients worldwide. This is where performance lives.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/rankings" className="inline-flex items-center gap-2 rounded px-6 py-3.5 text-xs font-extrabold uppercase tracking-widest text-[var(--navy)] transition hover:bg-white sm:text-sm" style={{ background: 'var(--accent)' }}>
                Explore rankings <ArrowRight size={16} />
              </Link>
              <Link to="/submit" className="inline-flex items-center gap-2 rounded border border-white/70 px-6 py-3.5 text-xs font-extrabold uppercase tracking-widest text-white transition hover:bg-white/10 sm:text-sm">
                Submit timing <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="order-3 border-b border-[var(--border)] bg-[var(--paper)] text-[var(--ink)]">
        <div className={`${section} !py-14`}>
          <Eyebrow color="blue">Global timings</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">World rankings</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">The fastest verified swims this season. One row per athlete, ranked by time within a single event so every comparison is fair.</p>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border border-[var(--border)] bg-white p-4 sm:p-5">
            <RankingFilters ageGroup={ageGroup} gender={gender} event={event} course={course} onChange={({ ageGroup: ag, gender: g, event: ev, course: co }) => { setAgeGroup(ag as AgeGroup | typeof ALL); setGender(g as Gender | typeof ALL); setEvent(ev as Event | typeof ALL); setCourse(co as Course | typeof ALL); }} />
            {[ageGroup, gender, event, course].some(value => value !== ALL) && <button type="button" onClick={() => { setAgeGroup(ALL); setGender(ALL); setEvent(ALL); setCourse(ALL); }} className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--muted)] transition-colors hover:text-[var(--accent-dark)]">Clear filters</button>}
          </div>
          <div className="ta-table-scroll mt-5 border border-[var(--border)] bg-white">
            <div className="min-w-[600px]">
              <div className="flex items-center bg-[var(--navy)] px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-white/70 sm:px-5">
                <span className="w-14">Rank</span><span className="min-w-0 flex-1 px-2">Athlete</span><span className="w-20">Country</span><span className="w-40">Event</span><span className="w-24 text-right">Time</span>
              </div>
              {rankingsLoading ? <div className="space-y-0" role="status" aria-label="Loading world rankings">{Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-4 sm:px-5"><Skeleton className="h-4 w-10" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-16" /></div>)}</div>
              : rankingsError ? <p role="status" className="px-5 py-8 text-sm text-red-700">World rankings could not be loaded: {rankingsError}</p>
              : topRankings.length ? topRankings.map((r, i) => (
                <Link key={`${r.athleteId}-${r.rank}`} to={`/athletes/${r.athleteId}`} className={`flex items-center border-t border-[var(--border)] px-4 py-4 transition hover:bg-[var(--ice)] sm:px-5 ${i % 2 ? 'bg-[var(--paper)]' : 'bg-white'}`}>
                  <span className="w-14 font-mono text-sm font-bold text-[var(--accent-dark)]">#{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate px-2 text-sm font-bold text-[var(--ink)]">{r.athleteName}</span>
                  <span className="w-20 text-sm text-[var(--muted)]">{getFlagEmoji(r.countryCode)} {r.countryCode}</span>
                  <span className="w-40 text-sm text-[var(--muted)]">{r.event}</span>
                  <span className="w-24 text-right font-mono text-sm font-bold text-[var(--ink)]">{r.time}</span>
                </Link>
              )) : <p className="px-5 py-8 text-sm text-[var(--muted)]">No rankings match these filters yet.</p>}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
            <Link to="/rankings" className="inline-flex items-center gap-2 font-semibold text-[var(--accent-dark)] hover:underline">See full rankings <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="order-5 bg-white">
        <div className={section}>
          <Eyebrow color="blue">The athletes</Eyebrow>
          <h2 className={title}>Athletes making history</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">Meet the swimmers redefining performance and possibility after transplant.</p>
          {athletesLoading ? <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading athletes">{Array.from({ length: 4 }, (_, index) => <div key={index} className="border border-[var(--border)] bg-white p-5"><div className="flex items-start gap-4"><Skeleton className="size-13 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-2/3" /></div></div></div>)}</div>
            : athletesError ? <p role="status" className="mt-8 border-t border-[var(--border)] py-6 text-sm text-red-700">Athlete profiles could not be loaded: {athletesError}</p>
            : featuredAthletes.length ? <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featuredAthletes.map(a => (
              <Link key={a.id} to={`/athletes/${a.id}`} className="group border border-[var(--border)] bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="flex size-13 shrink-0 items-center justify-center bg-[var(--navy)] font-mono text-sm font-bold text-white">{a.first_name[0]}{a.last_name[0]}</div>
                  <div className="min-w-0"><h3 className="truncate font-bold text-[var(--ink)] group-hover:text-[var(--blue)]">{a.first_name} {a.last_name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{getFlagEmoji(a.country_code ?? '')} {a.country}</p><p className="mt-2 text-xs text-[var(--muted)]">{a.age_group} · {a.transplant_type}</p></div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"><span>View athlete profile</span><ArrowRight size={14} className="text-[var(--blue)]" /></div>
              </Link>
            ))}
          </div> : <p className="mt-8 border-t border-[var(--border)] py-6 text-sm text-[var(--muted)]">Athlete profiles will appear here as swimmers join and publish their profiles.</p>}
          <Link to="/athletes" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--blue)]">All athletes <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="order-6 bg-[var(--paper)]">
        <div className={section}>
          <Eyebrow color="blue">Global achievements</Eyebrow>
          <h2 className={title}>Transplant World Records</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">The highest verified performances across transplant aquatics.</p>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {featuredRecords.map(r => <Link key={r.id} to="/records" className="flex flex-col justify-between gap-5 border border-[var(--border)] bg-white p-5 transition hover:shadow-md sm:flex-row sm:items-center sm:p-6">
              <div><div className="mb-3 flex items-center gap-2"><span className="rounded bg-[var(--lime)] px-2 py-1 text-[10px] font-extrabold text-[var(--navy)]">WR</span><span className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">{r.course} · {r.ageGroup} · {r.category}</span></div><h3 className="font-extrabold text-[var(--ink)]">{r.event}</h3><p className="mt-1 text-sm text-[var(--muted)]">{r.athleteName} · {r.country}</p><p className="mt-2 text-xs text-[var(--muted)]">{r.meet}</p></div>
              <span className="shrink-0 font-mono text-2xl font-bold text-[var(--ink)] sm:text-3xl">{r.time}</span>
            </Link>)}
          </div>
          <Link to="/records" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--blue)]">Explore all records <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="order-2 ta-page-top relative isolate overflow-hidden border-y border-white/10 text-white" aria-label="Transplant Aquatics in numbers">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-70">
          {Array.from({ length: 7 }, (_, index) => <span key={index} className={`absolute inset-y-0 ${index === 3 ? 'border-l-2 border-[var(--lime)]/70' : 'border-l border-white/20'}`} style={{ left: `${(index + 1) * 12.5}%` }} />)}
        </div>
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 px-4 py-8 sm:py-10 md:grid-cols-4">
          {[
            { value: athleteProfiles.length, suffix: '', label: 'Athletes' },
            { value: countryCount, suffix: '', label: 'Countries' },
            { value: latestRecords.length, suffix: '', label: 'World records' },
            { value: databaseRankings.length, suffix: '', label: 'Results' },
          ].map(stat => <div key={stat.label} className="relative z-10 flex flex-col items-center justify-center px-2 py-5 text-center sm:px-4">
            <p className="font-mono text-3xl font-black tracking-tight text-[var(--lime)] sm:text-4xl lg:text-5xl"><AnimatedStat value={stat.value} suffix={stat.suffix} /></p>
            <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--accent)] sm:text-[11px] sm:tracking-[0.16em]">{stat.label}</p>
          </div>)}
        </div>
      </section>


      <section className="order-4 bg-[var(--navy)] text-white">
        <div className={section}>
          <Eyebrow color="accent" onDark>Discovery</Eyebrow>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Fastest by transplant type</h2><span className="w-fit border border-white/15 px-3 py-1 font-mono text-[10px] tracking-wider text-white/60">Fastest verified swimmer per type</span></div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">See how swimmers with the same transplant compare. Everyone is measured in one event, so the times are a fair comparison.</p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {TRANSPLANT_TYPES.map(type => {
              const eventBest = fastestSwims
                .filter(swim => swim.transplantType === type && !is25mEvent(swim.event))
                .slice(0, 1);
              return <div key={type} className="border border-[var(--navy-light)] bg-[var(--navy-mid)] p-5">
                <div className="mb-3 flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: getTransplantColor(type) }} /><span className="font-semibold text-white">{type}</span></div>
                {fastestLoading ? <div role="status" aria-label="Loading fastest swims" className="space-y-3"><Skeleton dark className="h-4 w-3/4" /><Skeleton dark className="h-8 w-full" /></div> : fastestError ? <p className="text-sm text-white/60">Unable to load swims.</p> : eventBest.length ? <div className="space-y-3">
                  {eventBest.map(swim => <div key={`${swim.event}-${swim.gender}-${swim.course}`} className="border-t border-[var(--border)] pt-3 first:border-0 first:pt-0">
                    <p className="font-mono text-[10px] tracking-wider text-white/55">{swim.event} · {swim.gender}{swim.course ? ` · ${swim.course}` : ''}</p>
                    <div className="mt-1 flex items-baseline justify-between gap-2"><span className="truncate font-semibold text-white">{swim.athleteName}</span><span className="shrink-0 font-mono text-lg font-bold text-white">{swim.time}</span></div>
                    {swim.status === 'swimmer_submitted' && <p className="mt-1 text-[10px] text-white/45">Pending verification</p>}
                  </div>)}
                </div> : <p className="text-sm text-white/60">No submitted swims yet</p>}
              </div>;
            })}
          </div>
          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <p className="max-w-2xl text-sm leading-relaxed text-white/60">For discovery only. This is not an official ranking; only verified swims are included.</p>
            <Link to="/rankings/transplant-type" className="inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-[var(--navy)] transition-colors hover:bg-[var(--navy)] hover:text-white">
              Fastest by transplant type <ArrowRight size={15} />
            </Link>
          </div>
          {fastestError && <p role="status" className="mt-4 text-sm text-red-700">Fastest swims could not be loaded: {fastestError}</p>}
        </div>
      </section>

      <section className="order-7 bg-[var(--paper)]">
        <div className={section}>
          <Eyebrow color="blue">From the pool deck</Eyebrow>
          <h2 className={title}>Stories from the world of transplant swimming</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">The people, preparation, and progress behind the performances.</p>
          {featuredArticles.length ? <div className="mt-9 grid gap-6 md:grid-cols-3">{featuredArticles.map(a => <ArticleCard key={a.id} article={a} />)}</div> : <p className="mt-8 border-t border-[var(--border)] py-6 text-sm text-[var(--muted)]">No stories have been published yet.</p>}
          <Link to="/from-the-pool-deck" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--blue)]">Read all stories <ArrowRight size={15} /></Link>
        </div>
      </section>

      <section className="order-8 bg-[var(--navy)] text-center text-white">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">Different journeys. Same water.</p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">Join the network to submit official times, track performance, and take your place in the global transplant aquatics community.</p>
          <Link to="/join" className="mt-7 inline-flex items-center gap-2 rounded px-6 py-3.5 text-xs font-extrabold uppercase tracking-widest text-[var(--navy)] transition hover:bg-white sm:text-sm" style={{ background: 'var(--accent)' }}>Join the network <ArrowRight size={16} /></Link>
        </div>
      </section>

      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top" className={`fixed bottom-6 right-6 z-40 flex size-10 items-center justify-center border border-[var(--border)] bg-white text-[var(--ink)] shadow-lg transition-opacity ${showBackToTop ? 'opacity-100' : 'pointer-events-none opacity-0'}`}><ArrowUp size={16} /></button>
    </div>
  );
}
