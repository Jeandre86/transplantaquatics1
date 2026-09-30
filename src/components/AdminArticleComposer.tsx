import { useCallback, useEffect, useRef, useState } from 'react';
import EmptyState from './EmptyState';
import RichArticleEditor from './RichArticleEditor';
import { articleHtmlToText } from '../lib/articleContent';
import { describeSupabaseError, supabase } from '../lib/supabase';

type ArticleRow = Record<string, unknown>;
type Form = { title: string; slug: string; excerpt: string; body: string; category: string; access: 'free' | 'member'; cover_image: string; tags: string; comments_enabled: boolean; is_featured: boolean };
const blankForm: Form = { title: '', slug: '', excerpt: '', body: '', category: 'Community', access: 'free', cover_image: '', tags: '', comments_enabled: true, is_featured: false };

export default function AdminArticleComposer({ userId, authorName, initialArticleId = '', onInitialEditLoaded, cardStyle, inputClass, onError, onNotice }: {
  userId: string; authorName: string; initialArticleId?: string; onInitialEditLoaded?: () => void; cardStyle: React.CSSProperties; inputClass: string;
  onError: (message: string) => void; onNotice: (message: string) => void;
}) {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<Form>(blankForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingPublished, setEditingPublished] = useState(false);
  const loadedInitialId = useRef('');

  const loadArticles = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data, error } = await supabase.from('site_articles').select('id,title,slug,excerpt,body,category,access,cover_image,tags,status,is_featured,comments_enabled,updated_at').order('updated_at', { ascending: false }).limit(500);
    if (error) throw error;
    setArticles((data ?? []) as ArticleRow[]);
  }, [userId]);

  useEffect(() => { setLoading(true); void loadArticles().catch(error => onError(describeSupabaseError(error))).finally(() => setLoading(false)); }, [loadArticles, onError]);

  const reset = () => { setEditingId(''); setEditingPublished(false); setForm(blankForm); };
  const edit = (article: ArticleRow) => {
    setEditingId(String(article.id));
    setEditingPublished(article.status === 'published');
    setForm({ title: String(article.title ?? ''), slug: String(article.slug ?? ''), excerpt: String(article.excerpt ?? ''), body: String(article.body ?? ''), category: String(article.category ?? 'Community'), access: article.access === 'member' ? 'member' : 'free', cover_image: String(article.cover_image ?? ''), tags: Array.isArray(article.tags) ? article.tags.join(', ') : '', comments_enabled: article.comments_enabled !== false, is_featured: article.is_featured === true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!initialArticleId || loading || loadedInitialId.current === initialArticleId) return;
    const article = articles.find(item => String(item.id) === initialArticleId);
    if (!article) return;
    loadedInitialId.current = initialArticleId;
    edit(article);
    onInitialEditLoaded?.();
  }, [initialArticleId, loading, articles, onInitialEditLoaded]);
  const titleLength = form.title.trim().length;
  const summaryLength = form.excerpt.trim().length;
  const bodyLength = articleHtmlToText(form.body).length;
  const canSaveDraft = titleLength > 0;
  const canPublish = titleLength >= 5 && summaryLength >= 20 && bodyLength >= 100;
  const save = async (publish: boolean, featured = false) => {
    if (!supabase || (publish ? !canPublish : !canSaveDraft)) return;
    setBusy(true); onError(''); onNotice('');
    const slugBase = form.title.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `story-${Date.now()}`;
    const slug = form.slug || `${slugBase}-${crypto.randomUUID().slice(0, 6)}`;
    try {
      const { data, error } = await supabase.rpc('admin_save_article', {
        p_article_id: editingId || null, p_author_name: authorName || 'Transplant Aquatics', p_title: form.title.trim(), p_slug: slug,
        p_excerpt: form.excerpt.trim(), p_body: form.body, p_category: form.category, p_access: form.access,
        p_cover_image: form.cover_image.trim() || null, p_tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        p_comments_enabled: form.comments_enabled, p_publish: publish, p_featured: featured,
      });
      if (error) throw error;
      onNotice(publish ? (featured ? 'Article published as a feature story.' : 'Article published.') : 'Draft saved.');
      if (publish && !editingId) reset(); else { setEditingId(String(data)); setEditingPublished(publish); setForm(current => ({ ...current, slug, is_featured: publish && featured })); }
      await loadArticles();
    } catch (error) { onError(describeSupabaseError(error)); }
    finally { setBusy(false); }
  };

  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
    <section className="border p-5 sm:p-7" style={cardStyle}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">From the Pool Deck</p><h2 className="mt-1 text-xl font-bold text-white">{editingId ? 'Edit article' : 'Write an article'}</h2>{editingId && <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/45">{editingPublished ? 'Published article' : 'Draft or archived article'}</p>}</div>{editingId && <button type="button" onClick={reset} className="text-sm text-white/55 hover:text-white">New article</button>}</div>
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-white/80">Headline<input required minLength={5} value={form.title} onChange={event => setForm(value => ({ ...value, title: event.target.value }))} className={`${inputClass} mt-2 text-lg`} placeholder="Give your story a clear headline" /></label>
        <label className="block text-sm font-semibold text-white/80">Story URL<input required value={form.slug} onChange={event => setForm(value => ({ ...value, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/--+/g, '-') }))} className={`${inputClass} mt-2 font-mono text-xs`} placeholder="Generated from the headline when saved" /></label>
        <label className="block text-sm font-semibold text-white/80">Story summary<textarea required minLength={20} rows={2} value={form.excerpt} onChange={event => setForm(value => ({ ...value, excerpt: event.target.value }))} className={`${inputClass} mt-2`} placeholder="The introduction readers see before opening your story" /></label>
        <div><p className="mb-2 text-sm font-semibold text-white/80">Article body</p><RichArticleEditor key={editingId || 'new-admin-article'} value={form.body} onChange={body => setForm(value => ({ ...value, body }))} dark /></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-white/80">Category<select value={form.category} onChange={event => setForm(value => ({ ...value, category: event.target.value }))} className={`${inputClass} mt-2`}><option>Community</option><option>Training</option><option>Health</option><option>Events</option><option>Stories</option></select></label><label className="block text-sm font-semibold text-white/80">Access<select value={form.access} onChange={event => setForm(value => ({ ...value, access: event.target.value as Form['access'] }))} className={`${inputClass} mt-2`}><option value="free">Free story</option><option value="member">Member-only story</option></select></label></div>
        <label className="block text-sm font-semibold text-white/80">Cover image URL<input type="url" value={form.cover_image} onChange={event => setForm(value => ({ ...value, cover_image: event.target.value }))} className={`${inputClass} mt-2`} placeholder="https://…" /></label>
        <label className="block text-sm font-semibold text-white/80">Categories and tags<input value={form.tags} onChange={event => setForm(value => ({ ...value, tags: event.target.value }))} className={`${inputClass} mt-2`} placeholder="Separate tags with commas" /></label>
        <label className="flex items-start gap-3 border-t border-[var(--navy-light)] pt-4 text-sm text-white/75"><input type="checkbox" checked={form.comments_enabled} onChange={event => setForm(value => ({ ...value, comments_enabled: event.target.checked }))} className="mt-0.5 accent-[var(--accent)]" /><span><span className="block font-semibold text-white">Allow comments</span><span className="mt-1 block text-xs text-white/45">Readers can respond to this story. New articles have comments enabled.</span></span></label>
        <label className="flex items-start gap-3 text-sm text-white/75"><input type="checkbox" checked={form.is_featured} onChange={event => setForm(value => ({ ...value, is_featured: event.target.checked }))} className="mt-0.5 accent-[var(--accent)]" /><span><span className="block font-semibold text-white">Feature article</span><span className="mt-1 block text-xs text-white/45">Show this story in the featured position on the news page.</span></span></label>
        <div className="border-t border-[var(--navy-light)] pt-4"><p className="font-mono text-[10px] uppercase tracking-wider text-white/45">Publish requirements</p><p className="mt-1 text-xs text-white/65"><span className={titleLength >= 5 ? 'text-emerald-300' : ''}>Headline {titleLength}/5</span><span className="mx-2 text-white/25">·</span><span className={summaryLength >= 20 ? 'text-emerald-300' : ''}>Summary {summaryLength}/20</span><span className="mx-2 text-white/25">·</span><span className={bodyLength >= 100 ? 'text-emerald-300' : ''}>Article {bodyLength}/100 characters</span></p><p className="mt-1 text-[11px] text-white/40">You can save a draft as soon as it has a headline. Publishing requires all three minimums.</p></div>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || !canSaveDraft} onClick={() => void save(false)} className="border border-[var(--navy-light)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Saving…' : 'Save draft'}</button><button type="button" disabled={busy || !canPublish} onClick={() => void save(true, form.is_featured)} className="bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:cursor-not-allowed disabled:opacity-40">{editingPublished ? 'Save changes' : 'Publish article'}</button>{!form.is_featured && <button type="button" disabled={busy || !canPublish} onClick={() => void save(true, true)} className="border border-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40">Publish as feature</button>}</div>
      </div>
    </section>
    <aside className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Article library</h2><p className="mt-1 text-sm text-white/50">Edit any article on the site, including published stories.</p>{loading ? <p className="mt-5 text-sm text-white/50">Loading articles…</p> : articles.length ? <div className="mt-4 divide-y divide-[var(--navy-light)]">{articles.map(article => <article key={String(article.id)} className="py-4 first:pt-0"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">{String(article.title || 'Untitled draft')}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/45">{String(article.status)}{article.is_featured ? ' · feature' : ''}</p><p className="mt-1 text-xs text-white/40">Comments {article.comments_enabled === false ? 'off' : 'on'}</p></div><button type="button" onClick={() => edit(article)} className="text-xs font-bold text-[var(--accent)]">Edit</button></div></article>)}</div> : <div className="mt-5"><EmptyState title="No articles yet" subtitle="Drafts and published stories will appear here." onDark /></div>}</aside>
  </div>;
}
