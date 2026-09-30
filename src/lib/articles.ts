import type { Article } from '../types';
import { supabase } from './supabase';

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: string;
  author_name: string;
  published_at: string | null;
  read_time: number;
  is_featured: boolean;
  access: 'free' | 'member';
  cover_image: string | null;
  tags: string[] | null;
  comments_enabled?: boolean;
};

function mapArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    category: row.category,
    author: row.author_name,
    date: row.published_at ?? new Date().toISOString(),
    readTime: row.read_time,
    featured: row.is_featured,
    access: row.access,
    coverImage: row.cover_image ?? undefined,
    tags: row.tags ?? [],
    commentsEnabled: row.comments_enabled ?? true,
  };
}

export async function loadPublishedArticles(): Promise<Article[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('site_articles')
    .select('id,title,slug,excerpt,body,category,author_name,published_at,read_time,is_featured,access,cover_image,tags,comments_enabled')
    .eq('status', 'published')
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ArticleRow[]).map(mapArticle);
}

export async function loadPublishedArticle(slug: string): Promise<Article | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('site_articles')
    .select('id,title,slug,excerpt,body,category,author_name,published_at,read_time,is_featured,access,cover_image,tags,comments_enabled')
    .eq('status', 'published').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? mapArticle(data as ArticleRow) : null;
}
