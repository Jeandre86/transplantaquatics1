import type { Ranking } from '../types';
import { supabase } from './supabase';
import { loadCached } from './requestCache';
import { EVENTS } from '../types';

export interface SwimmerEventRanking {
  event: string;
  stroke: string;
  ageGroup: string;
  gender: string;
  course: 'LCM' | 'SCM';
  time: string;
  worldRank: number;
  worldSwimmerCount: number;
  clubRank: number | null;
  clubSwimmerCount: number | null;
  clubName: string | null;
  date: string;
  meetName: string | null;
}

export function normalizeRankingGender(value: string | null | undefined): Ranking['gender'] | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'men' || normalized === 'male' || normalized === 'man' || normalized === 'boys' || normalized === 'm') return 'Men';
  if (normalized === 'women' || normalized === 'woman' || normalized === 'female' || normalized === 'girls' || normalized === 'f') return 'Women';
  return null;
}

export function normalizeRankingTransplantType(value: string | null | undefined): Ranking['transplantType'] | null {
  const normalized = value?.trim().toLowerCase().replace(/\s+transplant$/, '');
  if (!normalized) return null;
  if (normalized === 'kidney') return 'Kidney';
  if (normalized === 'liver') return 'Liver';
  if (normalized === 'heart') return 'Heart';
  if (normalized === 'lung') return 'Lung';
  if (normalized === 'pancreas') return 'Pancreas';
  if (normalized === 'bone marrow' || normalized === 'marrow') return 'Bone Marrow';
  if (normalized === 'donor' || normalized === 'living donor') return 'Donor';
  return null;
}

export function normalizeRankingCourse(value: string | null | undefined): Ranking['course'] | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'lcm' || normalized === 'long course') return 'LCM';
  if (normalized === 'scm' || normalized === 'short course') return 'SCM';
  return null;
}

export function normalizeRankingEvent(value: string | null | undefined): Ranking['event'] | null {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return null;
  const match = normalized.match(/^(\d+)\s*m?\s*(freestyle|free|backstroke|back|breaststroke|breast|butterfly|fly|individual medley|im)$/);
  if (!match) return EVENTS.find(event => event.toLowerCase() === normalized) ?? null;
  const stroke = match[2] === 'free' || match[2] === 'freestyle' ? 'Freestyle'
    : match[2] === 'back' || match[2] === 'backstroke' ? 'Backstroke'
      : match[2] === 'breast' || match[2] === 'breaststroke' ? 'Breaststroke'
        : match[2] === 'fly' || match[2] === 'butterfly' ? 'Butterfly' : 'Individual Medley';
  return `${match[1]}m ${stroke}` as Ranking['event'];
}

export async function loadDatabaseRankings(): Promise<Ranking[]> {
  return loadCached('database-rankings', async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.rpc('get_public_personal_best_rankings');
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as Ranking[];
  });
}

export async function loadDatabaseRankingPreview(gender: string, event: string, course: string, limit = 5, ageGroup = 'All'): Promise<Ranking[]> {
  return loadCached(`database-ranking-preview:${gender}:${event}:${course}:${ageGroup}:${limit}`, async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.rpc('get_public_ranking_preview', {
      p_gender: gender,
      p_event: event,
      p_course: course,
      p_limit: limit,
      p_age_group: ageGroup,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as Ranking[];
  });
}

export async function loadMySwimmerEventRankings(swimmerId: string): Promise<SwimmerEventRanking[]> {
  return loadCached(`my-swimmer-event-rankings:${swimmerId}`, async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.rpc('get_my_swimmer_event_rankings', { p_swimmer_id: swimmerId });
    if (error) throw error;
    return (Array.isArray(data) ? data : []) as SwimmerEventRanking[];
  });
}
