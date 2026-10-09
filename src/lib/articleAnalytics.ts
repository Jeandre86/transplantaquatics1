import { supabase } from './supabase';

export type ArticleAnalyticsEvent = 'view' | 'read_complete' | 'share' | 'like' | 'save';

function getSessionId(): string | null {
  try {
    const key = 'ta-article-analytics-session';
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return null;
  }
}

/** Fire-and-forget, anonymous event tracking. The database deduplicates event types per article/session/day. */
export async function trackArticleEvent(articleId: string, eventType: ArticleAnalyticsEvent): Promise<void> {
  if (!supabase) return;
  const visitorId = getSessionId();
  if (!visitorId) return;
  try {
    await supabase.rpc('track_public_article_event', {
      p_article_id: articleId,
      p_event_type: eventType,
      p_visitor_id: visitorId,
    });
  } catch {
    // Analytics must never interrupt reading or article interactions.
  }
}
