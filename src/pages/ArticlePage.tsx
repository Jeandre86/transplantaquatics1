import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { Bookmark, Check, Heart, MessageCircle, MoreHorizontal, Share2, X } from 'lucide-react';
import { articles } from '../data/articles';
import { formatDate } from '../lib/utils';
import EmptyState from '../components/EmptyState';
import { FREE_MEMBER_STORIES_PER_MONTH, getMemberStoryReads, recordMemberStoryRead } from '../lib/storyAccess';

// Extended article content (some articles get richer body text)
const ARTICLE_BODIES: Record<string, string[]> = {
  'the-race-doesnt-end-at-transplant': [
    'When Michael van der Berg stepped onto the blocks at the 2025 World Transplant Games in Dresden, Germany, he carried with him a decade of waiting, one successful kidney transplant, and a lifetime personal best that would have been remarkable for any masters swimmer. What made it extraordinary was everything that came before the swim.',
    'Transplant athletes occupy a unique space in global sport. They compete not despite their medical histories but because of them — their surgical scars a reminder of the gift that made competition possible. For many, the transplant is not an ending but an origin story.',
    '"Swimming gave me my identity back," van der Berg said after his 100m Freestyle gold in Dresden. "Before the transplant, I watched from the sidelines. After, I realised I had nothing to lose. I could only go forward."',
    'That sentiment is echoed by athletes from Cape Town to Tokyo. Camille Dupont, who received a bilateral lung transplant after years living with cystic fibrosis, returned to the water eighteen months post-surgery. She now holds the world record in the Women 30–39 100m Butterfly. Her coach, Pierre Marchand, describes her as the most focused athlete he has worked with in thirty years of coaching.',
    '"She doesn\'t waste a metre," Marchand says. "Every session has a purpose. She understands what her body has been through better than any athlete I\'ve coached."',
    'The data reflects this. Transplant Aquatics’ records show a consistent trend: transplant athletes who compete at the elite level tend to peak later than their non-transplant counterparts, with many recording personal bests in their forties and fifties. Recovery, it seems, is a form of preparation.',
    'For James Holloway, who received a liver transplant at 33 and returned to the competitive pool at 35, the mental component was as significant as the physical. "There was a period where I didn\'t believe I could be fast again," he says. "The transplant changed that. It recalibrated what I thought I deserved."',
    'As more transplant athletes push the boundaries of what is medically expected, the sport is attracting attention from clinicians and researchers. Papers have been published examining exercise capacity in heart and lung transplant recipients. The athletes are, in some sense, data points in a much larger conversation about post-transplant quality of life.',
    'But for the athletes themselves, the conversation is simpler. It is about competition. It is about the water. It is about a second chance used well.',
  ],
  'swim-faster-at-40-plus': [
    'The conventional wisdom in swimming is that peak performance arrives in the mid-twenties and declines steadily thereafter. For transplant athletes in the 40–49 age group, that wisdom often doesn\'t apply.',
    'Hans Müller began competing seriously only after his kidney transplant at 36. He is now, at 51, among the fastest breaststroke swimmers in the world in his age group. His training volume has increased, not decreased, with age.',
    '"Recovery is the key," says coach Petra Hoffmann, who has worked with Müller for over a decade. "Older athletes tend to understand their bodies better. They know when to push and when to rest. The younger ones often don\'t."',
    'The physiological changes post-transplant are complex. Immunosuppressant medications affect muscle composition, cardiovascular efficiency, and metabolic rates in ways that require adapted training programmes. Athletes and coaches who understand these dynamics tend to progress faster.',
    'Lars Eriksson, a three-time Scandinavian record-holder in the Men 50–59 100m Freestyle, trains six days a week despite competing for over fifteen years post-transplant. His weekly plan includes two technique-focused sessions, three high-intensity interval sets, and one long aerobic swim.',
    '"I don\'t try to swim like I\'m 25," Eriksson says. "I swim like I\'m 52 and I know exactly what that means. I have nothing to prove except to myself."',
    'The data from the Transplant Aquatics records database shows that in virtually every transplant age group, times have been improving year-on-year. This is partly a function of the sport\'s growth — more athletes means more competition and faster times. But coaches attribute much of it to better training methodology and athlete education.',
  ],
  'dresden-2025-recap': [
    'The 2025 World Transplant Games swimming programme was, by any measure, one of the most competitive in the event\'s history. Held across five days in Dresden, Germany, it attracted 312 swimmers from 29 nations and produced eight world records.',
    'Michael van der Berg of South Africa was the standout performer of the meet, claiming gold in the 50m and 100m Freestyle and finishing second in the 200m. His 100m Freestyle time of 58.92 seconds broke the previous world record by half a second and drew gasps from the assembled crowd.',
    'In the women\'s events, Sarah Brennan of the United Kingdom produced a dominant performance in the backstroke events, taking gold in the 50m and 100m Backstroke and silver in the 200m. Her 100m Backstroke time of 1:08.14 was a world record.',
    'The butterfly programme was defined by Camille Dupont\'s gold-medal double in the 50m and 100m events. The French lung transplant recipient\'s 100m time of 1:09.44 set a new world record in the Women 30–39 category — her third world record in as many years.',
    'Perhaps the most emotional moment of the meet came in the Men 40–49 200m Individual Medley, where Canadian Daniel Morrison touched the wall first to win gold in 2:28.14 — another world record. Morrison, who received a combined pancreas-kidney transplant in 2016, wept on the podium.',
    '"This is for my donor," he said. "Every world record we set is for our donors."',
    'Sixteen nations finished on the podium across all swimming events, with Australia claiming the most medals overall on home soil. South Africa led the individual rankings by gold medals, with van der Berg and teammate Liezel Joubert contributing four gold medals between them.',
    'Eight world records were set or equalled across the programme, with the largest concentration in the 40–49 age groups — a cohort that coaches and analysts say is currently experiencing a generational peak in talent.',
  ],
};

// Default body paragraphs for articles without extended content
function getArticleBody(slug: string, excerpt: string): string[] {
  if (ARTICLE_BODIES[slug]) return ARTICLE_BODIES[slug];
  // Expand excerpt into readable paragraphs
  return [
    excerpt,
    'The world of transplant swimming continues to grow, with athletes from every corner of the globe pushing boundaries and redefining what is possible after organ transplantation. From dedicated training programmes to community-driven clubs, the infrastructure supporting these athletes has never been stronger.',
    'As research into post-transplant exercise physiology advances, the performances recorded at meets like the World Transplant Games and the European Transplant & Dialysis Games provide valuable data for the medical community — and inspiration for the hundreds of thousands of transplant recipients worldwide who are yet to discover sport.',
    'The stories emerging from this community are as varied as the athletes themselves: kidney recipients turning to the water for the first time in their forties; heart transplant survivors completing open-water challenges; lung recipients setting butterfly records. Each story is a testament to the resilience of the human body and the transformative power of sport.',
    'For those looking to join the community, transplant swimming organisations operate in over forty countries worldwide. Most clubs welcome athletes of all abilities and experience levels, with many offering adapted programmes for those in early stages of post-transplant recovery.',
  ];
}

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

function AdSpace({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      aria-label="Advertisement space"
      className={`flex flex-col items-center justify-center border border-dashed border-neutral-300 bg-white/60 text-center ${compact ? 'min-h-40 p-5' : 'min-h-64 p-8'}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">Advertisement</span>
      <p className="mt-3 max-w-xs text-sm font-semibold text-neutral-600">Connect your brand with the transplant swimming community.</p>
      <span className="mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">Ad placement</span>
    </aside>
  );
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
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
    try { window.localStorage.setItem(likedKey, String(next)); } catch { /* local preview storage is optional */ }
  }

  function toggleSaved() {
    const next = !saved;
    setSaved(next);
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
            title="Article not found"
            subtitle="This article may have been moved or removed."
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
  const bodyParagraphs = getArticleBody(article.slug, article.excerpt);
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
        <header className="mx-auto max-w-4xl pb-8 pt-8 md:pt-12">
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
              <button type="button" onClick={() => { setCommentsOpen(value => !value); window.setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }} aria-expanded={commentsOpen} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors hover:bg-neutral-200"><MessageCircle size={18} /><span>{comments.length}</span></button>
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

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 pb-16 lg:grid-cols-[minmax(0,760px)_280px] lg:gap-14">
          <article className="min-w-0">
            {article.access === 'member' && <p className="mb-7 border-l-4 border-[#00c2d7] bg-white/70 px-5 py-4 text-sm leading-relaxed text-neutral-700">{hasFriendAccess ? 'You are reading with a Friend Link.' : `Member-only story · ${Math.max(0, FREE_MEMBER_STORIES_PER_MONTH - memberReads.length)} free reads remaining this month.`}</p>}
            {!canReadFullStory ? (
              <div className="border border-neutral-200 bg-white p-6 md:p-8">
                <p className="font-mono text-xs uppercase tracking-widest text-[#007d89]">Monthly free reads used</p>
                <h2 className="mt-3 text-2xl font-bold text-neutral-950">You’ve read three member-only stories this month.</h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">Free stories remain unlimited. Subscribe for unlimited member-only reading, or use a Friend Link shared by this story’s author.</p>
                <Link to="/join" className="mt-6 inline-flex items-center border border-[#007d89] px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#007d89] transition-colors hover:bg-[#007d89] hover:text-white">Explore membership</Link>
              </div>
            ) : <>
              <div className="space-y-7 text-lg leading-[1.85] text-neutral-800">
                {bodyParagraphs.map((para, i) => <div key={i}>
                  <p>{para}</p>
                  {i === 2 && <div className="my-10 lg:hidden"><AdSpace compact /></div>}
                  {i === 3 && <blockquote className="my-10 border-l-4 border-[#00c2d7] py-2 pl-6 text-2xl font-semibold leading-snug text-neutral-900">“Every split matters. Every lane tells a story.”<footer className="mt-3 font-mono text-xs font-normal uppercase tracking-widest text-[#007d89]">— Transplant Aquatics</footer></blockquote>}
                </div>)}
              </div>
              <div className="mt-12 border-y border-neutral-200 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={toggleLiked} aria-pressed={liked} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-neutral-200 ${liked ? 'text-rose-600' : 'text-neutral-700'}`}><Heart size={17} fill={liked ? 'currentColor' : 'none'} /> Appreciate · {liked ? 1 : 0}</button>
                    <button type="button" onClick={() => { setCommentsOpen(true); commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-700 transition-colors hover:bg-neutral-200"><MessageCircle size={17} /> Respond</button>
                  </div>
                  <button type="button" onClick={toggleSaved} aria-pressed={saved} className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-700 transition-colors hover:bg-neutral-200"><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save for later'}</button>
                </div>
              </div>
            </>}

            <section id="comments" ref={commentsRef} className="mt-12 scroll-mt-24" aria-label="Comments">
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
            </section>
          </article>

          <aside className="space-y-6 lg:pt-2">
            <AdSpace />
            <div className="border-t border-neutral-200 pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">More from the deck</p>
              {related.map(item => <Link key={item.id} to={`/from-the-pool-deck/${item.slug}`} className="mt-4 block border-b border-neutral-200 pb-4 text-neutral-900 hover:text-[#007d89]"><span className="font-mono text-[10px] uppercase tracking-wider text-[#007d89]">{item.category}</span><span className="mt-1 block font-semibold leading-snug">{item.title}</span><span className="mt-2 block font-mono text-[10px] text-neutral-500">{item.readTime} min read</span></Link>)}
            </div>
          </aside>
        </div>
      </main>

      <section className="border-t border-neutral-200 bg-white/60 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6"><AdSpace compact /></div>
      </section>
    </div>
  );
}
