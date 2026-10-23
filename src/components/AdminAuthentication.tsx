import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, RefreshCw, Search } from 'lucide-react';
import EmptyState from './EmptyState';
import SortableTable from './SortableTable';
import { describeSupabaseError, supabase } from '../lib/supabase';

type AuthUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  account_role: string | null;
  created_at: string;
  email_confirmed_at: string | null;
};

type UserFilter = 'all' | 'pending' | 'verified';

const emailActionError = async (reason: unknown) => {
  if (reason && typeof reason === 'object' && 'context' in reason) {
    const context = (reason as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: unknown };
        if (typeof body.error === 'string' && body.error.trim()) {
          const rateLimitWait = body.error.match(/only request this after (\d+) seconds/i);
          if (rateLimitWait) return `Supabase is rate-limiting this email. Wait ${rateLimitWait[1]} seconds, then try again.`;
          if (/email rate limit exceeded/i.test(body.error)) return 'Supabase has rate-limited email delivery. Wait a minute before trying again.';
          return body.error;
        }
      } catch { /* Use the SDK error below if the response has no JSON body. */ }
    }
  }
  return describeSupabaseError(reason);
};

const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

export default function AdminAuthentication() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UserFilter>('all');
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-unconfirmed-users', { body: { action: 'list' } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));
      setUsers((data?.users ?? []) as AuthUser[]);
    } catch (reason) {
      setError(describeSupabaseError(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: users.length,
    pending: users.filter(user => !user.email_confirmed_at).length,
    verified: users.filter(user => Boolean(user.email_confirmed_at)).length,
  }), [users]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return users.filter(user => {
      const verified = Boolean(user.email_confirmed_at);
      const matchesFilter = filter === 'all' || (filter === 'verified' ? verified : !verified);
      const matchesSearch = !query || `${user.first_name ?? ''} ${user.last_name ?? ''} ${user.email}`.toLocaleLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, users]);

  const resend = async (user: AuthUser) => {
    if (!supabase) return;
    setSendingId(user.id);
    setError('');
    setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-unconfirmed-users', { body: { action: 'resend', userId: user.id } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));
      setNotice(data?.kind === 'signin'
        ? `This account is already verified. Supabase accepted a sign-in email request for ${user.email}.`
        : `Supabase accepted a confirmation email request for ${user.email}.`);
    } catch (reason) {
      setError(`Could not send the account email: ${await emailActionError(reason)}`);
    } finally {
      setSendingId('');
    }
  };

  return <section className="border p-5" style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="font-bold text-white">Signup accounts</h2>
        <p className="mt-1 text-sm text-white/55">Review signup and email confirmation status, and resend a confirmation email to any account.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh signup accounts" className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/75 hover:border-[var(--accent)] disabled:opacity-40">
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
      </button>
    </div>

    <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Signup account verification filter">
      {(['all', 'pending', 'verified'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`border px-3 py-2 text-xs font-semibold capitalize ${filter === value ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--navy)]' : 'border-[var(--navy-light)] text-white/65 hover:text-white'}`}>
        {value === 'pending' ? 'Pending verification' : value === 'verified' ? 'Verified' : 'All accounts'} <span className="ml-1 font-mono">{counts[value]}</span>
      </button>)}
    </div>

    <label className="mt-4 flex max-w-lg items-center gap-2 border border-[var(--navy-light)] bg-[var(--navy)] px-3">
      <Search size={15} className="shrink-0 text-white/45" />
      <span className="sr-only">Search accounts by name or email</span>
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or email" className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/40 focus:outline-none" />
    </label>

    {error && <p role="alert" className="mt-4 border border-red-300/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mt-4 flex items-center gap-2 border border-emerald-300/20 bg-emerald-950/20 p-3 text-sm text-emerald-200"><CheckCircle2 size={16} />{notice}</p>}

    {loading ? <p className="py-12 text-center text-sm text-white/50">Loading signup accounts…</p>
      : visibleUsers.length ? <div className="ta-table-scroll mt-5"><SortableTable><table className="w-full min-w-[920px] text-left text-sm">
        <caption className="sr-only">Signup accounts and email verification status</caption>
        <thead><tr className="border-b border-[var(--navy-light)] font-mono text-[10px] uppercase tracking-widest text-white/45">
          <th scope="col" className="px-3 py-3">Account</th><th scope="col" className="px-3 py-3">Account type</th><th scope="col" className="px-3 py-3">Signed up</th><th scope="col" className="px-3 py-3">Verification</th><th scope="col" className="px-3 py-3">Verified at</th><th scope="col" className="px-3 py-3">Action</th>
        </tr></thead>
        <tbody>{visibleUsers.map(user => {
          const verified = Boolean(user.email_confirmed_at);
          const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
          return <tr key={user.id} className="border-b border-[var(--navy-light)] last:border-0">
            <td className="px-3 py-3"><p className="font-semibold text-white">{name || user.email}</p>{name && <p className="text-xs text-white/50">{user.email}</p>}</td>
            <td className="px-3 py-3 capitalize text-white/70">{user.account_role?.replaceAll('_', ' ') || 'Not specified'}</td>
            <td className="px-3 py-3 text-white/70">{dateLabel(user.created_at)}</td>
            <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${verified ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-200'}`}>{verified ? 'Verified' : 'Pending'}</span></td>
            <td className="px-3 py-3 text-white/70">{dateLabel(user.email_confirmed_at)}</td>
            <td className="px-3 py-3"><button type="button" onClick={() => void resend(user)} disabled={sendingId === user.id} className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"><Mail size={13} />{sendingId === user.id ? 'Sending…' : verified ? 'Send sign-in email' : 'Resend verification'}</button></td>
          </tr>;
        })}</tbody>
      </table></SortableTable></div>
        : <div className="mt-5"><EmptyState title={search || filter !== 'all' ? 'No matching accounts' : 'No signup accounts found'} subtitle={filter === 'pending' ? 'New accounts that have not verified their email will appear here.' : 'Accounts created through site signup will appear here.'} onDark /></div>}
  </section>;
}
