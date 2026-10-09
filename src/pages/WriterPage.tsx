import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { describeSupabaseError, hasSupabaseConfig, supabase } from '../lib/supabase';

type WriterArticle = {
  id: string; title: string; slug: string; excerpt: string; body: string; category: string;
  access: 'free' | 'member'; cover_image: string | null; tags: string[]; status: string;
  reviewer_note: string | null; updated_at: string; is_featured: boolean;
};
type ArticleStats = { views: number; completed_reads: number; shares: number; likes: number; saves: number };

const categories = ['Athlete Stories', 'Training', 'Nutrition', 'Community', 'Competition', 'News', 'Recovery', 'Lifestyle'];
const fieldClass = 'w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-[#00c2d7] focus:outline-none';

export default function WriterPage() {
  const auth = useAuth();
  const [userId, setUserId] = useState('');
  const [writerName, setWriterName] = useState('');
  const [isWriter, setIsWriter] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [articles, setArticles] = useState<WriterArticle[]>([]);
  const [articleStats, setArticleStats] = useState<Record<string, ArticleStats>>({});
  const [analyticsAvailable, setAnalyticsAvailable] = useState(false);
  const [section, setSection] = useState<'dashboard' | 'content' | 'write'>('dashboard');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({ title: '', excerpt: '', body: '', category: 'Community', access: 'free' as 'free' | 'member', cover_image: '', tags: '' });
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadArticles = useCallback(async (id: string) => {
    if (!supabase || !id) return;
    const { data, error: queryError } = await supabase.from('site_articles')
      .select('id,title,slug,excerpt,body,category,access,cover_image,tags,status,reviewer_note,updated_at,is_featured')
      .eq('author_id', id).order('updated_at', { ascending: false });
    if (queryError) throw queryError;
    setArticles((data ?? []) as WriterArticle[]);
    const { data: analytics, error: analyticsError } = await supabase.rpc('writer_article_analytics');
    if (analyticsError) {
      setAnalyticsAvailable(false);
      setArticleStats({});
      return;
    }
    const stats = Object.fromEntries((analytics ?? []).map((row: Record<string, unknown>) => [String(row.article_id), {
      views: Number(row.views ?? 0), completed_reads: Number(row.completed_reads ?? 0), shares: Number(row.shares ?? 0),
      likes: Number(row.likes ?? 0), saves: Number(row.saves ?? 0),
    }]));
    setArticleStats(stats);
    setAnalyticsAvailable(true);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      if (!supabase || !auth.isLoggedIn) { setLoading(false); return; }
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;
        if (!active) return;
        setUserId(user.id);
        setMustChangePassword(user.app_metadata?.site_role === 'writer' && user.app_metadata?.must_change_password === true);
        const { data: writer, error: writerError } = await supabase.from('site_writers').select('display_name,status').eq('user_id', user.id).maybeSingle();
        if (writerError) throw writerError;
        if (writer) {
          setWriterName(writer.display_name);
          setIsWriter(writer.status === 'active');
          await loadArticles(user.id);
        }
      } catch (reason) { if (active) setError(describeSupabaseError(reason)); }
      finally { if (active) setLoading(false); }
    }
    void init();
    return () => { active = false; };
  }, [auth.isLoggedIn, loadArticles]);

  const clearForm = () => {
    setEditingId('');
    setForm({ title: '', excerpt: '', body: '', category: 'Community', access: 'free', cover_image: '', tags: '' });
  };

  const editArticle = (article: WriterArticle) => {
    setEditingId(article.id);
    setForm({ title: article.title, excerpt: article.excerpt, body: article.body, category: article.category, access: article.access, cover_image: article.cover_image ?? '', tags: article.tags.join(', ') });
    setNotice('Draft opened for editing.');
  };

  const saveDraft = async (event?: FormEvent, manageBusy = true): Promise<boolean> => {
    event?.preventDefault();
    if (!supabase || !userId) return false;
    if (manageBusy) setBusy(true); setError(''); setNotice('');
    const slugBase = form.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'story';
    const payload = {
      author_id: userId, author_name: writerName, title: form.title.trim(), excerpt: form.excerpt.trim(), body: form.body.trim(),
      category: form.category, access: form.access, cover_image: form.cover_image.trim() || null,
      tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      read_time: Math.max(1, Math.ceil(form.body.trim().split(/\s+/).filter(Boolean).length / 200)),
      ...(editingId ? {} : { slug: `${slugBase}-${crypto.randomUUID().slice(0, 6)}`, status: 'draft' }),
    };
    try {
      const result = editingId
        ? await supabase.from('site_articles').update(payload).eq('id', editingId).select('id').single()
        : await supabase.from('site_articles').insert(payload).select('id').single();
      if (result.error) throw result.error;
      setEditingId(result.data.id);
      setNotice('Draft saved. You can keep editing or submit it for review.');
      await loadArticles(userId);
      return true;
    } catch (reason) { setError(describeSupabaseError(reason)); return false; }
    finally { if (manageBusy) setBusy(false); }
  };

  const submitArticle = async () => {
    if (!supabase || !editingId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (!await saveDraft(undefined, false)) return;
      const { error: submitError } = await supabase.rpc('writer_submit_article', { p_article_id: editingId });
      if (submitError) throw submitError;
      const { data, error: notifyError } = await supabase.functions.invoke('writer-workflow', { body: { action: 'notify_submission', articleId: editingId } });
      if (notifyError) throw notifyError;
      setNotice(data?.message ?? 'Article submitted for review.');
      clearForm();
      await loadArticles(userId);
    } catch (reason) { setError(describeSupabaseError(reason)); }
    finally { setBusy(false); }
  };

  const setFirstPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || password.length < 8 || password !== passwordConfirm) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: functionError } = await supabase.functions.invoke('writer-workflow', { body: { action: 'set_password', password } });
      if (functionError) throw functionError;
      setMustChangePassword(false); setIsWriter(true); setNotice(data?.message ?? 'Your writer access is ready.');
      if (userId) await loadArticles(userId);
    } catch (reason) { setError(describeSupabaseError(reason)); }
    finally { setBusy(false); setPassword(''); setPasswordConfirm(''); }
  };

  if (!hasSupabaseConfig) return <PageHeading eyebrow="Writer workspace" title="Connect the publishing database" />;
  if (!auth.isLoggedIn) return <><PageHeading eyebrow="Writer workspace" title="Sign in to continue" /><section className="mx-auto max-w-3xl px-4 py-10"><EmptyState title="Writer sign-in required" subtitle="Use the account from your writer invitation to open your editorial dashboard." action={<Link className="font-semibold text-[#1769c2]" to="/writer/login">Writer sign in →</Link>} /></section></>;

  return <div className="min-h-screen bg-[var(--paper)]">
    <PageHeading eyebrow="From the Pool Deck" title="Writer workspace" description="Track your published stories, manage your content and submit new articles." />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {error && <div role="alert" className="mb-5 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mb-5 border border-[#00c2d7]/40 bg-[#00c2d7]/10 px-4 py-3 text-sm text-neutral-800">{notice}</div>}
      {mustChangePassword ? <form onSubmit={setFirstPassword} className="max-w-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-xl font-bold text-neutral-950">Set your password</h2><p className="mt-2 text-sm text-neutral-600">Choose a personal password before opening the writer workspace.</p>
        <label className="mt-5 block text-sm font-semibold">New password<input type="password" required minLength={8} autoComplete="new-password" className={`${fieldClass} mt-2`} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label className="mt-4 block text-sm font-semibold">Confirm password<input type="password" required minLength={8} autoComplete="new-password" className={`${fieldClass} mt-2`} value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} /></label>
        <button disabled={busy || password !== passwordConfirm || password.length < 8} className="mt-5 bg-[#0c233f] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Set password'}</button>
      </form> : loading ? <p className="py-10 text-center text-sm text-neutral-500">Loading writer workspace…</p> : !isWriter ? <div className="max-w-xl border border-neutral-200 bg-white p-6"><EmptyState title="Writer access not found" subtitle="This account has not been added as a writer. Ask an administrator to send a writer invitation." /></div> : <>
        <nav aria-label="Writer workspace sections" className="mb-7 flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
          {([['dashboard', 'Dashboard'], ['content', 'Articles'], ['write', 'Write an article']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setSection(key)} aria-current={section === key ? 'page' : undefined} className={`px-4 py-2 text-sm font-semibold ${section === key ? 'border-b-2 border-[#00a8b8] text-[#0c233f]' : 'text-neutral-500 hover:text-neutral-900'}`}>{label}</button>)}
        </nav>
        {section === 'dashboard' && <section>
          <div className="mb-6"><h2 className="text-2xl font-bold text-neutral-950">Welcome back{writerName ? `, ${writerName}` : ''}</h2><p className="mt-1 text-sm text-neutral-500">A quick look at your articles and editorial progress.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[[articles.filter(article => article.status === 'published').length, 'Live articles'], [articles.filter(article => ['submitted', 'in_review'].includes(article.status)).length, 'In editorial review'], [articles.filter(article => article.status === 'draft').length, 'Drafts'], [articles.filter(article => article.status === 'changes_requested').length, 'Changes requested']].map(([value, label]) => <div key={label} className="border border-neutral-200 bg-white p-5"><p className="text-3xl font-bold text-neutral-950">{value}</p><p className="mt-1 text-sm text-neutral-500">{label}</p></div>)}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[[Object.values(articleStats).reduce((sum, stats) => sum + stats.views, 0), 'Reader views'], [Object.values(articleStats).reduce((sum, stats) => sum + stats.completed_reads, 0), 'Completed reads'], [Object.values(articleStats).reduce((sum, stats) => sum + stats.shares, 0), 'Shares']].map(([value, label]) => <div key={label} className="border border-neutral-200 bg-white p-5"><p className="text-2xl font-bold text-neutral-950">{analyticsAvailable ? value : '—'}</p><p className="mt-1 text-sm text-neutral-500">{label}</p></div>)}
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
            <section className="border border-neutral-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-neutral-950">Recently published</h3><button type="button" onClick={() => setSection('content')} className="text-sm font-semibold text-[#1769c2]">View all articles →</button></div>
              {articles.filter(article => article.status === 'published').length ? <div className="mt-3 divide-y divide-neutral-200">{articles.filter(article => article.status === 'published').slice(0, 5).map(article => <article key={article.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold text-neutral-900">{article.title}</p><p className="mt-1 text-xs text-neutral-500">{article.category}{article.is_featured ? ' · Featured' : ''} · Updated {new Date(article.updated_at).toLocaleDateString()}</p></div><Link to={`/from-the-pool-deck/${article.slug}`} className="text-sm font-semibold text-[#1769c2]">View live story ↗</Link></article>)}</div> : <p className="mt-4 text-sm text-neutral-500">Your published articles will appear here once they are live.</p>}
            </section>
            <aside className="border border-neutral-200 bg-white p-5"><h3 className="font-bold text-neutral-950">Reader impact</h3><p className="mt-2 text-sm leading-6 text-neutral-600">{analyticsAvailable ? 'Views, completed reads and shares are now collected anonymously for your published stories.' : 'Reader analytics are not available yet. Apply the article analytics database migration to start collecting them.'} ROI still needs a revenue or conversion source to be calculated.</p><p className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-500">Readers are counted with a random session identifier; no names or contact details are collected.</p></aside>
          </div>
        </section>}
        {section === 'content' && <section className="border border-neutral-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-neutral-950">Articles</h2><p className="mt-1 text-sm text-neutral-500">All stories you have written, with their current editorial status.</p></div><button type="button" onClick={() => { clearForm(); setSection('write'); }} className="bg-[#0c233f] px-4 py-2.5 text-sm font-bold text-white">Write an article</button></div>
          {articles.length ? <div className="mt-5 divide-y divide-neutral-200">{articles.map(article => { const stats = articleStats[article.id]; return <article key={article.id} className="flex flex-wrap items-start justify-between gap-4 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-neutral-900">{article.title || 'Untitled draft'}</h3><span className="bg-neutral-100 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-600">{article.status.replaceAll('_', ' ')}</span>{article.is_featured && <span className="text-xs font-semibold text-amber-700">Featured</span>}</div><p className="mt-1 text-sm text-neutral-500">{article.category} · Updated {new Date(article.updated_at).toLocaleDateString()}</p>{article.status === 'published' && <p className="mt-2 text-xs text-neutral-500">{analyticsAvailable ? `${stats?.views ?? 0} views · ${stats?.completed_reads ?? 0} completed reads · ${stats?.shares ?? 0} shares · ${stats?.likes ?? 0} likes · ${stats?.saves ?? 0} saves` : 'Reader stats unavailable'}</p>}{article.reviewer_note && <p className="mt-2 text-sm text-amber-800">Editor note: {article.reviewer_note}</p>}</div><div className="flex gap-4">{article.status === 'published' && <Link to={`/from-the-pool-deck/${article.slug}`} className="text-sm font-semibold text-[#1769c2]">View live ↗</Link>}{['draft','changes_requested'].includes(article.status) && <button type="button" onClick={() => { editArticle(article); setSection('write'); }} className="text-sm font-bold text-[#1769c2]">Edit</button>}</div></article>; })}</div> : <p className="mt-6 text-sm text-neutral-500">No articles yet. Start by writing your first story.</p>}
        </section>}
        {section === 'write' && <section className="border border-neutral-200 bg-white p-5 sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[#007d89]">Authoring</p><h2 className="mt-1 text-xl font-bold text-neutral-950">{editingId ? 'Edit story' : 'Write a story'}</h2></div>{editingId && <button type="button" onClick={clearForm} className="text-sm text-neutral-500 hover:text-neutral-900">New story</button>}</div>
          <form onSubmit={event => { void saveDraft(event); }} className="space-y-4">
            <label className="block text-sm font-semibold">Headline<input required minLength={5} className={`${fieldClass} mt-2 text-lg`} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Give your story a clear headline" /></label>
            <label className="block text-sm font-semibold">Summary<textarea required minLength={20} rows={2} className={`${fieldClass} mt-2`} value={form.excerpt} onChange={event => setForm(current => ({ ...current, excerpt: event.target.value }))} placeholder="A short introduction shown on the news page" /></label>
            <label className="block text-sm font-semibold">Article text<textarea required minLength={100} rows={14} className={`${fieldClass} mt-2 leading-7`} value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} placeholder="Write your article here. Use a blank line to start a new paragraph." /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Category<select className={`${fieldClass} mt-2`} value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label className="block text-sm font-semibold">Access<select className={`${fieldClass} mt-2`} value={form.access} onChange={event => setForm(current => ({ ...current, access: event.target.value as 'free' | 'member' }))}><option value="free">Free story</option><option value="member">Member-only story</option></select></label></div>
            <label className="block text-sm font-semibold">Cover image URL<input type="url" className={`${fieldClass} mt-2`} value={form.cover_image} onChange={event => setForm(current => ({ ...current, cover_image: event.target.value }))} placeholder="https://…" /></label>
            <label className="block text-sm font-semibold">Tags<input className={`${fieldClass} mt-2`} value={form.tags} onChange={event => setForm(current => ({ ...current, tags: event.target.value }))} placeholder="Separate tags with commas" /></label>
            <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-5"><button disabled={busy} className="border border-neutral-300 px-4 py-2.5 text-sm font-bold text-neutral-800 disabled:opacity-40">{busy ? 'Saving…' : 'Save draft'}</button><button type="button" disabled={busy || !editingId} onClick={() => void submitArticle()} className="bg-[#0c233f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Submit for editorial review</button></div>
          </form>
        </section>
        }
      </>}
    </main>
  </div>;
}
