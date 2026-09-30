import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, Send } from 'lucide-react';
import { getCountryAlpha3, getFlagEmoji } from '../lib/utils';
import { getClubLogoUrl, loadClubCoaches, loadClubRecords, type ClubCoachRecord, type ClubRecord } from '../lib/clubs';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { loadManagedSwimmers } from '../lib/swimmerSubmissions';
import Eyebrow from '../components/Eyebrow';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import PageLoading from '../components/PageLoading';
import { SkeletonTable } from '../components/Skeleton';

const PAGE_SIZE = 10;
const TABS = ['Home', 'Meets', 'Times', 'Rankings', 'Records', 'Roster', 'Coaches'] as const;

export default function ClubPage() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Home');
  const [page, setPage] = useState(1);
  const [dbClubs, setDbClubs] = useState<ClubRecord[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [coaches, setCoaches] = useState<ClubCoachRecord[]>([]);
  const [dbRoster, setDbRoster] = useState<Array<{ id: string; first_name: string; last_name: string; country: string; country_code: string; gender: string }>>([]);
  const [dataError, setDataError] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const navigationState = location.state as { fromProfile?: boolean; clubName?: string } | null;

  useEffect(() => {
    setTab('Home'); setPage(1); setDataError('');
    let cancelled = false;
    setClubsLoading(true);
    loadClubRecords().then(rows => { if (!cancelled) setDbClubs(rows); }).catch(reason => { if (!cancelled) setDataError(reason instanceof Error ? reason.message : 'Club data could not be loaded.'); }).finally(() => { if (!cancelled) setClubsLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const savedClub = dbClubs.find(club => club.id === id || club.slug === id);
  const club = useMemo(() => savedClub ? { id: savedClub.id, slug: savedClub.slug, name: savedClub.name, country: savedClub.country, countryCode: savedClub.country_code ?? '', city: savedClub.city, description: savedClub.description, bannerUrl: savedClub.banner_url, logoUrl: getClubLogoUrl(savedClub) } : null, [savedClub]);

  useEffect(() => {
    if (!club || !savedClub || !supabase) { setCoaches([]); setDbRoster([]); setDetailsLoading(false); return; }
    let cancelled = false;
    setDetailsLoading(true);
    Promise.all([
      loadClubCoaches(savedClub.id).then(rows => { if (!cancelled) setCoaches(rows); }).catch(() => { if (!cancelled) setCoaches([]); }),
      supabase.rpc('get_club_roster', { p_club_id: savedClub.id, p_club_name: null }).then(({ data, error }) => {
        if (cancelled) return;
        if (error) setDataError(error.message);
        else setDbRoster((data ?? []) as typeof dbRoster);
      }),
    ]).catch(reason => { if (!cancelled) setDataError(reason instanceof Error ? reason.message : 'Club details could not be loaded.'); }).finally(() => { if (!cancelled) setDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [savedClub, club]);

  useEffect(() => {
    let cancelled = false;
    setIsMember(false);
    if (!isLoggedIn || !savedClub) return () => { cancelled = true; };
    loadManagedSwimmers().then(profiles => {
      if (!cancelled) setIsMember(profiles.some(profile => profile.clubId === savedClub.id));
    }).catch(() => { if (!cancelled) setIsMember(false); });
    return () => { cancelled = true; };
  }, [isLoggedIn, savedClub]);

  const rosterCount = dbRoster.length;
  const pageCount = Math.max(1, Math.ceil(rosterCount / PAGE_SIZE));
  const visibleDb = dbRoster.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!club) {
    if (clubsLoading) return <PageLoading />;
    const returnPath = navigationState?.fromProfile ? '/profile' : '/clubs';
    return <main className="min-h-[65vh] bg-[var(--paper)]">
      <section className="ta-page-top relative isolate overflow-hidden text-white">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 24px, rgba(0,194,215,.2) 25px 27px), repeating-linear-gradient(90deg, transparent 0 40px, rgba(255,255,255,.12) 41px 43px)' }} />
        <div className="relative mx-auto max-w-7xl px-4 py-10"><Link to={returnPath} className="mb-7 inline-flex items-center gap-2 text-sm text-white/75 hover:text-[var(--accent)]"><ArrowLeft size={16} />{navigationState?.fromProfile ? 'Back to profile' : 'All clubs'}</Link><Eyebrow color="accent" className="mb-2">Club overview</Eyebrow><h1 className="display text-3xl font-black uppercase tracking-tight sm:text-5xl">{navigationState?.clubName ?? 'Club not found'}</h1></div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-10"><EmptyState title={navigationState?.clubName ? 'Club listing is not set up yet' : 'Club not found'} subtitle={navigationState?.clubName ? 'This club is linked to the swimmer profile. Its full listing will appear once a coach creates or claims it.' : 'This club may not exist or has been removed.'} /><div className="mt-5 text-center"><Link className="text-sm font-semibold text-[var(--blue)] hover:underline" to={returnPath}>Return</Link></div></div>
    </main>;
  }

  const backPath = navigationState?.fromProfile ? '/profile' : '/clubs';
  const inviteCoach = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteError(''); setInviteNotice(''); setInviteUrl('');
    if (!supabase || !savedClub || !inviteEmail.includes('@')) { setInviteError('Enter a valid coach email address.'); return; }
    setCreatingInvite(true);
    try {
      const { data, error } = await supabase.rpc('create_club_claim_invite', { p_club_id: savedClub.id, p_invited_email: inviteEmail.trim() });
      if (error) throw error;
      const url = `${window.location.origin}/join?clubClaim=${encodeURIComponent(String(data))}`;
      setInviteUrl(url);
      try { await navigator.clipboard.writeText(url); } catch { /* Show the link so it can still be copied manually. */ }
      setInviteNotice(`Invite link ready for ${inviteEmail.trim()}. The coach must join as a coach with this exact email address.`);
      setInviteEmail('');
    } catch (reason) {
      setInviteError(reason instanceof Error ? reason.message : 'Could not create the club invitation.');
    } finally { setCreatingInvite(false); }
  };
  const renderRoster = () => detailsLoading ? <SkeletonTable rows={5} columns={3} /> : dbRoster.length ? <div className="ta-table-shell"><div className="ta-table-header grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 px-4 py-3 font-mono text-xs uppercase tracking-widest"><span>Athlete</span><span>Gender</span><span>Country</span></div>{visibleDb.map(swimmer => <div key={swimmer.id} className="ta-table-row grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-4"><span className="font-semibold text-[var(--ink)]">{swimmer.first_name} {swimmer.last_name}</span><span className="text-sm text-[var(--muted)]">{swimmer.gender || '—'}</span><span className="flex items-center gap-2 text-sm"><span className="ta-table-flag">{getFlagEmoji(swimmer.country_code)}</span><span className="font-mono text-xs tracking-wider">{getCountryAlpha3(swimmer.country_code)}</span></span></div>)}</div> : <EmptyState title="No swimmers linked yet" subtitle="Swimmers who select this club will appear in the roster." />;

  const renderHome = () => <div className="grid gap-8 lg:grid-cols-2">
    <section className="border-b border-[var(--border)] pb-6">
      <div className="mb-4 flex items-end justify-between"><div><Eyebrow>Club activity</Eyebrow><h2 className="mt-1 text-2xl font-black text-[var(--ink)]">Meets</h2></div><button type="button" onClick={() => setTab('Meets')} className="text-sm font-semibold text-[var(--blue)]">View meets <ArrowRight className="ml-1 inline" size={14} /></button></div>
      <EmptyState title="No meets listed yet" subtitle="Club meets will appear here when event details are added." />
    </section>
    <section className="border-b border-[var(--border)] pb-6">
      <div className="mb-4 flex items-end justify-between"><div><Eyebrow>Season overview</Eyebrow><h2 className="mt-1 text-2xl font-black text-[var(--ink)]">Club rankings</h2></div><button type="button" onClick={() => setTab('Rankings')} className="text-sm font-semibold text-[var(--blue)]">View rankings <ArrowRight className="ml-1 inline" size={14} /></button></div>
      <EmptyState title="Rankings are not available yet" subtitle="Club rankings will be calculated from verified swimmer results." />
    </section>
    <section className="lg:col-span-2"><div className="mb-4 flex items-end justify-between border-b border-[var(--border)] pb-3"><div><Eyebrow>Club roster</Eyebrow><h2 className="mt-1 text-2xl font-black text-[var(--ink)]">Swimmers</h2></div><button type="button" onClick={() => setTab('Roster')} className="text-sm font-semibold text-[var(--blue)]">Full roster <ArrowRight className="ml-1 inline" size={14} /></button></div>{renderRoster()}</section>
  </div>;

  const titleByTab: Record<(typeof TABS)[number], string> = { Home: '', Meets: 'Club meets', Times: 'Best times', Rankings: 'Club rankings', Records: 'Club records', Roster: 'Swimmer roster', Coaches: 'Club coaches' };
  return <main className="bg-[var(--paper)]">
    <section className="ta-page-top relative isolate overflow-hidden text-white">
      {club.bannerUrl && <img src={club.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />}
      {club.bannerUrl && <div className="absolute inset-0 bg-gradient-to-t from-[var(--navy)] via-[var(--navy)]/45 to-transparent" />}
      <div className="relative mx-auto max-w-7xl px-4 pb-9 pt-8 sm:pb-11"><Link to={backPath} className="mb-8 inline-flex items-center gap-2 text-sm text-white/75 hover:text-[var(--accent)]"><ArrowLeft size={16} />{navigationState?.fromProfile ? 'Back to profile' : 'All clubs'}</Link><div className="flex items-center gap-4 sm:gap-6"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-lg font-black text-[var(--navy)] sm:h-20 sm:w-20">{club.logoUrl ? <img src={club.logoUrl} alt={`${club.name} logo`} className="h-full w-full object-contain p-1" /> : club.name.split(/\s+/).map(word => word[0]).join('').slice(0, 3).toUpperCase()}</div><div className="min-w-0"><Eyebrow color="accent" className="mb-1">Club · {club.country}</Eyebrow><h1 className="display text-3xl font-black uppercase leading-tight tracking-tight sm:text-5xl">{club.name}</h1><p className="mt-2 flex items-center gap-2 text-sm text-white/75"><span className="ta-table-flag">{getFlagEmoji(club.countryCode)}</span>{club.city}, {club.country}</p></div></div></div>
    </section>
    <nav aria-label="Club sections" className="border-b border-[var(--border)] bg-[var(--paper)]"><div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4">{TABS.map(item => <button key={item} type="button" onClick={() => { setTab(item); setPage(1); }} className={`shrink-0 border-b-2 px-1 py-4 text-sm font-semibold transition-colors ${tab === item ? 'border-[var(--blue)] text-[var(--blue)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item}</button>)}</div></nav>
    {isMember && <section className="mx-auto max-w-7xl px-4 pt-6"><div className="border-l-2 border-[var(--accent)] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><Eyebrow>Grow the team</Eyebrow><h2 className="mt-1 text-xl font-bold text-[var(--ink)]">Invite your club’s coach</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">Send a coach a secure link to join or claim {club.name}. The link is tied to their email address; if the club already has an owner, they’ll join its coaching team.</p></div><Send size={19} className="text-[var(--blue)]" /></div><form onSubmit={inviteCoach} className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="club-coach-invite-email">Coach email address</label><input id="club-coach-invite-email" type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="Coach email address" className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /><button type="submit" disabled={creatingInvite} className="inline-flex items-center justify-center gap-2 bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--blue)] disabled:opacity-50">{creatingInvite ? 'Creating invite…' : 'Create invite link'} <ArrowRight size={15} /></button></form>{inviteError && <p role="alert" className="mt-3 text-sm text-red-700">{inviteError}</p>}{inviteNotice && <p role="status" className="mt-3 text-sm text-emerald-800">{inviteNotice}</p>}{inviteUrl && <p className="mt-2 break-all text-xs text-[var(--muted)]"><Copy className="mr-1 inline" size={13} />{inviteUrl}</p>}</div></section>}
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">{tab === 'Home' ? renderHome() : <section><div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4"><div><Eyebrow>{club.name}</Eyebrow><h2 className="mt-1 text-2xl font-black text-[var(--ink)]">{titleByTab[tab]}</h2></div>{tab === 'Roster' && <span className="font-mono text-xs text-[var(--muted)]">{rosterCount} swimmers</span>}</div>
      {tab === 'Roster' ? <>{renderRoster()}<Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Club roster pages" /></> : tab === 'Coaches' ? (detailsLoading ? <SkeletonTable rows={4} columns={2} /> : coaches.length ? <div className="ta-table-shell">{coaches.map(coach => <div key={coach.id} className="ta-table-row flex items-center justify-between gap-4 px-4 py-4"><span className="font-semibold text-[var(--ink)]">{coach.name}</span><span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">{coach.role}</span></div>)}</div> : <EmptyState title="No coaches listed yet" subtitle="Club coaches will appear here when the club owner adds them." />) : tab === 'Times' || tab === 'Records' ? <EmptyState title="No verified times yet" subtitle="Club swimmer results will appear here as results are added and verified." /> : <EmptyState title={tab === 'Meets' ? 'No meets listed yet' : 'Season rankings are being prepared'} subtitle={tab === 'Meets' ? 'Club meets will appear here when they are connected to the club.' : 'Club rankings will be calculated from verified swimmer results.'} />}
    </section>}{dataError && <p role="status" className="mt-6 text-xs text-[var(--muted)]">Some live club details could not be loaded.</p>}</div>
  </main>;
}
