import { supabase } from './supabase';
import { loadPublicSwimmerDirectory, loadPublicSubmittedResults, type PublicSwimmerProfile } from './swimmerSubmissions';
import { timeToSeconds } from './utils';
import { loadCached } from './requestCache';
import { normalizeRankingCourse, normalizeRankingEvent, normalizeRankingTransplantType } from './databaseRankings';

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

function compareText(left: unknown, right: unknown): number {
  const a = typeof left === 'string' ? left : '';
  const b = typeof right === 'string' ? right : '';
  return a < b ? -1 : a > b ? 1 : 0;
}

export function loadFastestByTransplantType(): Promise<FastestTransplantSwim[]> {
  return loadCached('fastest-transplant-swims', loadFastestByTransplantTypeUncached);
}

async function loadFastestByTransplantTypeUncached(): Promise<FastestTransplantSwim[]> {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');

  const [profiles, resultRows] = await Promise.all([
    loadPublicSwimmerDirectory(),
    loadPublicSubmittedResults(),
  ]);

  const profileById = new Map<string, PublicSwimmerProfile>(profiles.map(profile => [profile.id, profile]));
  const fastestByEventCategory = new Map<string, FastestTransplantSwim>();

  for (const row of resultRows) {
    // The home section advertises verified leaders; pending swims should not
    // displace a slower verified result for the same event/category.
    if (row.status !== 'verified') continue;
    const linkedSwimmerId = row.swimmer_id ?? row.athlete_id;
    const profile = linkedSwimmerId ? profileById.get(linkedSwimmerId) : undefined;
    if (!row.time || !row.event || !Number.isFinite(timeToSeconds(row.time))) continue;

    // Historical imports can leave profile fields blank. A swim without a
    // transplant type cannot be placed in this category-specific summary.
    const transplantType = normalizeRankingTransplantType(profile?.transplant_type)
      ?? normalizeRankingTransplantType(row.transplant_type);
    if (!transplantType) continue;
    const event = normalizeRankingEvent(row.event);
    if (!event) continue;
    const gender = typeof (profile?.gender ?? row.gender) === 'string' ? String(profile?.gender ?? row.gender).trim() : '';

    const course = normalizeRankingCourse(row.course || row.submitted_meets?.course);
    if (!course) continue;
    const categoryKey = [transplantType, event, gender, course].join('|');
    const current = fastestByEventCategory.get(categoryKey);
    if (current && timeToSeconds(current.time) <= timeToSeconds(row.time)) continue;

    fastestByEventCategory.set(categoryKey, {
      athleteId: linkedSwimmerId || `result:${row.swimmer_name.toLowerCase()}|${row.country_code ?? row.country}`,
      athleteName: [profile?.first_name, profile?.last_name].filter(value => typeof value === 'string' && value.trim()).join(' ') || row.swimmer_name,
      country: profile?.country ?? row.country ?? '',
      countryCode: profile?.country_code ?? row.country_code ?? '',
      transplantType,
      gender,
      ageGroup: row.age_group ?? profile?.age_group ?? '',
      event,
      time: row.time,
      course,
      status: row.status,
    });
  }

  // Keep each type's fastest event first. This also avoids calling string
  // methods on nullable fields returned by older/imported database rows.
  return [...fastestByEventCategory.values()].sort((a, b) =>
    compareText(a.transplantType, b.transplantType)
      || timeToSeconds(a.time) - timeToSeconds(b.time)
      || compareText(a.event, b.event)
      || compareText(a.gender, b.gender)
      || compareText(a.course, b.course)
  );
}
