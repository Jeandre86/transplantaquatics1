import type { Article } from '../types';
import { formatDate } from '../lib/utils';
import { Link } from 'react-router-dom';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Repeat2 } from 'lucide-react';
import { useState } from 'react';

interface ArticleCardProps {
  article: Article;
  featured?: boolean;
  feedRow?: boolean;
}

function FeedArticleRow({ article }: { article: Article }) {
  const storyPath = `/from-the-pool-deck/${article.slug}`;
  const [liked, setLiked] = useState(() => {
    try { return window.localStorage.getItem(`ta-story-liked-${article.slug}`) === 'true'; } catch { return false; }
  });
  const [saved, setSaved] = useState(() => {
    try { return window.localStorage.getItem(`ta-story-saved-${article.slug}`) === 'true'; } catch { return false; }
  });
  const [responseCount] = useState(() => {
    try {
      const stored = window.localStorage.getItem(`ta-story-comments-${article.slug}`);
      return stored ? (JSON.parse(stored) as unknown[]).length : 0;
    } catch { return 0; }
  });

  async function copyStoryLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}${storyPath}`); } catch { window.prompt('Copy this story link:', `${window.location.origin}${storyPath}`); }
  }

  async function copyFriendLink() {
    const friendPath = `${window.location.origin}${storyPath}?friend=${encodeURIComponent(article.friendLinkToken ?? '')}`;
    try { await navigator.clipboard.writeText(friendPath); } catch { window.prompt('Copy this Friend Link:', friendPath); }
  }

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    try { window.localStorage.setItem(`ta-story-liked-${article.slug}`, String(next)); } catch { /* local preview storage is optional */ }
  }

  function toggleSave() {
    const next = !saved;
    setSaved(next);
    try { window.localStorage.setItem(`ta-story-saved-${article.slug}`, String(next)); } catch { /* local preview storage is optional */ }
  }

  return (
    <article className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-4 gap-y-5 border-b border-neutral-200 py-8 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-x-8 sm:py-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-x-12">
      <Link to={storyPath} aria-label={`Read ${article.title}`} className="relative row-span-2 aspect-[4/3] self-center overflow-hidden bg-[#0c233f] sm:aspect-[3/2]">
        <img src={article.coverImage ?? '/assets/aquatics-hero.png'} alt="" className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
      </Link>

      <div className="min-w-0 self-center">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug text-neutral-500">
          <span className="font-semibold text-neutral-800">From the Pool Deck</span>
          <span aria-hidden="true">by</span>
          <span className="text-neutral-700">{article.author}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={article.date}>{formatDate(article.date)}</time>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#007d89]">{article.category}</span>
          <span className="text-neutral-300" aria-hidden="true">·</span>
          <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${article.access === 'member' ? 'text-[#9a6800]' : 'text-neutral-500'}`}>{article.access === 'member' ? 'Member-only' : 'Free story'}</span>
        </div>
        <Link to={storyPath} className="group/title block text-neutral-950">
          <h3 className="mt-3 line-clamp-3 text-xl font-black leading-tight tracking-tight transition-colors group-hover/title:text-[#007d89] sm:line-clamp-2 sm:text-2xl lg:text-3xl">{article.title}</h3>
        </Link>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-neutral-600 sm:text-base">{article.excerpt}</p>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-3 text-neutral-500 sm:col-span-1">
        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={toggleLike} aria-pressed={liked} aria-label={liked ? 'Unlike story' : 'Like story'} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-xs transition-colors hover:bg-neutral-100 ${liked ? 'text-rose-600' : ''}`}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /><span>{liked ? 1 : 0}</span></button>
          <Link to={`${storyPath}#comments`} aria-label="Open story responses" className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-xs transition-colors hover:bg-neutral-100"><MessageCircle size={18} /><span>{responseCount}</span></Link>
          <button type="button" onClick={copyStoryLink} aria-label="Share story" className="rounded-full p-2 transition-colors hover:bg-neutral-100"><Repeat2 size={18} /></button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={toggleSave} aria-pressed={saved} aria-label={saved ? 'Remove bookmark' : 'Save story'} className={`rounded-full p-2 transition-colors hover:bg-neutral-100 ${saved ? 'text-[#007d89]' : ''}`}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button>
          <details className="relative">
            <summary aria-label="More story actions" className="list-none cursor-pointer rounded-full p-2 transition-colors hover:bg-neutral-100"><MoreHorizontal size={20} /></summary>
            <div className="absolute right-0 top-full z-10 mt-1 w-48 border border-neutral-200 bg-white p-2 shadow-lg">
              <button type="button" onClick={copyStoryLink} className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100">Copy story link</button>
              {article.access === 'member' && article.friendLinkToken && <button type="button" onClick={copyFriendLink} className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100">Copy Friend Link</button>}
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

export default function ArticleCard({ article, featured = false, feedRow = false }: ArticleCardProps) {
  if (feedRow) return <FeedArticleRow article={article} />;
  return (
    <Link
      to={`/from-the-pool-deck/${article.slug}`}
      className={`group block overflow-hidden border border-neutral-200 bg-white transition-all hover:-translate-y-1 hover:border-[#00c2d7] hover:shadow-lg ${featured ? 'md:grid md:grid-cols-2' : ''}`}
    >
      <div className={`relative overflow-hidden bg-[#0c233f] ${featured ? 'h-64 md:h-full md:min-h-[390px]' : 'aspect-[16/10]'}`}>
        <img
          src={article.coverImage ?? '/assets/aquatics-hero.png'}
          alt={`Cover image for ${article.title}`}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-12">
          <span className="bg-white/95 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-800">{article.category}</span>
          <span className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${article.access === 'member' ? 'bg-[#f4c65e] text-neutral-900' : 'bg-emerald-100 text-emerald-900'}`}>{article.access === 'member' ? 'Member-only' : 'Free story'}</span>
        </div>
      </div>
      <div className={`flex flex-col ${featured ? 'justify-center p-6 sm:p-8 md:p-10' : 'p-5'}`}>
        <div className="flex flex-wrap gap-2">
          {(article.tags ?? [article.category]).slice(0, featured ? 3 : 2).map(tag => <span key={tag} className="font-mono text-[10px] uppercase tracking-wider text-[#007d89]">{tag}</span>)}
        </div>
        <h3 className={`mt-3 font-black leading-tight tracking-tight text-neutral-950 transition-colors group-hover:text-[#007d89] ${featured ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-lg'}`}>{article.title}</h3>
        <p className={`mt-3 leading-relaxed text-neutral-600 ${featured ? 'text-base' : 'line-clamp-3 text-sm'}`}>{article.excerpt}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          <span>{article.author}</span><span aria-hidden="true">·</span><span>{formatDate(article.date)}</span><span aria-hidden="true">·</span><span>{article.readTime} min read</span>
        </div>
        <span className="mt-5 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-[#1769c2]">Read story <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}
