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
  const story = sections.find(item => item.slug === 'our-story') ?? DEFAULT_ABOUT_SECTIONS[1];
  const partners = sections.find(item => item.slug === 'partners') ?? DEFAULT_ABOUT_SECTIONS[5];

  if (section && !selected) return <Navigate to="/about" replace />;

  return (
    <div>
      {section !== 'our-story' && <section className="ta-page-top relative overflow-hidden border-b border-[var(--navy-light)]">
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 md:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">About Transplant Aquatics</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {selected?.title ?? story.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-on-dark)] sm:text-base">
            {selected?.description ?? story.description}
          </p>
        </div>
      </section>}

      <section className="min-h-[420px] bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
          {selected && section !== 'our-story' ? (
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
              <section aria-label="Our story" className="grid gap-8 bg-[var(--paper)] py-10 md:grid-cols-2 md:gap-14">
                <h2 className="max-w-xl text-2xl font-semibold leading-snug tracking-tight text-[var(--ink)] sm:text-3xl">Every swimmer here has had an organ or bone marrow transplant. We exist so their performances are recorded, compared and celebrated like any elite sport.</h2>
                <div className="space-y-5 text-base leading-relaxed text-[var(--muted)]">
                  {story.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                  <Link to="/athletes" className="inline-flex items-center gap-2 pt-1 font-semibold text-[var(--accent-dark)] hover:underline">Meet the athletes <ArrowRight size={15} /></Link>
                </div>
              </section>
              <section className="relative left-1/2 right-1/2 mt-0 w-screen -translate-x-1/2 border-t border-[var(--border)] bg-white py-9" aria-labelledby="about-find-heading">
                <div className="mx-auto max-w-7xl px-4 sm:px-6">
                  <h2 id="about-find-heading" className="mb-6 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">What you’ll find here</h2>
                  <div className="grid gap-x-12 md:grid-cols-2">
                    {[
                      ['Rankings', 'Who is fastest right now? Each athlete’s best verified swim, ranked by event.', '/rankings'],
                      ['Results', 'Every swim from every meet, including ones still waiting for verification.', '/results'],
                      ['Records', 'The fastest swim ever set at the World Transplant Games, for each event and age group.', '/records'],
                      ['Athletes', 'A profile for every swimmer, with their best times, meets and medals.', '/athletes'],
                    ].map(([label, copy, href]) => <Link key={label} to={href} className="grid gap-2 border-t border-[var(--border)] py-4 transition-colors hover:bg-[var(--paper)] sm:grid-cols-[120px_1fr] sm:gap-5"><span className="font-semibold text-[var(--ink)]">{label}</span><span className="text-sm leading-relaxed text-[var(--muted)]">{copy}</span></Link>)}
                  </div>
                </div>
              </section>
              <section className="relative left-1/2 right-1/2 grid w-screen -translate-x-1/2 gap-8 bg-[var(--paper)] py-9 md:grid-cols-2 md:gap-14" aria-label="Community and partners">
                <div className="mx-auto w-full max-w-7xl px-4 md:col-span-2 md:grid md:grid-cols-2 md:gap-14 sm:px-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">Who’s behind it</h2>
                    <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{overview.description} {partners.description}</p>
                    {partners.badge && <p className="mt-5 border-t border-[var(--border)] py-3 text-sm text-[var(--muted)]">{partners.badge}</p>}
                    {sections.filter(item => !['overview', 'our-story', 'what-we-do', 'partners'].includes(item.slug)).map(item => <Link key={item.slug} to={`/about/${item.slug}`} className="flex items-center justify-between border-t border-[var(--border)] py-3 text-sm font-medium text-[var(--ink)] hover:text-[var(--accent-dark)]">{item.title}<ArrowRight size={15} /></Link>)}
                  </div>
                  <div className="mt-1 bg-[var(--navy)] p-7 text-white sm:p-9 md:mt-0">
                    <h2 className="text-2xl font-bold leading-tight sm:text-3xl">Every athlete here is swimming because of a donor.</h2>
                    <p className="mt-4 text-sm leading-relaxed text-white/70">Learn about organ donation and talk with your family about your decision.</p>
                    <Link to="/about/partners" className="mt-7 inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--navy)] transition-colors hover:bg-white">Learn more <ArrowRight size={15} /></Link>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
