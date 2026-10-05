import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { DEFAULT_ABOUT_SECTIONS, type AboutSection } from '../lib/aboutContent';
import { supabase } from '../lib/supabase';

export default function AboutPage() {
  const { section } = useParams();
  const [sections, setSections] = useState(DEFAULT_ABOUT_SECTIONS);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from('site_about_sections').select('slug,title,description,paragraphs,badge,external_label,external_href,links').eq('is_published', true)
      .then(({ data }) => {
        if (!active || !data?.length) return;
        const saved = new Map(data.map(row => [row.slug, row as Partial<AboutSection>]));
        setSections(DEFAULT_ABOUT_SECTIONS.map(defaultSection => ({ ...defaultSection, ...(saved.get(defaultSection.slug) ?? {}) })));
      });
    return () => { active = false; };
  }, []);

  const selected = sections.find(item => item.slug === section);
  const overview = sections.find(item => item.slug === 'overview') ?? DEFAULT_ABOUT_SECTIONS[0];

  if (section && !selected) return <Navigate to="/about" replace />;

  return (
    <div>
      <section className="ta-page-top relative overflow-hidden border-b border-[var(--navy-light)]">
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 md:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">About Transplant Aquatics</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {selected?.title ?? overview.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-on-dark)] sm:text-base">
            {selected?.description ?? overview.description}
          </p>
        </div>
      </section>

      <section className="min-h-[420px] bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
          {selected ? (
            <article className="max-w-3xl">
              <div className="space-y-5 border-l-2 border-[var(--accent)] pl-6">
                {selected.paragraphs.map(paragraph => <p key={paragraph} className="text-base leading-relaxed text-[var(--ink)] sm:text-lg">{paragraph}</p>)}
                {'badge' in selected && selected.badge && <span className="inline-flex border border-[var(--border)] bg-[var(--paper-dark)] px-3 py-2 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">{selected.badge}</span>}
                {selected.external_label && selected.external_href && <a href={selected.external_href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-[var(--accent-dark)] underline underline-offset-4">{selected.external_label}<ExternalLink size={14} /></a>}
                {selected.links.length > 0 && <div className="flex flex-wrap gap-3 pt-2">{selected.links.map(link => <Link key={link.href} to={link.href} className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent-dark)] hover:bg-[var(--ice)]">{link.label}<ArrowRight size={15} /></Link>)}</div>}
              </div>
            </article>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sections.filter(item => item.slug !== 'overview').map((item, index) => (
                  <Link key={item.slug} to={`/about/${item.slug}`} className="group flex min-h-40 flex-col justify-between border border-[var(--border)] p-5 transition-colors hover:border-[var(--accent-dark)] hover:bg-[var(--surface)]" style={{ backgroundColor: index % 2 ? 'var(--paper-dark)' : 'var(--surface)' }}>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-dark)]">0{index + 1}</span>
                    <span>
                      <span className="flex items-center justify-between gap-3 text-lg font-bold text-[var(--ink)]">{item.title}<ArrowRight size={17} className="shrink-0 transition-transform group-hover:translate-x-1" /></span>
                      <span className="mt-2 block text-sm leading-relaxed text-[var(--muted)]">{item.description}</span>
                      {item.slug === 'partners' && item.badge && <span className="mt-3 inline-flex font-mono text-[10px] uppercase tracking-widest text-[var(--accent-dark)]">TBA</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
