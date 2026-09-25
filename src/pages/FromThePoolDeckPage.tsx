import { useEffect, useState } from 'react';
import { articles } from '../data/articles';
import ArticleCard from '../components/ArticleCard';
import Eyebrow from '../components/Eyebrow';
import { CheckCircle } from 'lucide-react';
import Pagination from '../components/Pagination';

const CATEGORIES = ['All', 'Athlete Stories', 'Training', 'Nutrition', 'Community', 'Competition', 'News', 'Recovery', 'Lifestyle'];
const PAGE_SIZE = 10;

export default function FromThePoolDeckPage() {
  const [category, setCategory] = useState('All');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [page, setPage] = useState(1);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
    }
  }

  const filtered = articles.filter(a => category === 'All' || a.category === category);
  useEffect(() => setPage(1), [category]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageArticles = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const featured = pageArticles[0];
  const rest = pageArticles.slice(1);

  return (
    <div>
      {/* Header */}
      <section style={{ backgroundColor: "var(--navy)", borderBottom: "1px solid var(--navy-light)" }}>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
          <div>
            <Eyebrow color="accent">From the Pool Deck · Stories</Eyebrow>
            <h1 className="mt-5 max-w-3xl text-white font-bold text-4xl leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
              Life, competition<br className="hidden sm:block" /> and community in the water.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70">
              Athlete stories, training advice and news from across transplant swimming.
            </p>
          </div>
        </div>
      </section>

      {/* Category pills */}
      <section className="sticky top-0 z-20 overflow-x-auto border-b border-neutral-200" style={{ backgroundColor: 'var(--paper)' }}>
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex min-w-max gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={`rounded-full px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  category === cat
                    ? 'bg-[#0c233f] text-white'
                    : 'border border-neutral-300 text-neutral-600 hover:border-[#00c2d7] hover:text-[#007d89]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section style={{ backgroundColor: 'var(--paper)' }}>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
          {filtered.length === 0 ? (
            <div className="py-20 text-center border border-neutral-200">
              <p className="text-neutral-400 font-mono text-sm uppercase tracking-widest">No articles in this category yet</p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#007d89]">The Pool Deck journal</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-neutral-950">{category === 'All' ? 'Latest stories' : category}</h2>
                </div>
                <span className="font-mono text-xs text-neutral-500">{filtered.length} {filtered.length === 1 ? 'story' : 'stories'}</span>
              </div>
              {/* Featured article */}
              {featured && (
                <div className="mb-10"><ArticleCard article={featured} featured /></div>
              )}
              {/* Remaining articles */}
              {rest.length > 0 && (
                <div className="flex flex-col">
                  {rest.map(a => <ArticleCard key={a.id} article={a} feedRow />)}
                </div>
              )}
              <Pagination page={page} pageCount={pageCount} onPageChange={setPage} label="Story pages" />
            </>
          )}
        </div>
      </section>
      {/* NEWSLETTER */}
      <section style={{ backgroundColor: 'var(--navy-mid)', borderTop: '1px solid var(--navy-light)' }}>
        <div className="max-w-7xl mx-auto px-4 py-20">
          {subscribed ? (
            <div className="flex flex-col items-center gap-4 text-center py-8">
              <CheckCircle size={40} style={{ color: 'var(--accent)' }} />
              <p className="display text-2xl md:text-3xl" style={{ color: 'var(--accent)' }}>
                You're in. Every second counts.
              </p>
            </div>
          ) : (
            <>
              <h2 className="display text-4xl md:text-5xl" style={{ color: 'var(--ink-on-dark)' }}>
                Stay in the water.
              </h2>
              <p className="mt-3 text-base max-w-md" style={{ color: 'var(--muted-on-dark)' }}>
                Race reports, athlete stories and records — delivered to your inbox.
              </p>
              <form
                onSubmit={handleSubscribe}
                className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-3 text-sm mono"
                  style={{
                    backgroundColor: 'var(--navy)',
                    border: '1px solid var(--navy-light)',
                    color: 'var(--ink-on-dark)',
                    outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--aqua)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--navy-light)')}
                />
                <button
                  type="submit"
                  className="px-6 py-3 text-sm font-bold uppercase tracking-wider text-black shrink-0 transition-opacity hover:opacity-80 display"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Subscribe
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
