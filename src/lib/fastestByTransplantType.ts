import { supabase } from './supabase';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from './swimmerSubmissions';
import { timeToSeconds } from './utils';

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

interface ResultRow {
  id: string;
  swimmer_id: string | null;
  event: string;
  age_group: string | null;
  time: string;
  status: string;
  submitted_meets: { course: string } | { course: string }[] | null;
}

export async function loadFastestByTransplantType(): Promise<FastestTransplantSwim[]> {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');

  const [profiles, resultsResponse] = await Promise.all([
    loadPublicSwimmerDirectory(),
    supabase
      .from('swimmer_results')
      .select('id, swimmer_id, event, time, age_group, status, submitted_meets(course)')
      .neq('status', 'rejected'),
  ]);
  if (resultsResponse.error) throw resultsResponse.error;

  const profileById = new Map<string, PublicSwimmerProfile>(profiles.map(profile => [profile.id, profile]));
  const fastestByEventCategory = new Map<string, FastestTransplantSwim>();

  for (const row of (resultsResponse.data ?? []) as unknown as ResultRow[]) {
    if (!row.swimmer_id || !row.time || !row.event || !['verified', 'swimmer_submitted', 'imported_unverified'].includes(row.status)) continue;
    const profile = profileById.get(row.swimmer_id);
    if (!profile || !Number.isFinite(timeToSeconds(row.time))) continue;

    const meet = Array.isArray(row.submitted_meets) ? row.submitted_meets[0] : row.submitted_meets;
    const categoryKey = [profile.transplant_type, row.event, profile.gender, meet?.course ?? ''].join('|');
    const current = fastestByEventCategory.get(categoryKey);
    if (current && timeToSeconds(current.time) <= timeToSeconds(row.time)) continue;

    fastestByEventCategory.set(categoryKey, {
      athleteId: profile.id,
      athleteName: `${profile.first_name} ${profile.last_name}`,
      country: profile.country,
      countryCode: profile.country_code ?? '',
      transplantType: profile.transplant_type,
      gender: profile.gender,
      ageGroup: row.age_group ?? '',
      event: row.event,
      time: row.time,
      course: meet?.course ?? null,
      status: row.status as FastestTransplantSwim['status'],
    });
  }

  return [...fastestByEventCategory.values()].sort((a, b) =>
    a.transplantType.localeCompare(b.transplantType)
      || a.event.localeCompare(b.event)
      || a.gender.localeCompare(b.gender)
      || (a.course ?? '').localeCompare(b.course ?? '')
  );
}
