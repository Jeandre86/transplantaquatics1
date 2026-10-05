import { normalizeCountryCode } from './utils';

export type RaceStatus = 'OK' | 'DNS' | 'DNF' | 'DQ' | 'SCR' | 'NS';

export interface StagedImportRow {
  source_row_key: string;
  swimmer_source_key: string;
  swimmer_name: string;
  first_name: string;
  last_name: string;
  country: string | null;
  country_code: string | null;
  gender: 'Men' | 'Women' | null;
  event: string;
  distance_m: number | null;
  stroke: string | null;
  age_group: string | null;
  competition_category: string | null;
  course: 'LCM' | 'SCM' | 'SCY' | null;
  round_name: string | null;
  time_original: string | null;
  time_ms: number | null;
  placing: string | null;
  race_status: RaceStatus;
  is_relay: boolean;
  relay_team: string | null;
  relay_members: unknown[];
  raw_data: Record<string, unknown>;
  source_references: unknown[];
}

export function parseSwimTime(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw || /^(NT|DNS|DNF|DQ|SCR|NS)$/i.test(raw)) return null;
  const match = raw.match(/^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  const fraction = Number((match[3] ?? '').padEnd(3, '0'));
  if (seconds >= 60 && match[1]) return null;
  const ms = (minutes * 60 + seconds) * 1000 + fraction;
  return Number.isSafeInteger(ms) ? ms : null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(header => header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

const aliases: Record<string, string[]> = {
  swimmer_name: ['swimmer_name', 'athlete', 'athlete_name', 'name', 'competitor', 'swimmer'],
  source_identifier: ['source_identifier', 'athlete_id', 'swimmer_id', 'competitor_id', 'registration_id'],
  country: ['country', 'nation', 'team', 'country_name'],
  country_code: ['country_code', 'noc', 'nation_code'],
  gender: ['gender', 'sex'],
  event: ['event', 'event_name', 'race'],
  age_group: ['age_group', 'age', 'category_age'],
  course: ['course', 'pool', 'pool_length'],
  round_name: ['round', 'round_name', 'heat_final'],
  time_original: ['time', 'time_original', 'result', 'mark'],
  placing: ['place', 'placing', 'position', 'rank'],
  race_status: ['status', 'race_status'],
  competition_category: ['competition_category', 'category', 'division'],
  is_relay: ['is_relay', 'relay'],
  relay_team: ['relay_team', 'team_name'],
};

function getField(row: Record<string, unknown>, field: string): string {
  for (const key of aliases[field] ?? [field]) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeGender(raw: string): StagedImportRow['gender'] {
  if (/^(m|male|men|man)$/i.test(raw)) return 'Men';
  if (/^(f|female|women|woman)$/i.test(raw)) return 'Women';
  return null;
}

function normalizeCourse(raw: string): StagedImportRow['course'] {
  const value = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (['LCM', 'LONGCOURSE', '50M'].includes(value)) return 'LCM';
  if (['SCM', 'SHORTCOURSE', '25M'].includes(value)) return 'SCM';
  if (['SCY', 'YARDS', '25Y'].includes(value)) return 'SCY';
  return null;
}

function normalizeStatus(raw: string, time: string): RaceStatus {
  const status = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (['DNS', 'DNF', 'DQ', 'SCR', 'NS'].includes(status)) return status as RaceStatus;
  const mark = time.toUpperCase();
  if (['DNS', 'DNF', 'DQ', 'SCR', 'NS'].includes(mark)) return mark as RaceStatus;
  return 'OK';
}

function stableKey(value: string): string {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeImportRows(rows: Record<string, unknown>[], sourceLabel = 'source'): StagedImportRow[] {
  return rows.map((raw, index) => {
    const swimmerName = getField(raw, 'swimmer_name');
    const nameParts = swimmerName.split(/\s+/).filter(Boolean);
    const time = getField(raw, 'time_original');
    const status = normalizeStatus(getField(raw, 'race_status'), time);
    const country = getField(raw, 'country') || null;
    const sourceIdentifier = getField(raw,'source_identifier');
    // A name and country are not reliable identity keys. Only source-issued IDs
    // can group swims automatically; otherwise keep each source row separate.
    const identityKey = sourceIdentifier ? `source:${sourceIdentifier}` : `row:${index}|${country ?? 'unknown'}|${swimmerName.toLocaleLowerCase()}`;
    const event = getField(raw, 'event');
    const course = normalizeCourse(getField(raw, 'course'));
    const ageGroup = getField(raw, 'age_group') || null;
    const gender = normalizeGender(getField(raw, 'gender'));
    const raceKey = `${index}|${identityKey}|${event}|${getField(raw, 'round_name')}|${time}`;
    const distanceStroke = event.match(/(\d+)\s*m?\s*(freestyle|free|backstroke|back|breaststroke|breast|butterfly|fly|individual medley|medley)/i);
    const strokeToken = distanceStroke?.[2]?.toLowerCase();
    const stroke = strokeToken ? ({ free: 'Freestyle', freestyle: 'Freestyle', back: 'Backstroke', backstroke: 'Backstroke', breast: 'Breaststroke', breaststroke: 'Breaststroke', fly: 'Butterfly', butterfly: 'Butterfly', medley: 'Individual Medley', 'individual medley': 'Individual Medley' } as Record<string, string>)[strokeToken] : null;
    const ms = status === 'OK' ? parseSwimTime(time) : null;
    return {
      source_row_key: stableKey(`${sourceLabel}|${raceKey}`),
      swimmer_source_key: stableKey(identityKey),
      swimmer_name: swimmerName || 'Unknown swimmer',
      first_name: nameParts[0] ?? '',
      last_name: nameParts.slice(1).join(' '),
      country,
      country_code: normalizeCountryCode(country, getField(raw, 'country_code')) || null,
      gender,
      event: event || 'Unknown event',
      distance_m: distanceStroke ? Number(distanceStroke[1]) : null,
      stroke,
      age_group: ageGroup,
      competition_category: getField(raw, 'competition_category') || null,
      course,
      round_name: getField(raw, 'round_name') || null,
      time_original: time || null,
      time_ms: ms,
      placing: getField(raw, 'placing') || null,
      race_status: status,
      is_relay: /true|yes|relay/i.test(getField(raw, 'is_relay')) || /relay/i.test(event),
      relay_team: getField(raw, 'relay_team') || null,
      relay_members: [],
      raw_data: raw,
      source_references: [{ source: sourceLabel, row: index + 2 }],
    };
  });
}

export function parseImportJson(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(row => row && typeof row === 'object') as Record<string, unknown>[];
  if (!value || typeof value !== 'object') throw new Error('JSON must contain an array of result rows.');
  const data = value as Record<string, unknown>;
  const rows = data.results ?? data.rows;
  if (Number(data.schema_version ?? 1) !== 1) throw new Error('This JSON export version is not supported.');
  if (!Array.isArray(rows)) throw new Error('JSON must contain a results array.');
  return rows.filter(row => row && typeof row === 'object') as Record<string, unknown>[];
}

export function classifyIdentityMatch(matches: { country?: string | null; gender?: string | null; firstName: string; lastName: string }[]) {
  if (!matches.length) return 'new';
  if (matches.length > 1) return 'uncertain';
  return 'possible_match'; // A sole name match still requires human confirmation.
}

export function isClaimEvidenceSufficient(value: string): boolean {
  return value.trim().length >= 20;
}

export function permissionsForRole(role: string, overrides: Record<string, boolean> = {}): string[] {
  const known = ['view_admin','import_results','publish_results','rollback_imports','merge_swimmers','review_claims','confirm_records','manage_roles'];
  const base: Record<string,string[]> = {
    owner: known,
    administrator: ['view_admin','import_results','publish_results','rollback_imports','merge_swimmers','review_claims','confirm_records'],
    results_editor: ['view_admin','import_results'],
    claim_reviewer: ['view_admin','review_claims'],
  };
  return known.filter(permission => overrides[permission] ?? (base[role] ?? []).includes(permission));
}

export function compareRecordTimes(newMs: number | null, oldMs: number | null): 'potential_record' | 'equalled' | 'not_a_record' | 'needs_review' {
  if (newMs === null || oldMs === null) return 'needs_review';
  if (newMs < oldMs) return 'potential_record';
  if (newMs === oldMs) return 'equalled';
  return 'not_a_record';
}

export function exportImportJson(batch: { meet: unknown; source: unknown; swimmers: unknown[]; results: StagedImportRow[] }) {
  return JSON.stringify({ schema_version: 1, exported_at: new Date().toISOString(), meet: batch.meet, source: batch.source, swimmers: batch.swimmers, results: batch.results }, null, 2);
}
