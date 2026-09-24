import type { Article } from '../types';
import { formatDate } from '../lib/utils';

interface ArticleCardProps {
  article: Article;
  featured?: boolean;
}

export default function ArticleCard({ article, featured = false }: ArticleCardProps) {
  if (featured) {
    return (
      <div className="pb-8" style={{ borderBottom: '2px solid var(--border)' }}>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Visual placeholder */}
          <div
            className="w-full md:w-2/5 h-48 md:h-64 shrink-0"
            style={{ backgroundColor: 'var(--ice)' }}
          >
            <div className="w-full h-full flex items-end p-4">
              <span
                className="font-mono text-xs tracking-widest uppercase px-2 py-1"
                style={{ backgroundColor: 'var(--navy)', color: 'var(--muted-on-dark)' }}
              >
                {article.category}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
              {article.category}
            </span>
            <h3 className="mt-2 text-2xl md:text-3xl font-black tracking-tight leading-tight" style={{ color: 'var(--ink)' }}>
              {article.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              {article.excerpt}
            </p>
            <div className="mt-4 flex items-center gap-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>
              <span>{article.author}</span>
              <span>·</span>
              <span>{formatDate(article.date)}</span>
              <span>·</span>
              <span>{article.readTime} min read</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-5" style={{ borderTop: '1px solid var(--border)' }}>
      <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--aqua)' }}>
        {article.category}
      </span>
      <h3 className="mt-1.5 font-black text-base leading-snug tracking-tight" style={{ color: 'var(--ink)' }}>
        {article.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--muted)' }}>
        {article.excerpt}
      </p>
      <div className="mt-3 flex items-center gap-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>
        <span>{article.author}</span>
        <span>·</span>
        <span>{article.readTime} min</span>
      </div>
    </div>
  );
}
