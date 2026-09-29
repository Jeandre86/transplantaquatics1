import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, Copy, Plus, ShieldCheck } from 'lucide-react';
import Eyebrow from '../components/Eyebrow';
import { useAuth } from '../contexts/AuthContext';
import { countries } from '../data/countries';
import { loadClubRecords, type ClubRecord } from '../lib/clubs';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import PageLoading from '../components/PageLoading';
import { SkeletonTable } from '../components/Skeleton';

type OwnedClub = ClubRecord & { role: 'owner' | 'coach' };
type PendingInvite = { id: string; invited_email: string; status: string };

export default function CoachClubPage() {
  const { user, isLoggedIn, isLoading } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clubs, setClubs] = useState<OwnedClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteByClub, setInviteByClub] = useState<Record<string, PendingInvite[]>>({});
  const [inviteUrl, setInviteUrl] = useState('');
  const [form, setForm] = useState({ name: '', country: '', city: '', description: '', bannerUrl: '', logoUrl: '' });

  const reload = useCallback(async () => {
    const client = supabase;
    if (!client || !user) return;
    const { data: rows, error: loadError } = await client.from('club_coaches').select('club_id, role').eq('account_id', (await client.auth.getUser()).data.user?.id ?? '');
    if (loadError) throw loadError;
    const records = await loadClubRecords();
    const mapped = (rows ?? []).flatMap(row => {
      const club = records.find(item => item.id === row.club_id);
      return club ? [{ ...club, role: row.role as 'owner' | 'coach' }] : [];
    });
    setClubs(mapped);
    const invites = await Promise.all(mapped.filter(club => club.role === 'owner').map(async club => {
      const { data } = await client.from('club_coach_invites').select('id, invited_email, status').eq('club_id', club.id).eq('status', 'pending');
      return [club.id, data ?? []] as const;
    }));
    setInviteByClub(Object.fromEntries(invites));
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const client = supabase;
        const inviteId = searchParams.get('invite');
        if (inviteId && client) {
          const { data, error: acceptError } = await client.rpc('accept_club_coach_invite', { invite_id: inviteId });
          if (acceptError) throw acceptError;
          setNotice('You have joined the club coaching team.');
          const next = new URLSearchParams(searchParams); next.delete('invite'); setSearchParams(next, { replace: true });
          if (data) setNotice('You have joined the club coaching team. Open the club below to view its page.');
        }
        const claimInviteId = searchParams.get('claimInvite');
        if (claimInviteId && client) {
          if (user?.accountRole !== 'coach') throw new Error('This invitation is for a coach account. Sign in or join as a coach to continue.');
          const { data, error: claimError } = await client.rpc('accept_club_claim_invite', { p_invite_id: claimInviteId });
          if (claimError) throw claimError;
          setNotice('Club invitation accepted. You can now manage the club page and invite other coaches.');
          const next = new URLSearchParams(searchParams); next.delete('claimInvite'); setSearchParams(next, { replace: true });
          if (data) setNotice('Club invitation accepted. Your club is available below.');
        }
        await reload();
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load your club account.'); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [user, reload, searchParams, setSearchParams]);

  if (isLoading) return <PageLoading />;
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.accountRole !== 'coach') return <main className="mx-auto max-w-3xl px-4 py-16"><Empty /></main>;

  const createClub = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    const client = supabase;
    if (!client || !form.name.trim() || !form.country || !form.city.trim()) { setError('Add a club name, country, and city.'); return; }
    setSaving(true);
    try {
      const countryCode = countries.find(country => country.name === form.country)?.code ?? null;
      const baseSlug = form.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = baseSlug;
      const authUser = await client.auth.getUser();
      const { error: insertError } = await client.from('clubs').insert({ name: form.name, country: form.country, city: form.city, description: form.description, banner_url: form.bannerUrl || null, logo_url: form.logoUrl || null, slug, country_code: countryCode, created_by: authUser.data.user?.id });
      if (insertError) throw insertError;
      setForm({ name: '', country: '', city: '', description: '', bannerUrl: '', logoUrl: '' });
      setNotice('Your club page is live. You can now invite other coaches.');
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The club could not be created.'); }
    finally { setSaving(false); }
  };

  const inviteCoach = async (club: OwnedClub) => {
    setError(''); setNotice(''); setInviteUrl('');
    const client = supabase;
    if (!client || !inviteEmail.includes('@')) { setError('Enter a valid coach email address.'); return; }
    setSaving(true);
    try {
      const authUser = await client.auth.getUser();
      const { data, error: inviteError } = await client.from('club_coach_invites').insert({ club_id: club.id, invited_email: inviteEmail.trim().toLowerCase(), invited_by: authUser.data.user?.id, status: 'pending' }).select('id').single();
      if (inviteError) throw inviteError;
      const url = `${window.location.origin}/coach/club?invite=${data.id}`;
      setInviteUrl(url);
      await navigator.clipboard?.writeText(url);
      setNotice(`Invitation link copied. Share it with ${inviteEmail.trim()}.`);
      setInviteEmail('');
      await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create the coach invitation.'); }
    finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-[var(--paper)]">
    <section className="bg-[var(--navy)] py-12 text-white sm:py-16"><div className="mx-auto max-w-7xl px-4"><Eyebrow color="accent" className="mb-2">Coach workspace</Eyebrow><h1 className="display text-3xl font-black uppercase sm:text-5xl">Club management</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">Create your club’s public page, then bring the rest of the coaching team in with an invitation link.</p></div></section>
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:py-10">
      {error && <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? <SkeletonTable rows={4} columns={3} /> : <>
        <section className="bg-white p-5 sm:p-7"><div className="mb-5 border-b border-[var(--border)] pb-4"><Eyebrow>Your clubs</Eyebrow><h2 className="mt-1 text-2xl font-black text-[var(--ink)]">Club pages</h2></div>{clubs.length ? <div className="divide-y divide-[var(--border)]">{clubs.map(club => <div key={club.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><Link to={`/clubs/${club.slug}`} className="font-bold text-[var(--blue)] hover:underline">{club.name}<ArrowRight className="ml-2 inline" size={15} /></Link><p className="mt-1 text-xs text-[var(--muted)]">{club.city}, {club.country} · {club.role}</p></div>{club.role === 'owner' && <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[340px]"><div className="flex gap-2"><input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="Coach email address" className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)]" /><button type="button" disabled={saving} onClick={() => void inviteCoach(club)} className="inline-flex items-center gap-1.5 bg-[var(--navy)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Plus size={14} /> Invite</button></div>{inviteByClub[club.id]?.map(invite => <p key={invite.id} className="text-xs text-[var(--muted)]">Pending: {invite.invited_email}</p>)}</div>}</div>)}</div> : <p className="text-sm text-[var(--muted)]">You haven’t created or joined a club yet.</p>}</section>
        <section className="bg-white p-5 sm:p-7"><div className="mb-5 border-b border-[var(--border)] pb-4"><Eyebrow>Get your team online</Eyebrow><h2 className="mt-1 text-2xl font-black text-[var(--ink)]">Create a club</h2><p className="mt-2 text-sm text-[var(--muted)]">Your club listing becomes public as soon as you create it. You can add banner and logo image URLs now.</p></div><form onSubmit={createClub} className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-[var(--muted)]">Club name *<input required value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label><label className="text-xs font-semibold text-[var(--muted)]">Country *<select required value={form.country} onChange={event => setForm(value => ({ ...value, country: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]"><option value="">Select country</option>{countries.map(country => <option key={country.code} value={country.name}>{country.name}</option>)}</select></label><label className="text-xs font-semibold text-[var(--muted)]">City / town *<input required value={form.city} onChange={event => setForm(value => ({ ...value, city: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label><label className="text-xs font-semibold text-[var(--muted)]">Banner image URL<input type="url" value={form.bannerUrl} onChange={event => setForm(value => ({ ...value, bannerUrl: event.target.value }))} placeholder="https://…" className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label><label className="text-xs font-semibold text-[var(--muted)]">Club logo URL<input type="url" value={form.logoUrl} onChange={event => setForm(value => ({ ...value, logoUrl: event.target.value }))} placeholder="https://…" className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label><label className="text-xs font-semibold text-[var(--muted)] sm:col-span-2">About your club<textarea rows={3} value={form.description} onChange={event => setForm(value => ({ ...value, description: event.target.value }))} className="mt-1.5 w-full border border-[var(--border)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]" /></label><button disabled={saving} type="submit" className="w-full bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--navy)] hover:brightness-95 disabled:opacity-50 sm:w-fit">{saving ? 'Creating…' : 'Create club page'}</button></form></section>
      </>}
      {inviteUrl && <p className="break-all text-xs text-[var(--muted)]"><Copy className="mr-1 inline" size={13} />Invite link: {inviteUrl}</p>}
      {!hasSupabaseConfig && <p className="text-xs text-[var(--muted)]">Supabase is not configured for this environment.</p>}
    </div>
  </main>;
}

function Empty() { return <div className="border-l-2 border-[var(--accent)] bg-white p-6"><ShieldCheck className="mb-3 text-[var(--blue)]" size={24} /><h1 className="text-xl font-bold text-[var(--ink)]">Coach access required</h1><p className="mt-2 text-sm text-[var(--muted)]">Join as a coach to create and manage a club page.</p><Link to="/join" className="mt-4 inline-block text-sm font-semibold text-[var(--blue)] hover:underline">Join as a coach</Link></div>; }
