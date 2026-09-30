import { useEffect, useState } from 'react';
import type { Article } from '../types';
import { loadPublishedArticles } from '../lib/articles';

export function usePublishedArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadPublishedArticles().then(rows => {
      if (active) setArticles(rows);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return { articles, loading, error };
}
