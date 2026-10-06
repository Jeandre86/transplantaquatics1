import { supabase } from './supabase';
import { loadCached } from './requestCache';

export interface ClubRecord {
  id: string;
  slug: string;
  name: string;
  country: string;
  country_code: string | null;
  city: string;
  description: string;
  founded_year: number | null;
  banner_url: string | null;
  logo_url: string | null;
  created_by?: string;
}

export interface ClubCoachRecord {
  id: string;
  account_id: string;
  name: string;
  role: 'owner' | 'coach';
}

export function getClubLogoUrl(club: Pick<ClubRecord, 'name' | 'slug' | 'logo_url'>): string | null {
  const identity = `${club.slug} ${club.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (identity.includes('barracudas-aquarama')) return '/images/baracudas.webp';
  return club.logo_url;
}

export function loadClubRecords(): Promise<ClubRecord[]> {
  return loadCached('club-records', async () => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('clubs').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as ClubRecord[];
  });
}

export async function loadClubCoaches(clubId: string): Promise<ClubCoachRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('club_coaches').select('id, account_id, name, role').eq('club_id', clubId).order('role');
  if (error) throw error;
  return (data ?? []) as ClubCoachRecord[];
}

export function clubPath(club: Pick<ClubRecord, 'id' | 'slug'>) {
  return `/clubs/${club.slug || club.id}`;
}
