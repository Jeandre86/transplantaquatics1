import { Link } from 'react-router-dom';
import { ArrowRight, CircleAlert } from 'lucide-react';
import EmptyState from './EmptyState';
import type { DataQualityQueryPreset } from './AdminDataQueries';

type DirectoryRow = Record<string, unknown>;
type Issue = { key: string; severity: 'Review' | 'Check'; label: string; detail: string; swimmerId: string };
type IssueGroup = { key: string; title: string; description: string; severity: 'High' | 'Medium'; issues: Issue[] };

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }

export function getAdminDataQualityIssues(swimmers: DirectoryRow[]): Issue[] {
  const issues: Issue[] = [];
  const names = new Map<string, DirectoryRow[]>();
  for (const swimmer of swimmers) {
    const first = text(swimmer.first_name);
    const last = text(swimmer.last_name);
    const fullName = `${first} ${last}`.trim();
    const id = text(swimmer.id);
    if (fullName) {
      const key = fullName.toLocaleLowerCase().replace(/\s+/g, ' ');
      names.set(key, [...(names.get(key) ?? []), swimmer]);
      if (/^[A-Z\s'’-]+$/.test(fullName) && /[A-Z]/.test(fullName)) {
        issues.push({ key: `caps-${id}`, severity: 'Check', label: fullName, detail: 'Name is stored in all caps.', swimmerId: id });
      }
      if (/^(great britain|united states|south africa|australia)\s*&?$/i.test(fullName)) {
        issues.push({ key: `nonperson-${id}`, severity: 'Review', label: fullName, detail: 'This looks like a country or team name rather than a person.', swimmerId: id });
      }
    }
    if (!text(swimmer.country)) issues.push({ key: `country-${id}`, severity: 'Check', label: fullName || 'Unnamed swimmer', detail: 'Country is missing.', swimmerId: id });
    if (!first || !last) issues.push({ key: `name-${id}`, severity: 'Review', label: fullName || 'Unnamed swimmer', detail: 'First name or surname is missing.', swimmerId: id });
  }
  for (const [normalized, profiles] of names) {
    if (profiles.length < 2) continue;
    for (const profile of profiles) {
      const id = text(profile.id);
      issues.push({ key: `duplicate-${normalized}-${id}`, severity: 'Review', label: `${text(profile.first_name)} ${text(profile.last_name)}`.trim(), detail: `${profiles.length} profiles share this name. Confirm identity before merging.`, swimmerId: id });
    }
  }
  return issues;
}

function groupIssues(issues: Issue[]): IssueGroup[] {
  const definitions = [
    { key: 'duplicate-', title: 'Possible duplicate', description: 'Profiles share a matching name. Confirm identity before merging.', severity: 'High' as const },
    { key: 'nonperson-', title: 'Not a person', description: 'A country or team name appears in the swimmer directory.', severity: 'High' as const },
    { key: 'caps-', title: 'Name formatting', description: 'Names are stored in all caps. Review before changing names.', severity: 'Medium' as const },
    { key: 'country-', title: 'Missing data', description: 'Swimmer profiles have no country.', severity: 'Medium' as const },
    { key: 'name-', title: 'Missing data', description: 'Swimmer profiles have an incomplete name.', severity: 'Medium' as const },
  ];
  return definitions.map(definition => ({
    ...definition,
    issues: issues.filter(issue => issue.key.startsWith(definition.key)),
  })).filter(group => group.issues.length > 0);
}

export default function AdminDataQuality({ swimmers, onOpenQueries }: { swimmers: DirectoryRow[]; onOpenQueries: (preset?: DataQualityQueryPreset) => void }) {
  const issues = getAdminDataQualityIssues(swimmers);
  const groups = groupIssues(issues);
  return <div className="space-y-5">
    <section className="border" style={{ border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}>
      {groups.length ? groups.map(group => {
        const first = group.issues[0];
        const duplicates = group.key === 'duplicate-';
        return <article key={group.key} className="flex flex-wrap items-center gap-4 border-b border-[var(--navy-light)] px-5 py-4 last:border-0 sm:px-6">
          <span className={`w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider ${group.severity === 'High' ? 'text-red-300' : 'text-amber-300'}`}>{group.severity}</span>
          <span className="min-w-0 flex-1"><span className="block text-xs text-white/55">{group.title}</span><span className="block text-sm font-semibold text-white">{duplicates ? `${group.issues.length} profiles in possible duplicate groups` : `${group.issues.length} ${group.issues.length === 1 ? 'profile' : 'profiles'} · ${first.label}`}</span><span className="mt-1 block text-xs leading-5 text-white/50">{duplicates ? first.detail : group.description}</span></span>
          <span className="font-mono text-xs text-white/40">{group.issues.length.toLocaleString()}</span>
          {duplicates ? <button type="button" onClick={() => onOpenQueries()} className="border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">Review merge</button> : <Link to={`/athletes/${first.swimmerId}`} className="inline-flex items-center gap-1 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/80 hover:border-[var(--accent)] hover:text-[var(--accent)]">Review <ArrowRight size={13} /></Link>}
        </article>;
      }) : <div className="p-5"><EmptyState title="No directory issues found" subtitle="The available name and country checks found no issues in the loaded profiles." onDark /></div>}
    </section>
    <aside className="flex flex-wrap items-center gap-3 border-l-2 border-[var(--accent)] bg-[var(--navy-mid)] px-4 py-3 text-xs leading-5 text-white/55">
      <CircleAlert size={15} className="shrink-0 text-[var(--accent)]" />
      <p className="min-w-0 flex-1">Open a prebuilt result query to review swims with missing age groups or unusual time formats.</p>
      <button type="button" onClick={() => onOpenQueries('missing_age_group')} className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--accent)] hover:underline">Find missing age groups <ArrowRight size={13} /></button>
      <button type="button" onClick={() => onOpenQueries('invalid_time_format')} className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--accent)] hover:underline">Find invalid times <ArrowRight size={13} /></button>
    </aside>
  </div>;
}
