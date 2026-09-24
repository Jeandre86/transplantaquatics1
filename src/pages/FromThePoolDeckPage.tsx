import { useState } from 'react';
import { articles } from '../data/articles';
import ArticleCard from '../components/ArticleCard';
import Eyebrow from '../components/Eyebrow';
import { CheckCircle } from 'lucide-react';

const CATEGORIES = ['All', 'Athlete Stories', 'Training', 'Nutrition', 'Community', 'Competition', 'News', 'Recovery', 'Lifestyle'];

export default function FromThePoolDeckPage() {
  const [category, setCategory] = useState('All');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
    }
  }

  const filtered = articles.filter(a => category === 'All' || a.category === category);
  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div>
      {/* Header */}
      <section style={{ backgroundColor: "var(--navy)", borderBottom: "1px solid var(--navy-light)" }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <Eyebrow color="accent">From the Pool Deck</Eyebrow>
          <h1 className="mt-4 text-white font-bold text-5xl md:text-6xl leading-tight">
            Stories from the world<br />of transplant swimming.
          </h1>
        </div>
      </section>

      {/* Category pills */}
      <section className="border-b border-neutral-200 overflow-x-auto" style={{ backgroundColor: 'var(--paper)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex gap-2 min-w-max">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wider border transition-colors whitespace-nowrap ${
                  category === cat
                    ? 'bg-black text-white border-black'
                    : 'border-neutral-300 text-neutral-600 hover:border-neutral-500'
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
        <div className="max-w-6xl mx-auto px-6 py-12">
          {filtered.length === 0 ? (
            <div className="py-20 text-center border border-neutral-200">
              <p className="text-neutral-400 font-mono text-sm uppercase tracking-widest">No articles in this category yet</p>
            </div>
          ) : (
            <>
              {/* Featured article */}
              {featured && (
                <div className="mb-10 border border-neutral-200 p-6 md:p-10 bg-white">
                  <span className="font-mono text-xs uppercase tracking-widest px-2 py-0.5 border border-neutral-200 text-neutral-500">{featured.category}</span>
                  <h2 className="mt-4 font-bold text-3xl md:text-4xl leading-tight" style={{ color: 'var(--ink)' }}>
                    {featured.title}
                  </h2>
                  <p className="mt-4 text-neutral-600 text-base leading-relaxed max-w-3xl">{featured.excerpt}</p>
                  <div className="mt-6 flex items-center gap-4">
                    <span className="font-mono text-xs text-neutral-500">{featured.author}</span>
                    <span className="font-mono text-xs text-neutral-400">·</span>
                    <span className="font-mono text-xs text-neutral-500">{featured.date}</span>
                    <span className="font-mono text-xs text-neutral-400">·</span>
                    <span className="font-mono text-xs text-neutral-500">{featured.readTime} min read</span>
                  </div>
                </div>
              )}
              {/* Remaining articles */}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map(a => <ArticleCard key={a.id} article={a} />)}
                </div>
              )}
            </>
          )}
        </div>
      </section>
      {/* NEWSLETTER */}
      <section style={{ backgroundColor: 'var(--navy-mid)', borderTop: '1px solid var(--navy-light)' }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
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
