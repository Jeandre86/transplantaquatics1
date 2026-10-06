import { supabase } from './supabase';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from './swimmerSubmissions';
import { timeToSeconds } from './utils';
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

interface ResultRow {
  id: string;
  swimmer_id: string | null;
  athlete_id: string | null;
  event: string;
  age_group: string | null;
  time: string;
  status: string;
  submitted_meets: { course: string } | { course: string }[] | null;
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
    loadAllRankingResults(),
  ]);

  const profileById = new Map<string, PublicSwimmerProfile>(profiles.map(profile => [profile.id, profile]));
  const fastestByEventCategory = new Map<string, FastestTransplantSwim>();

  for (const row of resultRows) {
    // The home section advertises verified leaders; pending swims should not
    // displace a slower verified result for the same event/category.
    if (row.status !== 'verified') continue;
    const swimmerId = row.swimmer_id ?? row.athlete_id;
    if (!swimmerId || !row.time || !row.event) continue;
    const profile = profileById.get(swimmerId);
    if (!profile || !Number.isFinite(timeToSeconds(row.time))) continue;

    // Historical imports can leave profile fields blank. A swim without a
    // transplant type cannot be placed in this category-specific summary.
    const transplantType = typeof profile.transplant_type === 'string' ? profile.transplant_type.trim() : '';
    if (!transplantType) continue;
    const event = typeof row.event === 'string' ? row.event.trim() : '';
    if (!event) continue;
    const gender = typeof profile.gender === 'string' ? profile.gender.trim() : '';

    const meet = Array.isArray(row.submitted_meets) ? row.submitted_meets[0] : row.submitted_meets;
    const course = typeof meet?.course === 'string' ? meet.course.trim() : '';
    const categoryKey = [transplantType, event, gender, course].join('|');
    const current = fastestByEventCategory.get(categoryKey);
    if (current && timeToSeconds(current.time) <= timeToSeconds(row.time)) continue;

    fastestByEventCategory.set(categoryKey, {
      athleteId: profile.id,
      athleteName: [profile.first_name, profile.last_name].filter(value => typeof value === 'string' && value.trim()).join(' '),
      country: typeof profile.country === 'string' ? profile.country : '',
      countryCode: typeof profile.country_code === 'string' ? profile.country_code : '',
      transplantType,
      gender,
      ageGroup: row.age_group ?? '',
      event,
      time: row.time,
      course: course || null,
      status: row.status as FastestTransplantSwim['status'],
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

async function loadAllRankingResults(): Promise<ResultRow[]> {
  const pageSize = 1000;
  const first = await supabase!.from('swimmer_results')
    .select('id, swimmer_id, athlete_id, event, time, age_group, status, submitted_meets(course)', { count: 'exact' })
    .neq('status', 'rejected').order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(0, pageSize - 1);
  if (first.error) throw first.error;
  const rows = [...((first.data ?? []) as unknown as ResultRow[])];
  const count = first.count ?? rows.length;
  const offsets = Array.from({ length: Math.ceil((count - rows.length) / pageSize) }, (_, index) => pageSize * (index + 1));
  for (let batch = 0; batch < offsets.length; batch += 4) {
    const pages = await Promise.all(offsets.slice(batch, batch + 4).map(async offset => {
      const { data, error } = await supabase!.from('swimmer_results')
        .select('id, swimmer_id, athlete_id, event, time, age_group, status, submitted_meets(course)')
        .neq('status', 'rejected').order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      return (data ?? []) as unknown as ResultRow[];
    }));
    pages.forEach(page => rows.push(...page));
  }
  return rows;
}
