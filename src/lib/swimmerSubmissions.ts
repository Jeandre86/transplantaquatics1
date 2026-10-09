import type { Gender, TransplantType } from '../types';
import { getCompetitionAgeGroup } from './competitionAge';
import { supabase } from './supabase';
import { normalizeCountryCode } from './utils';
import { clearCachedRequest, loadCached } from './requestCache';
import { records as importedRecords } from '../data/records';
import { loadWorldRecords } from './worldRecords';
import { buildTransplantPointBaselines, scoreTransplantSwim, type PointBasis, type TransplantPointInput } from './transplantPoints';

export interface SwimmerProfile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  transplantType: TransplantType;
  country: string;
  countryCode: string;
  clubId?: string;
  clubName?: string;
  clubRequestPending?: boolean;
  isAccountHolder: boolean;
}

export interface SwimmerProfileDraft extends Omit<SwimmerProfile, 'id'> {
  id?: string;
}

export interface PublicSwimmerProfile {
  id: string;
  first_name: string;
  last_name: string;
  country: string | null;
  country_code: string | null;
  gender: Gender;
  transplant_type: TransplantType;
  age_group: string;
  club_id: string | null;
  club_name: string | null;
  best_swim_time?: string | null;
  best_swim_event?: string | null;
  record_count?: number;
}

export interface PublicSwimmerDirectoryPage {
  rows: PublicSwimmerProfile[];
  totalCount: number;
  countryCount: number;
  countryOptions: string[];
  resultCount: number;
}

export interface PublicResultsFilters {
  search: string;
  country: string;
  event: string;
  ageGroup: string;
  gender: string;
  swimType: string;
  page: number;
  pageSize: number;
}

export interface PublicResultsFilterOptions {
  countries: string[];
  events: string[];
  ageGroups: string[];
}

export interface PublicResultsPage {
  rows: SubmittedSwimmerResult[];
  totalCount: number;
  options: PublicResultsFilterOptions;
}

export interface PublicSwimmerResult {
  id: string;
  meet_id: string | null;
  event: string;
  time: string;
  age_group: string;
  points: number | null;
  placing: number | null;
  status: 'swimmer_submitted' | 'imported_unverified' | 'verified' | 'rejected';
  created_at: string;
  meet_name: string | null;
  meet_year: number | null;
  meet_date: string | null;
  meet_end_date: string | null;
  location: string | null;
  course: string | null;
  is_world_transplant_games: boolean;
  represented_club_name: string | null;
}

export interface SubmittedMeetDraft {
  catalogMeetId: string | null;
  name: string;
  meetDate: string;
  endDate: string | null;
  openingCeremonyDate: string | null;
  location: string;
  course: 'LCM' | 'SCM';
  isWorldTransplantGames: boolean;
}

export interface SwimmerResultDraft {
  meetId: string;
  swimmer: SwimmerProfile;
  event: string;
  time: string;
  ageGroup: string;
  points: number | null;
  recordCandidate: boolean;
}

export interface SubmittedSwimmerResult {
  id: string;
  athlete_id: string | null;
  swimmer_id: string | null;
  event: string;
  time: string;
  course?: string | null;
  age_group: string;
  points: number | null;
  placing?: number | null;
  points_basis?: PointBasis | null;
  record_candidate: boolean;
  record_candidate_status: 'not_candidate' | 'pending_verification' | 'verified' | 'rejected';
  status: 'swimmer_submitted' | 'imported_unverified' | 'verified' | 'rejected';
  created_at: string;
  meet_id: string | null;
  swimmer_name: string;
  country: string;
  country_code: string | null;
  gender: string;
  transplant_type: string;
  is_relay?: boolean;
  relay_team?: string | null;
  relay_members?: unknown[];
  current_age_group?: string;
  represented_club_id?: string | null;
  represented_club_name?: string | null;
  submitted_meets?: {
    name: string;
    meet_date: string | null;
    end_date?: string | null;
    meet_year?: number | null;
    location: string;
    course: string;
    is_world_transplant_games: boolean;
  } | null;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');
  return supabase;
}

function normalizeSubmittedResult(row: Record<string, unknown>): SubmittedSwimmerResult {
  const swimmerId = typeof row.swimmer_id === 'string' ? row.swimmer_id : null;
  return {
    ...row,
    swimmer_id: swimmerId,
    country_code: normalizeCountryCode(String(row.country ?? ''), String(row.country_code ?? '')) || null,
    // Athlete directory rows share the canonical swimmer profile UUID. This
    // fallback also supports databases where the optional athlete_id migration
    // has not been applied yet.
    athlete_id: typeof row.athlete_id === 'string' ? row.athlete_id : swimmerId,
  } as SubmittedSwimmerResult;
}

function normalizeSwimmerIdentity(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ');
}

export function loadPublicSwimmerDirectory(): Promise<PublicSwimmerProfile[]> {
  return loadCached('public-swimmer-directory', async () => {
    const pageSize = 1000;
    const first = await client().rpc('get_public_swimmer_directory', {}, { count: 'exact' }).range(0, pageSize - 1);
    if (first.error) throw first.error;
    const profiles = (first.data ?? []) as PublicSwimmerProfile[];
    const count = first.count;
    if (count === null || count === undefined) {
      if (profiles.length < pageSize) return profiles;
      for (let offset = pageSize; ; offset += pageSize) {
        const { data, error } = await client().rpc('get_public_swimmer_directory').range(offset, offset + pageSize - 1);
        if (error) throw error;
        const page = (data ?? []) as PublicSwimmerProfile[];
        profiles.push(...page);
        if (page.length < pageSize) return profiles;
      }
    }
    const offsets = Array.from({ length: Math.ceil((count - profiles.length) / pageSize) }, (_, index) => pageSize * (index + 1));
    for (let batch = 0; batch < offsets.length; batch += 4) {
      const pages = await Promise.all(offsets.slice(batch, batch + 4).map(async offset => {
        const { data, error } = await client().rpc('get_public_swimmer_directory').range(offset, offset + pageSize - 1);
        if (error) throw error;
        return (data ?? []) as PublicSwimmerProfile[];
      }));
      pages.forEach(page => profiles.push(...page));
    }
    return profiles;
  });
}

export function loadPublicSwimmerProfile(swimmerId: string): Promise<PublicSwimmerProfile | null> {
  return loadCached(`public-swimmer-profile:${swimmerId}`, async () => {
    const { data, error } = await client().rpc('get_public_swimmer_profile', { p_swimmer_id: swimmerId });
    if (error) throw error;
    return (data ?? null) as PublicSwimmerProfile | null;
  });
}

export function loadPublicSwimmerDirectoryPage(filters: {
  search?: string; country?: string; gender?: string; ageGroup?: string; transplant?: string;
  page?: number; pageSize?: number; sortBy?: 'name' | 'featured';
} = {}): Promise<PublicSwimmerDirectoryPage> {
  const args = {
    p_search: filters.search?.trim() || null,
    p_country: filters.country && filters.country !== 'All' ? filters.country : null,
    p_gender: filters.gender && filters.gender !== 'All' ? filters.gender : null,
    p_age_group: filters.ageGroup && filters.ageGroup !== 'All' ? filters.ageGroup : null,
    p_transplant: filters.transplant && filters.transplant !== 'All' ? filters.transplant : null,
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 25,
    p_sort_by: filters.sortBy ?? 'name',
  };
  const key = `public-swimmer-directory-page:${JSON.stringify(args)}`;
  return loadCached(key, async () => {
    const { data, error } = await client().rpc('get_public_swimmer_directory_page', args);
    if (error) throw error;
    const page = (data ?? {}) as Partial<PublicSwimmerDirectoryPage>;
    return {
      rows: Array.isArray(page.rows) ? page.rows : [],
      totalCount: Number(page.totalCount ?? 0),
      countryCount: Number(page.countryCount ?? 0),
      countryOptions: Array.isArray(page.countryOptions) ? page.countryOptions : [],
      resultCount: Number(page.resultCount ?? 0),
    };
  });
}

export function loadPublicResultsPage(filters: PublicResultsFilters): Promise<PublicResultsPage> {
  const args = {
    p_search: filters.search.trim() || null,
    p_country: filters.country,
    p_event: filters.event,
    p_age_group: filters.ageGroup,
    p_gender: filters.gender,
    p_swim_type: filters.swimType,
    p_page: filters.page,
    p_page_size: filters.pageSize,
  };
  return loadCached(`public-results-page:${JSON.stringify(args)}`, async () => {
    const [pageResponse, optionsResponse] = await Promise.all([
      client().rpc('get_public_results_page', args),
      loadCached('public-results-filter-options', async () => {
        const { data, error } = await client().rpc('get_public_results_filter_options');
        if (error) throw error;
        return data as PublicResultsFilterOptions;
      }),
    ]);
    if (pageResponse.error) throw pageResponse.error;
    const page = (pageResponse.data ?? {}) as { rows?: Record<string, unknown>[]; totalCount?: number };
    return {
      rows: (page.rows ?? []).map(normalizeSubmittedResult),
      totalCount: Number(page.totalCount ?? 0),
      options: optionsResponse,
    };
  });
}

export async function loadClaimableSwimmerProfiles(): Promise<PublicSwimmerProfile[]> {
  const { data, error } = await client().rpc('get_claimable_swimmer_profiles');
  if (error) throw error;
  return (data ?? []) as PublicSwimmerProfile[];
}

export async function loadPublicSwimmerResults(swimmerId: string): Promise<PublicSwimmerResult[]> {
  return loadCached(`public-swimmer-results:${swimmerId}`, async () => {
  const { data, error } = await client().rpc('get_public_swimmer_profile_results', { p_swimmer_id: swimmerId });
  if (error) throw error;
  const rows = ((data ?? []) as Record<string, unknown>[]).map(normalizeSubmittedResult);
  let pointRecords = importedRecords;
  try {
    const loadedRecords = await loadWorldRecords();
    if (loadedRecords.length) pointRecords = loadedRecords;
  } catch { /* Keep profile results available without the records service. */ }
  const inputs: TransplantPointInput[] = rows.map(result => ({
    ageGroup: result.age_group, gender: result.gender, event: result.event,
    course: result.course || result.submitted_meets?.course || '', time: result.time,
    transplantType: result.transplant_type, status: result.status,
  }));
  const baselines = buildTransplantPointBaselines(pointRecords, inputs);
  return rows.map((result, index) => ({
    id: result.id,
    meet_id: result.meet_id,
    event: result.event,
    time: result.time,
    age_group: result.age_group,
    points: scoreTransplantSwim(inputs[index], baselines).points,
    placing: result.placing ?? null,
    status: result.status,
    created_at: result.created_at,
    meet_name: result.submitted_meets?.name ?? null,
    meet_year: result.submitted_meets?.meet_year ?? null,
    meet_date: result.submitted_meets?.meet_date ?? null,
    meet_end_date: result.submitted_meets?.end_date ?? null,
    location: result.submitted_meets?.location ?? null,
    course: result.course || result.submitted_meets?.course || null,
    is_world_transplant_games: result.submitted_meets?.is_world_transplant_games ?? false,
    represented_club_name: result.represented_club_name ?? null,
  }));
  });
}

function mapSwimmer(row: Record<string, unknown>): SwimmerProfile {
  return {
    id: String(row.id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    dateOfBirth: String(row.date_of_birth),
    gender: row.gender as Gender,
    transplantType: row.transplant_type as TransplantType,
    country: String(row.country),
    countryCode: normalizeCountryCode(String(row.country ?? ''), String(row.country_code ?? '')),
    clubId: row.club_id ? String(row.club_id) : undefined,
    clubName: row.club_name ? String(row.club_name) : undefined,
    isAccountHolder: Boolean(row.is_account_holder),
  };
}

export async function loadManagedSwimmers(): Promise<SwimmerProfile[]> {
  const db = client();
  const { data, error } = await db.from('swimmer_profiles').select('*').order('is_account_holder', { ascending: false }).order('first_name');
  if (error) throw error;
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  const accountId = authData.user?.id;
  let pendingClubNames = new Set<string>();
  if (accountId) {
    const { data: requests, error: requestError } = await db.from('club_requests').select('name').eq('requested_by', accountId).in('status', ['pending', 'reviewed']);
    if (requestError) throw requestError;
    pendingClubNames = new Set((requests ?? []).map(request => String(request.name).trim().toLocaleLowerCase()));
  }
  return (data ?? []).map(row => {
    const profile = mapSwimmer(row as Record<string, unknown>);
    profile.clubRequestPending = Boolean(!profile.clubId && profile.clubName && pendingClubNames.has(profile.clubName.trim().toLocaleLowerCase()));
    return profile;
  });
}

export async function saveManagedSwimmer(profile: SwimmerProfileDraft): Promise<SwimmerProfile> {
  const payload = {
    first_name: profile.firstName.trim(),
    last_name: profile.lastName.trim(),
    date_of_birth: profile.dateOfBirth,
    gender: profile.gender,
    transplant_type: profile.transplantType,
    country: profile.country,
    country_code: normalizeCountryCode(profile.country, profile.countryCode) || null,
    club_id: profile.clubId || null,
    club_name: profile.clubName || null,
    is_account_holder: profile.isAccountHolder,
  };
  const request = profile.id
    ? client().from('swimmer_profiles').update(payload).eq('id', profile.id)
    : client().from('swimmer_profiles').insert(payload);
  const { data, error } = await request.select('*').single();
  if (error) throw error;
  clearCachedRequest('public-swimmer-directory');
  clearCachedRequest('public-submitted-results');
  clearCachedRequest('fastest-transplant-swims');
  return mapSwimmer(data as Record<string, unknown>);
}

export async function deleteManagedSwimmer(id: string): Promise<void> {
  const { error } = await client().from('swimmer_profiles').delete().eq('id', id).eq('is_account_holder', false);
  if (error) throw error;
}

export async function findSubmittedMeet(meet: SubmittedMeetDraft): Promise<string | null> {
  const db = client();
  const lookup = () => {
    let query = db.from('submitted_meets').select('id').eq('course', meet.course);
    if (meet.catalogMeetId) {
      query = query.eq('catalog_meet_id', meet.catalogMeetId);
    } else {
      query = query.is('catalog_meet_id', null)
        .ilike('name', meet.name.trim())
        .eq('meet_date', meet.meetDate)
        .ilike('location', meet.location.trim())
        .eq('is_world_transplant_games', meet.isWorldTransplantGames);
    }
    query = meet.endDate ? query.eq('end_date', meet.endDate) : query.is('end_date', null);
    query = meet.openingCeremonyDate ? query.eq('opening_ceremony_date', meet.openingCeremonyDate) : query.is('opening_ceremony_date', null);
    return query.maybeSingle();
  };
  const existing = await lookup();
  if (existing.error) throw existing.error;
  return existing.data?.id ? String(existing.data.id) : null;
}

export async function findOrCreateSubmittedMeet(meet: SubmittedMeetDraft): Promise<string> {
  const db = client();
  const existingId = await findSubmittedMeet(meet);
  if (existingId) return existingId;

  const { data, error } = await db.from('submitted_meets').insert({
    catalog_meet_id: meet.catalogMeetId,
    name: meet.name.trim(),
    meet_date: meet.meetDate,
    end_date: meet.endDate,
    opening_ceremony_date: meet.openingCeremonyDate,
    location: meet.location.trim(),
    course: meet.course,
    is_world_transplant_games: meet.isWorldTransplantGames,
  }).select('id').single();
  if (!error) return String(data.id);
  if (error.code === '23505') {
    const concurrent = await findSubmittedMeet(meet);
    if (concurrent) return concurrent;
  }
  throw error;
}

export async function loadMeetResults(meetId: string, swimmerId: string): Promise<SubmittedSwimmerResult[]> {
  const { data, error } = await client().from('swimmer_results')
    .select('id,swimmer_id,event,time,age_group,points,record_candidate,record_candidate_status,status,created_at,meet_id,swimmer_name,country,country_code,gender,transplant_type,course,represented_club_id,represented_club_name')
    .eq('meet_id', meetId).eq('swimmer_id', swimmerId).order('event');
  if (error) throw error;
  return (data ?? []).map(row => normalizeSubmittedResult(row));
}

export async function saveSwimmerResult(result: SwimmerResultDraft): Promise<SubmittedSwimmerResult> {
  const { data, error } = await client().from('swimmer_results').upsert({
    meet_id: result.meetId,
    swimmer_id: result.swimmer.id,
    swimmer_name: `${result.swimmer.firstName} ${result.swimmer.lastName}`.trim(),
    country: result.swimmer.country,
    country_code: normalizeCountryCode(result.swimmer.country, result.swimmer.countryCode) || null,
    gender: result.swimmer.gender,
    transplant_type: result.swimmer.transplantType,
    represented_club_id: result.swimmer.clubId || null,
    represented_club_name: result.swimmer.clubName || null,
    event: result.event,
    time: result.time.trim(),
    age_group: result.ageGroup,
    points: result.points,
    record_candidate: result.recordCandidate,
    record_candidate_status: result.recordCandidate ? 'pending_verification' : 'not_candidate',
    status: 'swimmer_submitted',
  }, { onConflict: 'meet_id,swimmer_id,event' })
    .select('id,swimmer_id,event,time,age_group,points,record_candidate,record_candidate_status,status,created_at,meet_id,swimmer_name,country,country_code,gender,transplant_type,course,represented_club_id,represented_club_name')
    .single();
  if (error) throw error;
  clearCachedRequest('public-submitted-results');
  clearCachedRequest('fastest-transplant-swims');
  return normalizeSubmittedResult(data);
}

export async function loadMySubmittedResults(): Promise<SubmittedSwimmerResult[]> {
  const db = client();
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  if (!user) return [];
  const { data, error } = await db.from('swimmer_results')
    .select('id,swimmer_id,event,time,age_group,points,record_candidate,record_candidate_status,status,created_at,meet_id,swimmer_name,country,country_code,gender,transplant_type,represented_club_id,represented_club_name,submitted_meets(name,meet_date,location,course,is_world_transplant_games)')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => normalizeSubmittedResult(row));
}

/** Loads results belonging to the signed-in account's swimmer profiles,
 * regardless of whether the account itself or another authorized user added them. */
export async function loadMyAccountResults(): Promise<SubmittedSwimmerResult[]> {
  const db = client();
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  if (!user) return [];

  const resultFields = 'id,swimmer_id,event,time,age_group,points,record_candidate,record_candidate_status,status,created_at,meet_id,swimmer_name,country,country_code,gender,transplant_type,course,represented_club_id,represented_club_name,submitted_meets(name,meet_date,location,course,is_world_transplant_games)';
  const [profileResult, submittedResult] = await Promise.all([
    db.from('swimmer_profiles').select('id,date_of_birth'),
    db.from('swimmer_results').select(resultFields).eq('submitted_by', user.id).order('created_at', { ascending: false }),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (submittedResult.error) throw submittedResult.error;

  const profiles = profileResult.data ?? [];
  const swimmerIds = profiles.map(profile => String(profile.id));
  const linkedResult = swimmerIds.length
    ? await db.from('swimmer_results').select(resultFields).in('swimmer_id', swimmerIds).neq('status', 'rejected').order('created_at', { ascending: false })
    : { data: [], error: null };
  if (linkedResult.error) throw linkedResult.error;

  const rows = [...(submittedResult.data ?? []), ...(linkedResult.data ?? [])];
  const uniqueRows = new Map(rows.map(row => [String(row.id), row]));
  const currentDate = new Date().toISOString().slice(0, 10);
  const ageGroupBySwimmer = new Map(profiles.map(profile => [
    String(profile.id),
    profile.date_of_birth ? getCompetitionAgeGroup(String(profile.date_of_birth), currentDate) : null,
  ]));
  return [...uniqueRows.values()].map(row => {
    const result = normalizeSubmittedResult(row);
    return { ...result, current_age_group: result.swimmer_id ? ageGroupBySwimmer.get(result.swimmer_id) ?? undefined : undefined };
  });
}

export function loadPublicSubmittedResults(): Promise<SubmittedSwimmerResult[]> {
  return loadCached('public-submitted-results', async () => {
    const pageSize = 1000;
    const fields = 'id,swimmer_id,athlete_id,event,time,age_group,points,placing,record_candidate,record_candidate_status,status,created_at,meet_id,swimmer_name,country,country_code,gender,transplant_type,course,represented_club_id,represented_club_name,submitted_meets(name,meet_date,end_date,meet_year,location,course,is_world_transplant_games)';
    const first = await client().from('swimmer_results').select(fields, { count: 'exact' })
      .neq('status', 'rejected').order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(0, pageSize - 1);
    if (first.error) throw first.error;
    const rawRows = [...(first.data ?? [])];
    const count = first.count ?? rawRows.length;
    const offsets = Array.from({ length: Math.ceil((count - rawRows.length) / pageSize) }, (_, index) => pageSize * (index + 1));
    for (let batch = 0; batch < offsets.length; batch += 4) {
      const pages = await Promise.all(offsets.slice(batch, batch + 4).map(async offset => {
        const { data, error } = await client().from('swimmer_results').select(fields)
          .neq('status', 'rejected').order('created_at', { ascending: false }).order('id', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        return data ?? [];
      }));
      pages.forEach(page => rawRows.push(...page));
    }
    const rows = rawRows.map(row => normalizeSubmittedResult(row));

    // Older imported rows can lack country details. Fetch directory fields only
    // for swimmers whose result rows actually need enrichment.
    const swimmerIds = [...new Set(rows
      .filter(row => !row.country?.trim() || !row.country_code?.trim())
      .map(row => row.swimmer_id)
      .filter((id): id is string => Boolean(id)))];
    const countryBySwimmer = new Map<string, { country: string | null; country_code: string | null }>();
    const swimmerBatches = Array.from({ length: Math.ceil(swimmerIds.length / 500) }, (_, index) => swimmerIds.slice(index * 500, (index + 1) * 500));
    for (let batch = 0; batch < swimmerBatches.length; batch += 4) {
      const pages = await Promise.all(swimmerBatches.slice(batch, batch + 4).map(async ids => {
        const { data, error } = await client().from('athletes').select('id,country,country_code').in('id', ids);
        if (error) return [];
        return data ?? [];
      }));
      pages.flat().forEach(athlete => {
        countryBySwimmer.set(String(athlete.id), {
          country: typeof athlete.country === 'string' ? athlete.country : null,
          country_code: typeof athlete.country_code === 'string' ? athlete.country_code : null,
        });
      });
    }
    const enrichedRows = rows.map(result => {
      const athlete = result.swimmer_id ? countryBySwimmer.get(result.swimmer_id) : undefined;
      return {
        ...result,
        country: result.country?.trim() || athlete?.country?.trim() || '',
        country_code: result.country_code?.trim() || athlete?.country_code || null,
      };
    });

    // Rank swims against Transplant Aquatics age-group records. If a category
    // has no official record yet, verified results establish its provisional
    // baseline. Stored points from the old World Aquatics scale are ignored.
    let pointRecords = importedRecords;
    try {
      const loadedRecords = await loadWorldRecords();
      if (loadedRecords.length) pointRecords = loadedRecords;
    } catch {
      // Keep public results usable when the records endpoint is unavailable.
    }
    const pointInputs: TransplantPointInput[] = enrichedRows.map(result => ({
      ageGroup: result.age_group,
      gender: result.gender,
      event: result.event,
      course: result.course || result.submitted_meets?.course || '',
      time: result.time,
      transplantType: result.transplant_type,
      status: result.status,
    }));
    const pointBaselines = buildTransplantPointBaselines(pointRecords, pointInputs);
    const scoredRows = enrichedRows.map((result, index) => {
      const score = scoreTransplantSwim(pointInputs[index], pointBaselines);
      return { ...result, points: score.points, points_basis: score.basis };
    });

    const relayFields = 'id,swimmer_id,swimmer_name,country,event,age_group,gender,course,time_original,race_status,is_relay,relay_team,relay_members,published_at,meet_catalog(name,category,meet_date,host_city,host_country)';
    const relayPageSize = 1000;
    const firstRelayPage = await client().from('imported_official_performances').select(relayFields, { count: 'exact' })
      .eq('is_relay', true).order('published_at', { ascending: false }).range(0, relayPageSize - 1);
    if (firstRelayPage.error) throw firstRelayPage.error;
    const relayRows = [...(firstRelayPage.data ?? [])];
    const relayCount = firstRelayPage.count ?? relayRows.length;
    const relayOffsets = Array.from({ length: Math.ceil((relayCount - relayRows.length) / relayPageSize) }, (_, index) => relayPageSize * (index + 1));
    for (let batch = 0; batch < relayOffsets.length; batch += 4) {
      const pages = await Promise.all(relayOffsets.slice(batch, batch + 4).map(async offset => {
        const { data, error } = await client().from('imported_official_performances').select(relayFields)
          .eq('is_relay', true).order('published_at', { ascending: false }).range(offset, offset + relayPageSize - 1);
        if (error) throw error;
        return data ?? [];
      }));
      pages.forEach(page => relayRows.push(...page));
    }
    const officialRelays: SubmittedSwimmerResult[] = relayRows.map(row => {
      const meet = Array.isArray(row.meet_catalog) ? row.meet_catalog[0] : row.meet_catalog;
      const country = typeof row.country === 'string' ? row.country : '';
      const publishedAt = String(row.published_at ?? new Date(0).toISOString());
      const meetDate = typeof meet?.meet_date === 'string' ? meet.meet_date : null;
      const host = [meet?.host_city, meet?.host_country].filter(Boolean).join(', ');
      return {
        id: `official-relay-${row.id}`,
        athlete_id: null,
        swimmer_id: null,
        event: String(row.event ?? ''),
        time: String(row.time_original ?? row.race_status ?? '—'),
        course: typeof row.course === 'string' ? row.course : null,
        age_group: typeof row.age_group === 'string' && row.age_group ? row.age_group : '—',
        points: null,
        record_candidate: false,
        record_candidate_status: 'not_candidate',
        status: 'verified',
        created_at: meetDate ?? publishedAt,
        meet_id: null,
        swimmer_name: String(row.relay_team || row.swimmer_name || 'Relay team'),
        country,
        country_code: normalizeCountryCode(country, '') || null,
        gender: String(row.gender ?? ''),
        transplant_type: '',
        is_relay: true,
        relay_team: typeof row.relay_team === 'string' ? row.relay_team : null,
        relay_members: Array.isArray(row.relay_members) ? row.relay_members : [],
        represented_club_id: null,
        represented_club_name: null,
        submitted_meets: {
          name: String(meet?.name ?? 'Official meet result'),
          meet_date: meetDate,
          location: host,
          course: typeof row.course === 'string' ? row.course : '',
          is_world_transplant_games: meet?.category === 'World Transplant Games',
        },
      };
    });
    const profiles = await loadPublicSwimmerDirectory();
    const profilesByIdentity = new Map<string, PublicSwimmerProfile[]>();
    profiles.forEach(profile => {
      const key = [normalizeSwimmerIdentity(`${profile.first_name} ${profile.last_name}`), normalizeSwimmerIdentity(profile.country), normalizeSwimmerIdentity(profile.gender)].join('|');
      const matches = profilesByIdentity.get(key) ?? [];
      matches.push(profile);
      profilesByIdentity.set(key, matches);
    });
    const linkedRows = scoredRows.map(result => {
      if (result.swimmer_id || result.athlete_id) return result;
      const key = [normalizeSwimmerIdentity(result.swimmer_name), normalizeSwimmerIdentity(result.country), normalizeSwimmerIdentity(result.gender)].join('|');
      const matches = profilesByIdentity.get(key);
      if (!matches || matches.length !== 1) return result;
      return { ...result, swimmer_id: matches[0].id, athlete_id: matches[0].id };
    });
    return [...linkedRows, ...officialRelays];
  });
}
