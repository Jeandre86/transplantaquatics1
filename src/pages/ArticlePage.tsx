import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { Bookmark, Check, Heart, MessageCircle, MoreHorizontal, Share2, X } from 'lucide-react';
import { usePublishedArticles } from '../hooks/usePublishedArticles';
import { formatDate } from '../lib/utils';
import EmptyState from '../components/EmptyState';
import { FREE_MEMBER_STORIES_PER_MONTH, getMemberStoryReads, recordMemberStoryRead } from '../lib/storyAccess';
import { articleHtmlToText, sanitizeArticleHtml } from '../lib/articleContent';
import AdSlot from '../components/AdSlot';
import { trackArticleEvent } from '../lib/articleAnalytics';

type StoryComment = { id: string; text: string; createdAt: string };

function readStoredBoolean(key: string) {
  try { return window.localStorage.getItem(key) === 'true'; } catch { return false; }
}

function readStoredComments(key: string): StoryComment[] {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as StoryComment[] : [];
  } catch { return []; }
}

function splitRichBodyForInlineAd(html: string): [string, string] {
  if (typeof DOMParser === 'undefined') return [html, ''];
  const documentBody = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild;
  if (!documentBody) return [html, ''];
  const nodes = Array.from(documentBody.childNodes);
  const splitAt = Math.ceil(nodes.length / 2);
  const toHtml = (items: Node[]) => items.map(node => {
    if (node.nodeType === Node.ELEMENT_NODE) return (node as Element).outerHTML;
    const wrapper = document.createElement('div');
    wrapper.append(node.cloneNode(true));
    return wrapper.innerHTML;
  }).join('');
  return [toHtml(nodes.slice(0, splitAt)), toHtml(nodes.slice(splitAt))];
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { articles, loading } = usePublishedArticles();
  const article = articles.find(a => a.slug === slug);
  const [memberReads, setMemberReads] = useState(getMemberStoryReads);
  const [friendLinkCopied, setFriendLinkCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const commentsRef = useRef<HTMLElement>(null);
  const readEndRef = useRef<HTMLDivElement>(null);
  const storyKey = article?.slug ?? slug ?? 'missing';
  const likedKey = `ta-story-liked-${storyKey}`;
  const savedKey = `ta-story-saved-${storyKey}`;
  const commentsKey = `ta-story-comments-${storyKey}`;
  const alreadyRead = Boolean(article && memberReads.includes(article.slug));
  const hasFriendAccess = Boolean(article?.access === 'member' && article.friendLinkToken && searchParams.get('friend') === article.friendLinkToken);
  const canReadFullStory = Boolean(article && (article.access !== 'member' || hasFriendAccess || alreadyRead || memberReads.length < FREE_MEMBER_STORIES_PER_MONTH));

  useEffect(() => {
    if (article?.access !== 'member' || hasFriendAccess || alreadyRead || !canReadFullStory) return;
    setMemberReads(recordMemberStoryRead(article.slug));
  }, [article?.slug, article?.access, hasFriendAccess, alreadyRead, canReadFullStory]);

  useEffect(() => {
    setLiked(readStoredBoolean(likedKey));
    setSaved(readStoredBoolean(savedKey));
    setComments(readStoredComments(commentsKey));
    setCommentsOpen(false);
    setMoreOpen(false);
  }, [likedKey, savedKey, commentsKey]);

  useEffect(() => {
    if (!article || !canReadFullStory) return;
    void trackArticleEvent(article.id, 'view');
  }, [article?.id, canReadFullStory]);

  useEffect(() => {
    if (!article || !canReadFullStory || typeof IntersectionObserver === 'undefined') return;
    const startedAt = Date.now();
    let reachedEnd = false;
    let tracked = false;
    const trackIfReady = () => {
      if (reachedEnd && !tracked && Date.now() - startedAt >= 10_000) {
        tracked = true;
        void trackArticleEvent(article.id, 'read_complete');
      }
    };
    const timer = window.setTimeout(trackIfReady, 10_000);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        reachedEnd = true;
        trackIfReady();
      }
    }, { threshold: 0.1 });
    if (readEndRef.current) observer.observe(readEndRef.current);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [article?.id, canReadFullStory]);

  useEffect(() => {
    if (location.hash === '#comments') {
      commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, slug]);

  async function copyFriendLink() {
    if (!article?.friendLinkToken) return;
    const url = `${window.location.origin}/from-the-pool-deck/${article.slug}?friend=${encodeURIComponent(article.friendLinkToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      setFriendLinkCopied(true);
      window.setTimeout(() => setFriendLinkCopied(false), 2500);
    } catch {
      window.prompt('Copy this Friend Link:', url);
    }
  }

  async function copyStoryLink() {
    if (article) void trackArticleEvent(article.id, 'share');
    const url = `${window.location.origin}/from-the-pool-deck/${storyKey}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt('Copy this story link:', url);
    }
  }

  function toggleLiked() {
    const next = !liked;
    setLiked(next);
    if (next && article) void trackArticleEvent(article.id, 'like');
    try { window.localStorage.setItem(likedKey, String(next)); } catch { /* local preview storage is optional */ }
  }

  function toggleSaved() {
    const next = !saved;
    setSaved(next);
    if (next && article) void trackArticleEvent(article.id, 'save');
    try { window.localStorage.setItem(savedKey, String(next)); } catch { /* local preview storage is optional */ }
  }

  function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = commentDraft.trim();
    if (!text) return;
    const next = [{ id: `${Date.now()}`, text, createdAt: new Date().toISOString() }, ...comments];
    setComments(next);
    setCommentDraft('');
    try { window.localStorage.setItem(commentsKey, JSON.stringify(next)); } catch { /* local preview storage is optional */ }
  }

  if (!article) {
    return (
      <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
        <div className="max-w-3xl mx-auto px-6 py-20">
          <EmptyState
            title={loading ? 'Loading story' : 'Article not found'}
            subtitle={loading ? 'Getting the published article…' : 'This article may have been moved or removed.'}
            onDark
          />
          <div className="mt-8 flex justify-center">
            <Link
              to="/from-the-pool-deck"
              className="font-mono text-xs uppercase tracking-widest px-5 py-2.5 border transition-colors"
              style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
            >
              Back to articles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const related = articles.filter(a => a.slug !== slug).slice(0, 2);
  const bodyIsRichHtml = /<(?:p|h[23]|blockquote|ul|ol|img|strong|em)\b/i.test(article.body ?? '');
  const safeArticleBody = bodyIsRichHtml ? sanitizeArticleHtml(article.body ?? '') : '';
  const [richBodyBeforeAd, richBodyAfterAd] = bodyIsRichHtml ? splitRichBodyForInlineAd(safeArticleBody) : ['', ''];
  const bodyParagraphs = (article.body || article.excerpt) ? (bodyIsRichHtml ? articleHtmlToText(article.body ?? '') : article.body || article.excerpt).split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean) : [];
  const commentsEnabled = article.commentsEnabled !== false;
  const isFriendStory = hasFriendAccess;
  const storyLabel = isFriendStory ? 'Friend Link' : article.access === 'member' ? 'Member-only' : 'Free story';
  const storyTags = article.tags ?? [article.category];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--paper)', color: 'var(--ink)' }}>
      <div className="max-w-7xl mx-auto px-4 pt-5 sm:px-6 lg:pt-8">
        <Link to="/from-the-pool-deck" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-neutral-500 transition-colors hover:text-[#00c2d7]">
          <span aria-hidden="true">←</span> From the Pool Deck
        </Link>
        <figure className="mt-5 h-56 overflow-hidden bg-[#10151b] sm:h-80 lg:h-[460px]">
          <img src={article.coverImage ?? '/assets/aquatics-hero.png'} alt={`Cover image for ${article.title}`} className="h-full w-full object-cover" />
        </figure>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="mx-auto w-full pb-8 pt-8 md:pt-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${isFriendStory ? 'border-[#00a7b9]/30 bg-[#00c2d7]/10 text-[#007d89]' : article.access === 'member' ? 'border-[#f0b544]/40 bg-[#fff4d6] text-[#815600]' : 'border-emerald-700/20 bg-emerald-50 text-emerald-800'}`}>
              {isFriendStory && <Check size={13} aria-hidden="true" />}{storyLabel}
            </span>
            {article.access === 'member' && !isFriendStory && <span className="font-mono text-xs text-neutral-500">{Math.max(0, FREE_MEMBER_STORIES_PER_MONTH - memberReads.length)} of {FREE_MEMBER_STORIES_PER_MONTH} free member-only reads left this month</span>}
            {hasFriendAccess && <span className="font-mono text-xs text-neutral-500">Unlimited access through this Friend Link</span>}
          </div>

          <div className="mt-5 flex flex-wrap gap-2" aria-label="Story categories">
            {storyTags.map(tag => <span key={tag} className="rounded-full bg-neutral-200/70 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-600">{tag}</span>)}
          </div>

          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.08] tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">{article.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-neutral-600">{article.excerpt}</p>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-5 border-b border-neutral-200 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0c233f] font-mono text-sm font-bold text-white" aria-hidden="true">{article.author.split(' ').map(part => part[0]).join('').slice(0, 2)}</div>
              <div>
                <p className="font-semibold text-neutral-900">{article.author}</p>
                <p className="mt-1 font-mono text-xs text-neutral-500">{formatDate(article.date)} <span className="mx-1">·</span> {article.readTime} min read</p>
              </div>
              {article.access === 'member' && article.friendLinkToken && <button type="button" onClick={copyFriendLink} className="ml-1 rounded-full border border-neutral-300 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-700 transition-colors hover:border-[#00c2d7] hover:text-[#007d89]">{friendLinkCopied ? 'Copied' : 'Friend Link'}</button>}
            </div>
            <div className="flex items-center gap-1 text-neutral-600" aria-label="Story actions">
              <button type="button" onClick={toggleLiked} aria-pressed={liked} aria-label={liked ? 'Unlike story' : 'Like story'} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-neutral-200 ${liked ? 'text-rose-600' : ''}`}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /><span>{liked ? 1 : 0}</span></button>
              {commentsEnabled && <button type="button" onClick={() => { setCommentsOpen(value => !value); window.setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }} aria-expanded={commentsOpen} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-neutral-200"><MessageCircle size={18} /><span>{comments.length}</span></button>}
              <button type="button" onClick={toggleSaved} aria-pressed={saved} aria-label={saved ? 'Remove bookmark' : 'Bookmark story'} className={`rounded-full p-2 transition-colors hover:bg-neutral-200 ${saved ? 'text-[#007d89]' : ''}`}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /></button>
              <button type="button" onClick={copyStoryLink} aria-label="Share story" className="rounded-full p-2 transition-colors hover:bg-neutral-200"><Share2 size={18} /></button>
              <div className="relative">
                <button type="button" onClick={() => setMoreOpen(value => !value)} aria-label="More story options" aria-expanded={moreOpen} className="rounded-full p-2 transition-colors hover:bg-neutral-200"><MoreHorizontal size={20} /></button>
                {moreOpen && <div className="absolute right-0 top-full z-10 mt-2 w-48 border border-neutral-200 bg-white p-2 shadow-lg"><button type="button" onClick={copyStoryLink} className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100">{linkCopied ? 'Link copied' : 'Copy story link'}</button>{article.access === 'member' && article.friendLinkToken && <button type="button" onClick={copyFriendLink} className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100">{friendLinkCopied ? 'Friend Link copied' : 'Copy Friend Link'}</button>}</div>}
              </div>
            </div>
          </div>
          {linkCopied && <p role="status" className="mt-2 text-right font-mono text-xs text-[#007d89]">Story link copied</p>}
        </header>

        {!canReadFullStory ? (
          <section className="pb-16" aria-labelledby="membership-gate-title">
            <div className="relative isolate flex min-h-[680px] items-center justify-center overflow-hidden py-16">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[360px] select-none overflow-hidden">
                <div className="mx-auto max-w-3xl space-y-7 px-4 pt-8 text-lg leading-8 text-neutral-600 opacity-[0.18] blur-[1px]">
                  {bodyParagraphs.slice(0, 4).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </div>
              </div>
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-white/10 via-[var(--paper)]/90 to-[var(--paper)]" />
              <div className="relative mx-auto w-full max-w-2xl px-3 text-center sm:px-8">
                <span className="inline-flex items-center bg-[#ffbf24] px-4 py-2 text-sm font-semibold text-neutral-950">Membership access</span>
                <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-neutral-500">You’ve reached your monthly limit</p>
                <h2 id="membership-gate-title" className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-5xl">Access to every story.</h2>
                <p className="mx-auto mt-3 max-w-xl text-xl leading-snug text-neutral-800">Unlock every member-only story.</p>
                <ul className="mx-auto mt-8 inline-flex flex-col gap-3 text-left text-sm text-neutral-700 sm:text-base">
                  <li className="flex items-start gap-3"><Check size={19} className="mt-0.5 shrink-0 text-neutral-800" /><span>Read member-only stories without a monthly limit</span></li>
                  <li className="flex items-start gap-3"><Check size={19} className="mt-0.5 shrink-0 text-neutral-800" /><span>Support the writers sharing transplant swimming stories</span></li>
                  <li className="flex items-start gap-3"><Check size={19} className="mt-0.5 shrink-0 text-neutral-800" /><span>Keep up with every new story from the pool deck</span></li>
                </ul>
                <Link to="/join" className="mx-auto mt-9 flex min-h-14 w-full max-w-sm items-center justify-center rounded-full bg-neutral-950 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-[#007d89]">Upgrade now</Link>
                <p className="mx-auto mt-5 max-w-lg text-xs leading-relaxed text-neutral-500">Free stories remain unlimited. You can also read this member-only story with a Friend Link from its author.</p>
                <Link to="/from-the-pool-deck" className="mt-5 inline-flex text-sm font-medium text-neutral-700 underline underline-offset-4 transition-colors hover:text-[#007d89]">Browse more stories</Link>
              </div>
            </div>
          </section>
        ) : (
          <div className="mx-auto grid grid-cols-1 gap-10 pb-16 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
            <article className="min-w-0">
              {article.access === 'member' && <p className="mb-7 border-l-4 border-[#00c2d7] bg-white/70 px-5 py-4 text-sm leading-relaxed text-neutral-700">{hasFriendAccess ? 'You are reading with a Friend Link.' : `Member-only story · ${Math.max(0, FREE_MEMBER_STORIES_PER_MONTH - memberReads.length)} free reads remaining this month.`}</p>}
              {bodyIsRichHtml ? <div className="article-rich-content space-y-7 text-lg leading-[1.85] text-neutral-800 [&_a]:text-[#007d89] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#00c2d7] [&_blockquote]:pl-6 [&_blockquote]:italic [&_h2]:mt-10 [&_h2]:text-3xl [&_h2]:font-bold [&_h3]:mt-8 [&_h3]:text-2xl [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-7 [&_ul]:list-disc [&_ul]:pl-7"><div dangerouslySetInnerHTML={{ __html: richBodyBeforeAd }} /><div className="my-10"><AdSlot placement="article_inline" compact /></div>{richBodyAfterAd && <div dangerouslySetInnerHTML={{ __html: richBodyAfterAd }} />}</div> : <div className="space-y-7 text-lg leading-[1.85] text-neutral-800">
                {bodyParagraphs.map((para, i) => <div key={i}>
                  <p>{para}</p>
                  {i === Math.min(2, bodyParagraphs.length - 1) && <div className="my-10"><AdSlot placement="article_inline" compact /></div>}
                  {i === 3 && <blockquote className="my-10 border-l-4 border-[#00c2d7] py-2 pl-6 text-2xl font-semibold leading-snug text-neutral-900">“Every split matters. Every lane tells a story.”<footer className="mt-3 font-mono text-xs font-normal uppercase tracking-widest text-[#007d89]">— Transplant Aquatics</footer></blockquote>}
                </div>)}
              </div>}
              <div ref={readEndRef} aria-hidden="true" className="h-px" />
              <div className="mt-12 border-y border-neutral-200 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={toggleLiked} aria-pressed={liked} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-neutral-200 ${liked ? 'text-rose-600' : 'text-neutral-700'}`}><Heart size={17} fill={liked ? 'currentColor' : 'none'} /> Appreciate · {liked ? 1 : 0}</button>
                    {commentsEnabled && <button type="button" onClick={() => { setCommentsOpen(true); commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-700 transition-colors hover:bg-neutral-200"><MessageCircle size={17} /> Respond</button>}
                  </div>
                  <button type="button" onClick={toggleSaved} aria-pressed={saved} className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-700 transition-colors hover:bg-neutral-200"><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save for later'}</button>
                </div>
              </div>
              {commentsEnabled && <section id="comments" ref={commentsRef} className="mt-12 scroll-mt-24" aria-label="Comments">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold text-neutral-950">Responses <span className="font-mono text-base font-normal text-neutral-500">({comments.length})</span></h2>
                  <button type="button" onClick={() => setCommentsOpen(value => !value)} aria-expanded={commentsOpen} className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-neutral-600 hover:text-[#007d89]">{commentsOpen ? <X size={16} /> : <MessageCircle size={16} />}{commentsOpen ? 'Close' : 'Respond'}</button>
                </div>
                {commentsOpen && <form onSubmit={addComment} className="mt-5 border border-neutral-200 bg-white p-4 sm:p-5">
                  <label htmlFor="story-comment" className="sr-only">Write a response</label>
                  <textarea id="story-comment" value={commentDraft} onChange={event => setCommentDraft(event.target.value)} rows={3} placeholder="What did you think?" className="w-full resize-y border-0 bg-transparent text-sm leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400" />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3"><span className="font-mono text-[10px] text-neutral-400">Preview responses are saved on this device.</span><button type="submit" disabled={!commentDraft.trim()} className="bg-[#0c233f] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#007d89] disabled:cursor-not-allowed disabled:opacity-40">Post response</button></div>
                </form>}
                <div className="mt-5 space-y-4">{comments.map(comment => <div key={comment.id} className="border-b border-neutral-200 pb-4"><p className="font-semibold text-neutral-900">Reader</p><p className="mt-2 text-sm leading-relaxed text-neutral-700">{comment.text}</p><time className="mt-2 block font-mono text-[10px] text-neutral-400">{formatDate(comment.createdAt)}</time></div>)}</div>
              </section>}
            </article>
            <aside className="space-y-6 lg:pt-2">
              <AdSlot placement="article_sidebar" />
              <div className="border-t border-neutral-200 pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">More from the deck</p>
                {related.map(item => <Link key={item.id} to={`/from-the-pool-deck/${item.slug}`} className="mt-4 block border-b border-neutral-200 pb-4 text-neutral-900 hover:text-[#007d89]"><span className="font-mono text-[10px] uppercase tracking-wider text-[#007d89]">{item.category}</span><span className="mt-1 block font-semibold leading-snug">{item.title}</span><span className="mt-2 block font-mono text-[10px] text-neutral-500">{item.readTime} min read</span></Link>)}
              </div>
            </aside>
          </div>
        )}
      </main>

    </div>
  );
}
