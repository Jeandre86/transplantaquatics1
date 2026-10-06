export function formatTime(time: string): string {
  return time;
}

/** Format a swim time from seconds or the historical string formats in use. */
export function formatSwimTime(secondsOrTime: number | string): string {
  const raw = typeof secondsOrTime === 'number' ? secondsOrTime : secondsOrTime.trim();
  if (raw === '') return '—';

  let seconds: number;
  if (typeof raw === 'number') {
    seconds = raw;
  } else if (/^\d+(?:\.\d+)?$/.test(raw)) {
    seconds = Number(raw);
  } else {
    const match = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(raw);
    if (!match) return '—';
    seconds = Number(match[1]) * 60 + Number(match[2]);
  }

  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const rounded = Math.round(seconds * 100) / 100;
  const minutes = Math.floor(rounded / 60);
  const remainder = (rounded - minutes * 60).toFixed(2);
  return minutes > 0 ? `${minutes}:${remainder.padStart(5, '0')}` : remainder;
}

const NON_PERSON_DISPLAY_VALUES = /^(?:great britain\s*&|unknown|not shared|n\/?a|—|-)$/i;

/** Improve legacy all-caps names at render time while preserving mixed-case names. */
export function formatPersonName(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value || NON_PERSON_DISPLAY_VALUES.test(value)) return value;
  if (value !== value.toLocaleUpperCase()) return value;

  const titleCase = (part: string) => part.toLocaleLowerCase().replace(/(^|[\s'-])([\p{L}])/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`);
  if (value.includes(',')) {
    const [surname, ...givenParts] = value.split(',').map(part => part.trim()).filter(Boolean);
    return givenParts.length ? `${titleCase(givenParts.join(' '))} ${titleCase(surname)}` : titleCase(surname);
  }
  const parts = value.split(/\s+/);
  return titleCase(parts.length > 1 ? [...parts.slice(1), parts[0]].join(' ') : value);
}

/** Add the conventional distance unit to legacy event names at display time. */
export function formatEventName(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value) return '—';
  return value.replace(/^(\d+)\s+(?=(?:freestyle|backstroke|breaststroke|butterfly|individual\s+medley)\b)/i, '$1m ');
}

/** Normalize age ranges and remove a redundant trailing "years" label. */
export function formatAgeGroup(raw: string | null | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value) return '—';
  return value.replace(/\s*(?:years?|yrs?)\s*$/i, '').replace(/\s*[-–]\s*/g, '–');
}

export function displayOrFallback(value: string | number | null | undefined, fallback = 'Not shared'): string {
  if (value === null || value === undefined) return fallback;
  const display = String(value).trim();
  return display || fallback;
}

export function formatHeldFor(years: number | string | null | undefined): string {
  if (years === null || years === undefined || String(years).trim() === '') return '—';
  const count = Number(years);
  if (!Number.isFinite(count) || count < 0) return '—';
  return `${count} ${count === 1 ? 'year' : 'years'}`;
}

/** True for short-course junior 25m events, regardless of event-name spelling. */
export function is25mEvent(event: string | null | undefined): boolean {
  return /^\s*25\s*(?:m(?:etres?)?|met(?:re|er)s?)\b/i.test(event ?? '');
}

export function getFlagEmoji(countryCode: string): string {
  const code = getCountryIso2(countryCode);
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  const codePoints = code.split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const COUNTRY_ALPHA3: Record<string, string> = {
  AU: 'AUS', BR: 'BRA', CA: 'CAN', DE: 'DEU', ES: 'ESP', FI: 'FIN', FR: 'FRA',
  GB: 'GBR', GR: 'GRC', HU: 'HUN', IE: 'IRL', IL: 'ISR', IT: 'ITA', JP: 'JPN',
  MX: 'MEX', NL: 'NLD', NO: 'NOR', NZ: 'NZL', PL: 'POL', PT: 'PRT', SE: 'SWE',
  US: 'USA', ZA: 'RSA',
};

const COUNTRY_ISO2: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_ALPHA3).map(([iso2, iso3]) => [iso3, iso2]),
);
Object.assign(COUNTRY_ISO2, {
  // Historical swimming archives use a mix of ISO and sporting federation
  // codes. Convert those aliases to alpha-2 before constructing flag emoji.
  ARG: 'AR', AUT: 'AT', BEL: 'BE', BUL: 'BG', CHN: 'CN', CRO: 'HR', CZE: 'CZ',
  ECU: 'EC', GER: 'DE', GRE: 'GR', HKG: 'HK', IRN: 'IR', KEN: 'KE', NED: 'NL',
  NIR: 'GB', POR: 'PT', ROU: 'RO', SGP: 'SG', SUI: 'CH', TUR: 'TR', URU: 'UY',
  RSA: 'ZA', ZAF: 'ZA', GB_AND_NI: 'GB', 'GB&NI': 'GB', UK: 'GB',
});

/** Normalize two- and three-letter country identifiers to ISO alpha-2. */
export function getCountryIso2(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (code.length === 2) return code;
  return COUNTRY_ISO2[code] ?? code;
}

/** Store and display South Africa with the platform's RSA identifier. */
export function normalizeCountryCode(country: string | null | undefined, countryCode: string | null | undefined): string {
  const name = country?.trim().toUpperCase() ?? '';
  const code = countryCode?.trim().toUpperCase() ?? '';
  if (['SOUTH AFRICA', 'RSA'].includes(name) || ['ZA', 'ZAF', 'RSA'].includes(code)) return 'RSA';
  return code;
}

export function getCountryAlpha3(countryCode: string): string {
  const rawCode = countryCode.trim().toUpperCase();
  if (rawCode === 'RSA' || rawCode === 'ZAF') return 'RSA';
  if (rawCode === 'GB&NI' || rawCode === 'GB_AND_NI' || rawCode === 'UK') return 'GBR';
  if (/^[A-Z]{3}$/.test(rawCode)) return rawCode;
  const code = getCountryIso2(rawCode);
  return COUNTRY_ALPHA3[code] ?? code;
}

export function getAgeFromDOB(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  return now.getFullYear() - birth.getFullYear();
}

export function getTransplantColor(type: string): string {
  const map: Record<string, string> = {
    Kidney: '#3b82f6',
    Liver: '#f59e0b',
    Heart: '#ef4444',
    Lung: '#8b5cf6',
    Pancreas: '#10b981',
    'Bone Marrow': '#6366f1',
    'Donor': '#0d9488',
  };
  return map[type] || '#6b7280';
}

export function timeToSeconds(time: string): number {
  // Handles formats: "28.02", "1:02.41", "2:18.90", "4:56.77"
  if (time.includes(':')) {
    const parts = time.split(':');
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return parseFloat(time);
}

export function formatDate(dateStr: string): string {
  if (!dateStr?.trim()) return '—';
  // Parse date-only values in UTC so the displayed day does not shift by timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00Z`) : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}`;
}
