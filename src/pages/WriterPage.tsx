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

const categories = ['Athlete Stories', 'Training', 'Nutrition', 'Community', 'Competition', 'News', 'Recovery', 'Lifestyle'];
const fieldClass = 'w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-[#00c2d7] focus:outline-none';

export default function WriterPage() {
  const auth = useAuth();
  const [userId, setUserId] = useState('');
  const [writerName, setWriterName] = useState('');
  const [isWriter, setIsWriter] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [articles, setArticles] = useState<WriterArticle[]>([]);
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

  const saveDraft = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!supabase || !userId) return;
    setBusy(true); setError(''); setNotice('');
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
    } catch (reason) { setError(describeSupabaseError(reason)); }
    finally { setBusy(false); }
  };

  const submitArticle = async () => {
    if (!supabase || !editingId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await saveDraft();
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
  if (!auth.isLoggedIn) return <><PageHeading eyebrow="Writer workspace" title="Sign in to continue" /><section className="mx-auto max-w-3xl px-4 py-10"><EmptyState title="Writer sign-in required" subtitle="Open the invitation email, accept the invite, and sign in to access the writing workspace." action={<Link className="font-semibold text-[#1769c2]" to="/login">Sign in →</Link>} /></section></>;

  return <div className="min-h-screen bg-[var(--paper)]">
    <PageHeading eyebrow="From the Pool Deck" title="Writer workspace" description="Write stories, keep drafts, and send finished articles to the editorial team." />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {error && <div role="alert" className="mb-5 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mb-5 border border-[#00c2d7]/40 bg-[#00c2d7]/10 px-4 py-3 text-sm text-neutral-800">{notice}</div>}
      {mustChangePassword ? <form onSubmit={setFirstPassword} className="max-w-xl border border-neutral-200 bg-white p-6">
        <h2 className="text-xl font-bold text-neutral-950">Set your password</h2><p className="mt-2 text-sm text-neutral-600">Choose a personal password before opening the writer workspace.</p>
        <label className="mt-5 block text-sm font-semibold">New password<input type="password" required minLength={8} autoComplete="new-password" className={`${fieldClass} mt-2`} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label className="mt-4 block text-sm font-semibold">Confirm password<input type="password" required minLength={8} autoComplete="new-password" className={`${fieldClass} mt-2`} value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} /></label>
        <button disabled={busy || password !== passwordConfirm || password.length < 8} className="mt-5 bg-[#0c233f] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Set password'}</button>
      </form> : loading ? <p className="py-10 text-center text-sm text-neutral-500">Loading writer workspace…</p> : !isWriter ? <div className="max-w-xl border border-neutral-200 bg-white p-6"><EmptyState title="Writer access not found" subtitle="This account has not been added as a writer. Ask an administrator to send a writer invitation." /></div> : <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <section className="border border-neutral-200 bg-white p-5 sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[#007d89]">Authoring</p><h2 className="mt-1 text-xl font-bold text-neutral-950">{editingId ? 'Edit story' : 'Write a story'}</h2></div>{editingId && <button type="button" onClick={clearForm} className="text-sm text-neutral-500 hover:text-neutral-900">New story</button>}</div>
          <form onSubmit={saveDraft} className="space-y-4">
            <label className="block text-sm font-semibold">Headline<input required minLength={5} className={`${fieldClass} mt-2 text-lg`} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Give your story a clear headline" /></label>
            <label className="block text-sm font-semibold">Summary<textarea required minLength={20} rows={2} className={`${fieldClass} mt-2`} value={form.excerpt} onChange={event => setForm(current => ({ ...current, excerpt: event.target.value }))} placeholder="A short introduction shown on the news page" /></label>
            <label className="block text-sm font-semibold">Article text<textarea required minLength={100} rows={14} className={`${fieldClass} mt-2 leading-7`} value={form.body} onChange={event => setForm(current => ({ ...current, body: event.target.value }))} placeholder="Write your article here. Use a blank line to start a new paragraph." /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Category<select className={`${fieldClass} mt-2`} value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label className="block text-sm font-semibold">Access<select className={`${fieldClass} mt-2`} value={form.access} onChange={event => setForm(current => ({ ...current, access: event.target.value as 'free' | 'member' }))}><option value="free">Free story</option><option value="member">Member-only story</option></select></label></div>
            <label className="block text-sm font-semibold">Cover image URL<input type="url" className={`${fieldClass} mt-2`} value={form.cover_image} onChange={event => setForm(current => ({ ...current, cover_image: event.target.value }))} placeholder="https://…" /></label>
            <label className="block text-sm font-semibold">Tags<input className={`${fieldClass} mt-2`} value={form.tags} onChange={event => setForm(current => ({ ...current, tags: event.target.value }))} placeholder="Separate tags with commas" /></label>
            <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-5"><button disabled={busy} className="border border-neutral-300 px-4 py-2.5 text-sm font-bold text-neutral-800 disabled:opacity-40">{busy ? 'Saving…' : 'Save draft'}</button><button type="button" disabled={busy || !editingId} onClick={() => void submitArticle()} className="bg-[#0c233f] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Submit for editorial review</button></div>
          </form>
        </section>
        <aside className="border border-neutral-200 bg-white p-5 sm:p-6"><h2 className="font-bold text-neutral-950">Your stories</h2><p className="mt-1 text-sm text-neutral-500">Drafts, submitted articles and published work.</p>{articles.length ? <div className="mt-4 divide-y divide-neutral-200">{articles.map(article => <article key={article.id} className="py-4 first:pt-0"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-neutral-900">{article.title || 'Untitled draft'}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">{article.status.replaceAll('_', ' ')}{article.is_featured ? ' · featured' : ''}</p></div>{['draft','changes_requested'].includes(article.status) && <button type="button" onClick={() => editArticle(article)} className="text-xs font-bold text-[#1769c2]">Edit</button>}</div>{article.reviewer_note && <p className="mt-2 text-xs leading-relaxed text-amber-800">Editor: {article.reviewer_note}</p>}</article>)}</div> : <p className="mt-5 text-sm text-neutral-500">No stories yet. Start a draft on the left.</p>}</aside>
      </div>}
    </main>
  </div>;
}
