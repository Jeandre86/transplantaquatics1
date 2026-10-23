import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import EmptyState from './EmptyState';
import SortableTable from './SortableTable';
import { describeSupabaseError, supabase } from '../lib/supabase';

type PendingUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  account_role: string | null;
  created_at: string;
};

export default function AdminPendingVerifications() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-unconfirmed-users', { body: {} });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));
      setUsers((data?.users ?? []) as PendingUser[]);
    } catch (reason) {
      setError(describeSupabaseError(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section className="border p-5" style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-bold text-white">Pending email verification <span className="ml-1 rounded-full bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--navy)]">{users.length}</span></h2><p className="mt-1 text-sm text-white/55">Accounts that have registered but have not confirmed their email address yet.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh pending email verifications" className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/75 hover:border-[var(--accent)] disabled:opacity-40"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </div>
    {error ? <p role="alert" className="mt-5 border border-red-300/30 bg-red-950/20 p-3 text-sm text-red-200">Could not load pending confirmations: {error}</p>
      : loading ? <p className="py-12 text-center text-sm text-white/50">Loading account confirmations…</p>
        : users.length ? <div className="ta-table-scroll mt-5"><SortableTable><table className="w-full min-w-[600px] text-left text-sm"><caption className="sr-only">Accounts waiting for email verification</caption><thead><tr className="border-b border-[var(--navy-light)] font-mono text-[10px] uppercase tracking-widest text-white/45"><th scope="col" className="px-3 py-3">Account</th><th scope="col" className="px-3 py-3">Account type</th><th scope="col" className="px-3 py-3">Registered</th><th scope="col" className="px-3 py-3">Status</th></tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-b border-[var(--navy-light)] last:border-0"><td className="px-3 py-3"><p className="font-semibold text-white">{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</p><p className="text-xs text-white/50">{user.email}</p></td><td className="px-3 py-3 capitalize text-white/70">{user.account_role?.replaceAll('_', ' ') || 'Not specified'}</td><td className="px-3 py-3 text-white/70">{new Date(user.created_at).toLocaleString()}</td><td className="px-3 py-3"><span className="rounded-full bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-200">Awaiting confirmation</span></td></tr>)}</tbody></table></SortableTable></div>
          : <div className="mt-5"><EmptyState title="No accounts awaiting verification" subtitle="New registrations will appear here until they confirm their email address." onDark /></div>}
  </section>;
}
