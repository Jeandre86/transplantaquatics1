import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Save, Settings2 } from 'lucide-react';
import EmptyState from './EmptyState';
import { describeSupabaseError, supabase } from '../lib/supabase';

type Settings = {
  points_table: 'world_aquatics_2026';
  require_meet_sheet_for_submissions: boolean;
  auto_verify_clean_official_imports: boolean;
  require_second_admin_for_world_records: boolean;
  email_on_profile_claim: boolean;
  email_on_result_submission: boolean;
  email_on_contact_message: boolean;
  socials: Record<SocialPlatform, SocialSetting>;
};

type SocialPlatform = 'facebook' | 'instagram' | 'x';
type SocialSetting = { enabled: boolean; url: string };
const SOCIAL_PLATFORMS: { key: SocialPlatform; label: string; placeholder: string }[] = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/your-page' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/your-account' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/your-account' },
];

const defaults: Settings = {
  points_table: 'world_aquatics_2026',
  require_meet_sheet_for_submissions: true,
  auto_verify_clean_official_imports: false,
  require_second_admin_for_world_records: true,
  email_on_profile_claim: true,
  email_on_result_submission: true,
  email_on_contact_message: true,
  socials: {
    facebook: { enabled: false, url: '' },
    instagram: { enabled: false, url: '' },
    x: { enabled: false, url: '' },
  },
};

const Toggle = ({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) => <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-[var(--navy-light)] px-5 py-4 last:border-0">
  <span><span className="block text-sm text-white">{label}</span><span className="mt-1 block text-xs leading-5 text-white/50">{description}</span></span>
  <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
</label>;

export default function AdminSiteSettings({ cardStyle }: { cardStyle: React.CSSProperties }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [socialValidation, setSocialValidation] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
      const { data, error: loadError } = await supabase.rpc('admin_get_site_settings');
      if (!active) return;
      if (loadError) setError(`${describeSupabaseError(loadError)}. Apply the site settings migration, then refresh.`);
      else {
        const loaded = data as Partial<Settings>;
        setSettings({ ...defaults, ...loaded, socials: { ...defaults.socials, ...(loaded.socials ?? {}) } });
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const update = (key: Exclude<keyof Settings, 'points_table' | 'socials'>, value: boolean) => {
    setSettings(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const updateSocial = (platform: SocialPlatform, patch: Partial<SocialSetting>) => {
    setSettings(current => ({ ...current, socials: { ...current.socials, [platform]: { ...current.socials[platform], ...patch } } }));
    setSaved(false);
    setSocialValidation('');
  };

  const save = async () => {
    if (!supabase) return;
    const invalidSocial = SOCIAL_PLATFORMS.find(({ key }) => {
      const social = settings.socials[key];
      if (!social.enabled && !social.url.trim()) return false;
      if (social.enabled && !social.url.trim()) return true;
      try { return new URL(social.url).protocol !== 'https:'; } catch { return true; }
    });
    if (invalidSocial) {
      setSocialValidation(`Add a valid HTTPS URL for ${invalidSocial.label}, or turn it off.`);
      return;
    }
    setSocialValidation('');
    setSaving(true); setError(''); setSaved(false);
    const { data, error: saveError } = await supabase.rpc('admin_update_site_settings', { p_settings: settings });
    if (saveError) setError(describeSupabaseError(saveError));
    else { setSettings({ ...defaults, ...(data as Partial<Settings>) }); setSaved(true); }
    setSaving(false);
  };

  if (loading) return <section className="border p-5 text-sm text-white/55" style={cardStyle}>Loading site settings…</section>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-xl font-bold text-white">Site settings</h2><p className="mt-1 text-sm text-white/55">Manage ranking rules, result verification and admin notifications.</p></div>
      <button type="button" onClick={() => void save()} disabled={saving || Boolean(error && error.includes('Apply the site settings migration'))} className="inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] hover:bg-white disabled:opacity-50">{saving ? <LoaderCircle size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}{saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}</button>
    </div>
    {error && <p role="alert" className="border border-red-300/20 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
    <section className="border p-5" style={cardStyle}>
      <div className="mb-4 flex items-center gap-3"><Settings2 size={18} className="text-[var(--accent)]" /><div><h3 className="font-bold text-white">Rankings</h3><p className="mt-1 text-xs text-white/50">Choose the points standard used to compare performances.</p></div></div>
      <label className="block max-w-lg text-xs text-white/60">Points table<select value={settings.points_table} onChange={() => setSaved(false)} className="mt-2 w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white"><option value="world_aquatics_2026">World Aquatics 2026 base times</option></select></label>
    </section>
    <section className="border" style={cardStyle}>
      <div className="border-b border-[var(--navy-light)] px-5 py-4"><h3 className="font-bold text-white">Verification</h3><p className="mt-1 text-xs text-white/50">Set the review safeguards for submitted and imported results.</p></div>
      <Toggle label="Require a meet sheet for swimmer submissions" description="Ask swimmers to attach meet documentation when they submit a result." checked={settings.require_meet_sheet_for_submissions} onChange={value => update('require_meet_sheet_for_submissions', value)} />
      <Toggle label="Auto-verify clean official imports" description="Allow official imports with no validation issues to skip manual review." checked={settings.auto_verify_clean_official_imports} onChange={value => update('auto_verify_clean_official_imports', value)} />
      <Toggle label="Require a second admin to approve World records" description="Keep record-breaking results pending until another administrator reviews them." checked={settings.require_second_admin_for_world_records} onChange={value => update('require_second_admin_for_world_records', value)} />
    </section>
    <section className="border" style={cardStyle}>
      <div className="border-b border-[var(--navy-light)] px-5 py-4"><h3 className="font-bold text-white">Notifications</h3><p className="mt-1 text-xs text-white/50">Choose which events should notify the admin team.</p></div>
      <Toggle label="A swimmer claims a profile" description="Notify admins when a profile claim is submitted." checked={settings.email_on_profile_claim} onChange={value => update('email_on_profile_claim', value)} />
      <Toggle label="A swimmer submits a result" description="Notify admins when a result enters the verification queue." checked={settings.email_on_result_submission} onChange={value => update('email_on_result_submission', value)} />
      <Toggle label="A visitor sends a contact message" description="Notify admins when a new message arrives in the internal inbox." checked={settings.email_on_contact_message} onChange={value => update('email_on_contact_message', value)} />
      <p className="px-5 py-3 text-xs text-white/40">Email delivery requires an email provider to be configured.</p>
    </section>
    <section className="border" style={cardStyle}>
      <div className="border-b border-[var(--navy-light)] px-5 py-4"><h3 className="font-bold text-white">Social links</h3><p className="mt-1 text-xs text-white/50">Add the public URLs and choose which ones appear in the site footer. The Follow section is hidden when every link is off.</p></div>
      {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => <div key={key} className="grid gap-3 border-b border-[var(--navy-light)] px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label htmlFor={`site-social-${key}`} className="block text-xs text-white/60">{label} URL<input id={`site-social-${key}`} type="url" inputMode="url" autoComplete="url" value={settings.socials[key].url} onChange={event => updateSocial(key, { url: event.target.value })} placeholder={placeholder} className="mt-2 w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--accent)]" /></label>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-white"><input type="checkbox" checked={settings.socials[key].enabled} onChange={event => updateSocial(key, { enabled: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />Show {label}</label>
      </div>)}
      {socialValidation && <p role="alert" className="px-5 pb-4 text-sm text-red-200">{socialValidation}</p>}
    </section>
    {!supabase && <EmptyState title="Database connection required" subtitle="Configure Supabase to load and save site settings." onDark />}
  </div>;
}
