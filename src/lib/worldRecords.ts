import type { Record as WorldRecord } from '../types';
import { supabase } from './supabase';

interface WorldRecordRow {
  id: string;
  athlete_id: string | null;
  country_code: string | null;
  event: string;
  age_group: string | null;
  time: string;
  athlete_name: string;
  country: string;
  games: string;
  gender: string;
  category: string;
  course: string;
}

const countryNames: Record<string, string> = {
  'GB&NI': 'Great Britain & Northern Ireland',
  USA: 'United States',
  'GREAT BRITAIN': 'Great Britain',
  GERMANY: 'Germany',
  AUSTRALIA: 'Australia',
  CANADA: 'Canada',
  BRAZIL: 'Brazil',
  HUNGARY: 'Hungary',
  NETHERLANDS: 'Netherlands',
  'SOUTH AFRICA': 'South Africa',
  MEXICO: 'Mexico',
  FINLAND: 'Finland',
  JAPAN: 'Japan',
  FRANCE: 'France',
  ITALY: 'Italy',
  RSA: 'South Africa',
  PORTUGAL: 'Portugal',
  UK: 'United Kingdom',
  GREECE: 'Greece',
  ISRAEL: 'Israel',
  IRELAND: 'Ireland',
  SPAIN: 'Spain',
  'NORTHERN IRELAND': 'Northern Ireland',
};

const genderNames: Record<string, string> = {
  men: 'Men',
  women: 'Women',
  boys: 'Boys',
  girls: 'Girls',
  mixed: 'Mixed',
};

function formatCategory(category: string) {
  return category.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export async function loadWorldRecords(): Promise<WorldRecord[]> {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');

  const { data, error } = await supabase
    .from('world_records')
    .select('id,athlete_id,country_code,event,age_group,time,athlete_name,country,games,gender,category,course')
    .order('event')
    .order('age_group');

  if (error) throw error;

  return ((data ?? []) as WorldRecordRow[]).map(row => ({
    id: row.id,
    athleteId: row.athlete_id ?? undefined,
    countryCode: row.country_code ?? undefined,
    event: row.event,
    course: row.course as WorldRecord['course'],
    ageGroup: row.age_group ?? 'Open relay',
    gender: genderNames[row.gender] ?? row.gender,
    category: formatCategory(row.category),
    time: row.time,
    athleteName: row.athlete_name,
    country: countryNames[row.country] ?? row.country,
    meet: row.games,
    games: row.games,
  }));
}
