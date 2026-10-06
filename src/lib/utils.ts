export function formatTime(time: string): string {
  return time;
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
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
