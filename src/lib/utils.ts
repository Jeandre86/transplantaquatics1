export function formatTime(time: string): string {
  return time;
}

export function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const COUNTRY_ALPHA3: Record<string, string> = {
  AU: 'AUS', BR: 'BRA', CA: 'CAN', DE: 'DEU', ES: 'ESP', FI: 'FIN', FR: 'FRA',
  GB: 'GBR', GR: 'GRC', HU: 'HUN', IE: 'IRL', IL: 'ISR', IT: 'ITA', JP: 'JPN',
  MX: 'MEX', NL: 'NLD', NO: 'NOR', NZ: 'NZL', PL: 'POL', PT: 'PRT', SE: 'SWE',
  US: 'USA', ZA: 'ZAF',
};

export function getCountryAlpha3(countryCode: string): string {
  const code = countryCode.toUpperCase();
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
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
