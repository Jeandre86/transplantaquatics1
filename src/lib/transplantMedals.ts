import type { Medal } from '../types';

export interface MedalResultLike {
  id: string;
  athlete_id?: string | null;
  swimmer_id?: string | null;
  event?: string | null;
  placing?: number | null;
  is_world_transplant_games?: boolean;
  meet_year?: number | null;
  meet_date?: string | null;
  meet_name?: string | null;
  submitted_meets?: {
    name?: string | null;
    meet_date?: string | null;
    meet_year?: number | null;
    is_world_transplant_games?: boolean;
  } | null;
}

export interface StoredTransplantMedal {
  result_id: string;
  swimmer_id: string;
  competition: string;
  year: number;
  medal: string;
  event?: string | null;
}

export interface ResolvedTransplantMedal extends Medal {
  result_id: string;
  swimmer_id: string | null;
}

/**
 * Shared medal rules for athlete profiles and admin queries. Stored medal rows
 * take precedence; WTG placings fill missing medals. Ownership follows the
 * result's canonical athlete link so stale medal swimmer_id values cannot
 * split one swimmer's medal total across profiles.
 */
export function resolveTransplantMedals(
  results: MedalResultLike[],
  storedRows: StoredTransplantMedal[],
  defaultSwimmerId?: string,
): Map<string, ResolvedTransplantMedal> {
  const resultById = new Map(results.map(result => [result.id, result]));
  const resolved = new Map<string, ResolvedTransplantMedal>();

  storedRows.forEach(row => {
    const result = resultById.get(row.result_id);
    const relationYear = result?.submitted_meets?.meet_year;
    const relationName = result?.submitted_meets?.name;
    resolved.set(row.result_id, {
      result_id: row.result_id,
      swimmer_id: result?.athlete_id ?? result?.swimmer_id ?? defaultSwimmerId ?? row.swimmer_id ?? null,
      competition: row.competition || relationName || 'World Transplant Games',
      year: Number(row.year || relationYear || result?.meet_year || (row as StoredTransplantMedal & { meet_date?: string }).meet_date?.slice(0, 4) || 0),
      color: row.medal as Medal['color'],
      event: (result?.event ?? row.event ?? 'Unknown event') as Medal['event'],
    });
  });

  results.forEach(result => {
    const isWtg = result.is_world_transplant_games ?? result.submitted_meets?.is_world_transplant_games ?? false;
    const placing = Number(result.placing);
    if (resolved.has(result.id) || !isWtg || !Number.isInteger(placing) || placing < 1 || placing > 3) return;
    const meetDate = result.meet_date ?? result.submitted_meets?.meet_date ?? null;
    const year = Number(result.meet_year ?? result.submitted_meets?.meet_year ?? meetDate?.slice(0, 4));
    if (!Number.isInteger(year) || year < 1) return;
    resolved.set(result.id, {
      result_id: result.id,
      swimmer_id: result.athlete_id ?? result.swimmer_id ?? defaultSwimmerId ?? null,
      competition: result.meet_name ?? result.submitted_meets?.name ?? 'World Transplant Games',
      year,
      color: placing === 1 ? 'Gold' : placing === 2 ? 'Silver' : 'Bronze',
      event: (result.event ?? 'Unknown event') as Medal['event'],
    });
  });
  return resolved;
}
