import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
export const hasSupabaseConfig = supabase !== null;

export function describeSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const detail = error as Record<string, unknown>;
    const parts = [detail.message, detail.details, detail.hint, detail.code]
      .filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length) return parts.join(' — ');
    try { return JSON.stringify(error); } catch { /* fall through */ }
  }
  return String(error || 'Unknown Supabase error');
}
