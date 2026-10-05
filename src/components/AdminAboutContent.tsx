import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { DEFAULT_ABOUT_SECTIONS, type AboutSection } from '../lib/aboutContent';
import { describeSupabaseError, supabase } from '../lib/supabase';

const inputClass = 'w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';

export default function AdminAboutContent() {
  const [sections, setSections] = useState<AboutSection[]>(DEFAULT_ABOUT_SECTIONS);
  const [activeSlug, setActiveSlug] = useState(DEFAULT_ABOUT_SECTIONS[0].slug);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const activeSection = useMemo(() => sections.find(section => section.slug === activeSlug) ?? sections[0], [sections, activeSlug]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
      const { data, error: queryError } = await supabase.from('site_about_sections').select('slug,title,description,paragraphs,badge,external_label,external_href,links,is_published');
      if (!active) return;
      if (queryError) setError(`${describeSupabaseError(queryError)}. Apply supabase/migrations/20261005200000_admin_about_page_content.sql in Supabase, then refresh this page.`);
      else if (data?.length) {
        const saved = new Map(data.map(row => [row.slug, row as Partial<AboutSection>]));
        setSections(DEFAULT_ABOUT_SECTIONS.map(section => ({ ...section, ...(saved.get(section.slug) ?? {}) })));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const update = (changes: Partial<AboutSection>) => setSections(current => current.map(section => section.slug === activeSlug ? { ...section, ...changes } : section));

  const save = async () => {
    if (!supabase || !activeSection) return;
    setSaving(true); setError(''); setNotice('');
    const { error: saveError } = await supabase.from('site_about_sections').upsert({
      slug: activeSection.slug,
      title: activeSection.title.trim(),
      description: activeSection.description.trim(),
      paragraphs: activeSection.paragraphs.map(paragraph => paragraph.trim()).filter(Boolean),
      badge: activeSection.badge?.trim() || null,
      external_label: activeSection.external_label?.trim() || null,
      external_href: activeSection.external_href?.trim() || null,
      links: activeSection.links,
      is_published: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slug' });
    if (saveError) setError(describeSupabaseError(saveError));
    else setNotice(`${activeSection.title} saved and published.`);
    setSaving(false);
  };

  if (!activeSection) return null;

  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(220px,0.65fr)_minmax(0,1.35fr)]">
    <section className="border p-4 sm:p-5" style={{ border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}>
      <h2 className="font-bold text-white">About page sections</h2>
      <p className="mt-2 text-sm leading-6 text-white/55">Edit the overview and each About page section. Saving a section updates the public site.</p>
      <nav aria-label="About page sections" className="mt-4 grid gap-1">
        {sections.map((section, index) => <button key={section.slug} type="button" onClick={() => { setActiveSlug(section.slug); setError(''); setNotice(''); }} aria-current={section.slug === activeSlug ? 'page' : undefined} className={`flex items-center gap-3 border-l-2 px-3 py-2.5 text-left text-sm ${section.slug === activeSlug ? 'border-[var(--accent)] bg-[var(--navy)] font-semibold text-white' : 'border-transparent text-white/60 hover:bg-[var(--navy)] hover:text-white'}`}><span className="font-mono text-[10px] text-[var(--accent)]">{String(index + 1).padStart(2, '0')}</span>{section.slug === 'overview' ? 'About overview' : section.title}</button>)}
      </nav>
    </section>

    <section className="border p-4 sm:p-6" style={{ border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--navy-light)] pb-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">{activeSection.slug === 'overview' ? 'Landing header' : `/${activeSection.slug}`}</p><h2 className="mt-1 text-lg font-bold text-white">Edit {activeSection.slug === 'overview' ? 'About overview' : activeSection.title}</h2></div>{loading && <span className="text-xs text-white/45">Loading saved content…</span>}</div>
      {error && <p role="alert" className="mt-4 border border-red-300/20 bg-red-950/20 p-3 text-sm leading-6 text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-4 border border-emerald-300/20 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</p>}
      <div className="mt-5 grid gap-4">
        <label className="text-xs font-semibold text-white/65">Heading<input value={activeSection.title} onChange={event => update({ title: event.target.value })} className={`${inputClass} mt-2`} /></label>
        <label className="text-xs font-semibold text-white/65">Introduction<textarea rows={2} value={activeSection.description} onChange={event => update({ description: event.target.value })} className={`${inputClass} mt-2`} /></label>
        {activeSection.slug !== 'overview' && <label className="text-xs font-semibold text-white/65">Body paragraphs<textarea rows={9} value={activeSection.paragraphs.join('\n\n')} onChange={event => update({ paragraphs: event.target.value.split(/\n\s*\n/) })} placeholder="Separate paragraphs with a blank line" className={`${inputClass} mt-2`} /><span className="mt-1 block font-normal text-white/40">Separate paragraphs with a blank line.</span></label>}
        {activeSection.slug !== 'overview' && <label className="text-xs font-semibold text-white/65">Small callout (optional)<input value={activeSection.badge ?? ''} onChange={event => update({ badge: event.target.value })} className={`${inputClass} mt-2`} /></label>}
        {activeSection.slug !== 'overview' && <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-white/65">External link label<input value={activeSection.external_label ?? ''} onChange={event => update({ external_label: event.target.value })} className={`${inputClass} mt-2`} /></label><label className="text-xs font-semibold text-white/65">External link URL<input value={activeSection.external_href ?? ''} onChange={event => update({ external_href: event.target.value })} className={`${inputClass} mt-2`} placeholder="https://…" /></label></div>}
        {activeSection.slug !== 'overview' && <label className="text-xs font-semibold text-white/65">Page links<textarea rows={4} value={activeSection.links.map(link => `${link.label} | ${link.href}`).join('\n')} onChange={event => update({ links: event.target.value.split('\n').map(line => { const [label, ...href] = line.split('|'); return { label: label.trim(), href: href.join('|').trim() }; }).filter(link => link.label && link.href) })} className={`${inputClass} mt-2`} placeholder={'Browse athletes | /athletes\nExplore clubs | /clubs'} /><span className="mt-1 block font-normal text-white/40">One link per line, written as “Label | /path”.</span></label>}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--navy-light)] pt-4"><p className="text-xs text-white/40">This section is published when saved.</p><button type="button" onClick={() => void save()} disabled={loading || saving || !activeSection.title.trim()} className="inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:opacity-40"><Save size={15} />{saving ? 'Saving…' : 'Save and publish section'}</button></div>
    </section>
  </div>;
}
