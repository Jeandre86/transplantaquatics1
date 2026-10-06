import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import EmptyState from './EmptyState';
import { describeSupabaseError, supabase } from '../lib/supabase';

type Article = { id: string; title: string; slug: string; author_name: string; category: string; status: string; is_featured: boolean; access: string; comments_enabled: boolean; published_at: string | null; updated_at: string };

export default function AdminArticleLibrary({ onEdit, onError, onNotice }: {
  onEdit: (id: string) => void; onError: (message: string) => void; onNotice: (message: string) => void;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Article | null>(null);
  const [confirmation, setConfirmation] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('site_articles').select('id,title,slug,author_name,category,status,is_featured,access,comments_enabled,published_at,updated_at').order('updated_at', { ascending: false }).limit(500);
    if (error) throw error;
    setArticles((data ?? []) as Article[]);
  }, []);

  useEffect(() => { setLoading(true); void load().catch(error => onError(describeSupabaseError(error))).finally(() => setLoading(false)); }, [load, onError]);

  const filtered = useMemo(() => articles.filter(article => {
    const search = `${article.title} ${article.author_name} ${article.category} ${article.slug}`.toLowerCase();
    return (statusFilter === 'all' || article.status === statusFilter) && search.includes(query.toLowerCase());
  }), [articles, query, statusFilter]);

  const setArchived = async (article: Article) => {
    if (!supabase) return;
    setBusyId(article.id); onError(''); onNotice('');
    const nextStatus = article.status === 'archived' ? (article.published_at ? 'published' : 'draft') : 'archived';
    try {
      const { error } = await supabase.rpc('admin_set_article_status', { p_article_id: article.id, p_status: nextStatus });
      if (error) throw error;
      onNotice(nextStatus === 'archived' ? 'Article archived.' : 'Article restored to the library.');
      await load();
    } catch (error) { onError(describeSupabaseError(error)); }
    finally { setBusyId(''); }
  };

  const deleteArticle = async () => {
    if (!supabase || !pendingDelete || confirmation !== pendingDelete.title) return;
    setBusyId(pendingDelete.id); onError(''); onNotice('');
    try {
      const { error } = await supabase.rpc('admin_delete_article', { p_article_id: pendingDelete.id, p_confirmation_title: confirmation });
      if (error) throw error;
      onNotice(`“${pendingDelete.title}” was deleted.`);
      setPendingDelete(null); setConfirmation('');
      await load();
    } catch (error) { onError(describeSupabaseError(error)); }
    finally { setBusyId(''); }
  };

  return <>
    <section className="border p-5 sm:p-6" style={{ border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-bold text-white">Article library</h2><p className="mt-1 text-sm text-white/50">Manage drafts, submitted stories, published articles and archived content.</p></div><p className="font-mono text-xs text-white/45">{filtered.length} {filtered.length === 1 ? 'article' : 'articles'}</p></div>
      <div className="mt-5 space-y-3"><div className="flex items-center gap-2"><label className="relative block min-w-0 flex-1"><span className="sr-only">Search articles</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, author or category" className="w-full border border-[var(--navy-light)] bg-[var(--navy)] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" /></label><button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)} className="inline-flex shrink-0 items-center gap-2 border border-[var(--navy-light)] px-3 py-2.5 text-xs font-semibold text-white/75 hover:border-[var(--accent)]"><SlidersHorizontal size={15} aria-hidden="true" />{filtersOpen ? 'Hide filters' : 'Show filters'}</button></div>{filtersOpen && <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter articles by status" className="w-full max-w-xs border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white"><option value="all">All statuses</option>{['draft','submitted','changes_requested','rejected','published','archived'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select>}</div>
      {loading ? <p className="py-12 text-center text-sm text-white/50">Loading articles…</p> : filtered.length ? <div className="mt-5 divide-y divide-[var(--navy-light)]">{filtered.map(article => <article key={article.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{article.title || 'Untitled draft'}</h3>{article.is_featured && <span className="border border-[var(--accent)]/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--accent)]">Feature</span>}</div><p className="mt-1 text-xs text-white/50">{article.author_name} <span className="mx-1 text-white/20">·</span> {article.category} <span className="mx-1 text-white/20">·</span> {article.access === 'member' ? 'Member-only' : 'Free'}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/40">{article.status.replaceAll('_', ' ')} <span className="mx-1 text-white/20">·</span> Comments {article.comments_enabled ? 'on' : 'off'} <span className="mx-1 text-white/20">·</span> Updated {new Date(article.updated_at).toLocaleDateString()}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => onEdit(article.id)} className="inline-flex items-center gap-1.5 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"><Pencil size={13} /> Edit</button><button type="button" disabled={busyId === article.id} onClick={() => void setArchived(article)} className="inline-flex items-center gap-1.5 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/65 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40">{article.status === 'archived' ? <ArchiveRestore size={13} /> : <Archive size={13} />}{article.status === 'archived' ? 'Restore' : 'Archive'}</button><button type="button" onClick={() => { setPendingDelete(article); setConfirmation(''); }} className="inline-flex items-center gap-1.5 border border-red-300/20 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:border-red-300/60 hover:bg-red-950/30"><Trash2 size={13} /> Delete</button></div></article>)}</div> : <div className="mt-5"><EmptyState title={articles.length ? 'No articles match your search' : 'No articles yet'} subtitle={articles.length ? 'Try another search or status filter.' : 'Drafts and published stories will appear here.'} onDark /></div>}
    </section>
    {pendingDelete && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { setPendingDelete(null); setConfirmation(''); } }}><section role="dialog" aria-modal="true" aria-labelledby="delete-article-title" className="w-full max-w-lg border border-red-300/30 bg-[var(--navy-mid)] p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-red-300">Permanent deletion</p><h2 id="delete-article-title" className="mt-2 text-xl font-bold text-white">Delete this article?</h2></div><button type="button" onClick={() => { setPendingDelete(null); setConfirmation(''); }} aria-label="Close delete confirmation" className="p-1 text-white/50 hover:text-white"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-white/65">This permanently removes the article from the site. To confirm, type its headline exactly:</p><p className="mt-3 border border-[var(--navy-light)] bg-[var(--navy)] p-3 text-sm font-semibold text-white">{pendingDelete.title}</p><label className="mt-4 block text-xs font-semibold text-white/70">Article headline<input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-300" /></label><div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => { setPendingDelete(null); setConfirmation(''); }} className="border border-[var(--navy-light)] px-4 py-2.5 text-sm font-semibold text-white/70">Cancel</button><button type="button" disabled={busyId === pendingDelete.id || confirmation !== pendingDelete.title} onClick={() => void deleteArticle()} className="bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-35">{busyId === pendingDelete.id ? 'Deleting…' : 'Delete article'}</button></div></section></div>}
  </>;
}
