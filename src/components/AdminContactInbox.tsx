import { useEffect, useMemo, useState } from 'react';
import { Archive, Inbox, Mail, MailOpen, RefreshCw } from 'lucide-react';
import EmptyState from './EmptyState';
import { describeSupabaseError, supabase } from '../lib/supabase';

type ContactMessage = { id: string; name: string; email: string; subject: string; message: string; status: 'new' | 'read' | 'archived'; read_at: string | null; created_at: string };
type InboxFilter = 'all' | 'new' | 'read' | 'archived';
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function AdminContactInbox({ cardStyle }: { cardStyle: React.CSSProperties }) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.from('contact_messages').select('id,name,email,subject,message,status,read_at,created_at').order('created_at', { ascending: false });
    if (loadError) setError(`${describeSupabaseError(loadError)}. Apply the contact messages migration, then refresh.`);
    else {
      const rows = (data ?? []) as ContactMessage[];
      setMessages(rows);
      setSelectedId(current => rows.some(row => row.id === current) ? current : rows[0]?.id ?? '');
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => filter === 'all' ? messages : messages.filter(message => message.status === filter), [filter, messages]);
  const selected = messages.find(message => message.id === selectedId) ?? null;

  const updateStatus = async (message: ContactMessage, status: ContactMessage['status']) => {
    if (!supabase) return;
    const readAt = status === 'new' ? null : status === 'read' ? new Date().toISOString() : message.read_at;
    const { error: updateError } = await supabase.from('contact_messages').update({ status, read_at: readAt }).eq('id', message.id);
    if (updateError) { setError(describeSupabaseError(updateError)); return; }
    setMessages(current => current.map(row => row.id === message.id ? { ...row, status, read_at: readAt } : row));
    setError('');
  };

  return <section className="border" style={cardStyle}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-light)] px-5 py-4">
      <div><h2 className="font-bold text-white">Contact inbox</h2><p className="mt-1 text-xs text-white/55">Messages sent through the public Contact Us form.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh contact inbox" className="inline-flex h-9 w-9 items-center justify-center border border-[var(--navy-light)] text-white/65 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
    </div>
    {error && <p role="alert" className="m-4 border border-red-300/20 bg-red-950/20 p-3 text-sm leading-6 text-red-200">{error}</p>}
    <div className="flex flex-wrap gap-2 border-b border-[var(--navy-light)] px-4 py-3" role="group" aria-label="Filter messages">
      {(['all', 'new', 'read', 'archived'] as const).map(value => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${filter === value ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--navy)]' : 'border-[var(--navy-light)] text-white/65 hover:border-[var(--accent)]'}`}>{value}{value === 'new' ? ` · ${messages.filter(message => message.status === 'new').length}` : ''}</button>)}
    </div>
    {loading ? <p className="p-6 text-sm text-white/55">Loading messages…</p> : messages.length === 0 ? <div className="p-5"><EmptyState title="Your inbox is empty" subtitle="Messages sent through the Contact Us form will appear here." onDark /></div> : filtered.length === 0 ? <div className="p-5"><EmptyState title={`No ${filter} messages`} subtitle="Choose another filter to see more messages." onDark /></div> : (
      <div className="grid min-h-[420px] lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)]">
        <div className="divide-y divide-[var(--navy-light)] border-b border-[var(--navy-light)] lg:border-b-0 lg:border-r">
          {filtered.map(message => <button key={message.id} type="button" onClick={() => { setSelectedId(message.id); if (message.status === 'new') void updateStatus(message, 'read'); }} aria-current={selectedId === message.id ? 'true' : undefined} className={`block w-full px-4 py-4 text-left transition-colors ${selectedId === message.id ? 'bg-[var(--navy)]' : 'hover:bg-[var(--navy)]/70'}`}>
            <span className="flex items-start justify-between gap-2"><span className="min-w-0 truncate text-sm font-semibold text-white">{message.name}</span>{message.status === 'new' && <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-[var(--navy)]">New</span>}</span>
            <span className="mt-1 block truncate text-xs text-white/70">{message.subject}</span>
            <span className="mt-1 block truncate text-xs text-white/45">{message.message}</span>
            <span className="mt-2 block font-mono text-[10px] text-white/40">{dateLabel(message.created_at)}</span>
          </button>)}
        </div>
        <div className="min-w-0 p-5 sm:p-6">
          {selected ? <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--navy-light)] pb-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">{selected.subject}</p><h3 className="mt-2 text-xl font-bold text-white">{selected.name}</h3><a href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`} className="mt-1 inline-flex items-center gap-2 text-sm text-white/65 underline decoration-white/25 underline-offset-4 hover:text-[var(--accent)]"><Mail size={14} />{selected.email}</a><p className="mt-2 text-xs text-white/40">Received {dateLabel(selected.created_at)}</p></div>
              <div className="flex gap-2">{selected.status !== 'new' && <button type="button" onClick={() => void updateStatus(selected, 'new')} title="Mark unread" aria-label="Mark unread" className="inline-flex h-9 w-9 items-center justify-center border border-[var(--navy-light)] text-white/65 hover:border-[var(--accent)] hover:text-[var(--accent)]"><MailOpen size={15} /></button>}{selected.status !== 'archived' ? <button type="button" onClick={() => void updateStatus(selected, 'archived')} className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/70 hover:border-[var(--accent)] hover:text-white"><Archive size={14} />Archive</button> : <button type="button" onClick={() => void updateStatus(selected, 'read')} className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/70 hover:border-[var(--accent)] hover:text-white"><Inbox size={14} />Restore</button>}</div>
            </div>
            <p className="whitespace-pre-wrap break-words py-6 text-sm leading-7 text-white/80">{selected.message}</p>
            <a href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`} className="inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] hover:bg-white"><Mail size={15} />Reply by email</a>
          </> : <EmptyState title="Select a message" subtitle="Choose a message from the list to read it." onDark />}
        </div>
      </div>
    )}
  </section>;
}
