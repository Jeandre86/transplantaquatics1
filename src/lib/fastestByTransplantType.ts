import { supabase } from './supabase';
import { loadCached } from './requestCache';

export interface FastestTransplantSwim {
  athleteId: string;
  athleteName: string;
  country: string;
  countryCode: string;
  transplantType: string;
  gender: string;
  ageGroup: string;
  event: string;
  time: string;
  course: string | null;
  status: 'swimmer_submitted' | 'imported_unverified' | 'verified';
}

export function loadFastestByTransplantType(): Promise<FastestTransplantSwim[]> {
  return loadCached('fastest-transplant-swims', loadFastestByTransplantTypeUncached);
}

async function loadFastestByTransplantTypeUncached(): Promise<FastestTransplantSwim[]> {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');
  const { data, error } = await supabase.rpc('get_public_fastest_transplant_swims');
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as FastestTransplantSwim[];
}
