import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';

const ABOUT_SECTIONS = [
  {
    slug: 'our-story', title: 'Our Story',
    description: 'One place to follow transplant swimming and the people who make it.',
    paragraphs: [
      'Transplant Aquatics brings the sport into one shared space. Athlete profiles, competition results, rankings, records and stories help swimmers and supporters follow performances across countries and Games.',
      'The idea is simple: make transplant swimming easier to discover, understand and celebrate, while keeping the athletes and their achievements at the centre.',
    ],
  },
  {
    slug: 'what-we-do', title: 'What We Do',
    description: 'Explore the sport, follow performances and share the stories behind them.',
    paragraphs: [
      'Transplant Aquatics is a digital home for transplant swimming. It brings together athlete profiles, results, records, rankings, country directories and stories from the pool deck.',
      'Athletes can build a profile and submit results for review. Visitors can explore performances, compare times and learn more about the community around the sport.',
    ],
  },
  {
    slug: 'transplant-swimming-and-the-games', title: 'Transplant Swimming and the Games',
    description: 'Swimming has been part of the World Transplant Games since the first Games in 1978.',
    paragraphs: [
      'Transplant swimming includes pool and open-water competition. Events use the familiar strokes—freestyle, backstroke, breaststroke, butterfly and individual medley—with distances and formats set by each Games programme.',
      'The World Transplant Games Federation describes swimming as one of the most popular sports at the Games. For current event formats, eligibility and official rules, check the Federation’s published guidance.',
    ],
    external: { label: 'Swimming at the World Transplant Games', href: 'https://wtgf.org/swimming/' },
  },
  {
    slug: 'community-and-clubs', title: 'Community and Clubs',
    description: 'Find swimmers, clubs and connections across the transplant aquatics community.',
    paragraphs: [
      'A local swimming club can offer coached sessions, help with technique and a welcoming place to train. The Athletes directory and club listings on this site are designed to help people find connections across the community.',
      'If you are new to transplant swimming, start by exploring athlete profiles and club listings, then get in touch with a club that suits your location and experience.',
    ],
    links: [
      { label: 'Browse athletes', href: '/athletes' },
      { label: 'Explore clubs', href: '/clubs' },
    ],
  },
  {
    slug: 'partners', title: 'Partners',
    description: 'We welcome organisations that want to support transplant swimming.',
    paragraphs: [
      'Partner information is being prepared. This page will introduce confirmed partners and explain how they support the transplant swimming community.',
    ],
    badge: 'Partner details to be announced',
  },
  {
    slug: 'contact-us', title: 'Contact Us',
    description: 'Choose the route that best matches what you need.',
    paragraphs: [
      'A public contact email or message form has not been configured for this site yet. In the meantime, use the relevant site page below to get started.',
    ],
    links: [
      { label: 'Join Transplant Aquatics', href: '/join' },
      { label: 'Submit a result', href: '/submit' },
      { label: 'Manage your profile', href: '/profile' },
    ],
  },
] as const;

export default function AboutPage() {
  const { section } = useParams();
  const selected = ABOUT_SECTIONS.find(item => item.slug === section);

  if (section && !selected) return <Navigate to="/about" replace />;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-[var(--navy-light)] bg-[var(--navy)]">
        <img src="/assets/aquatics-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, var(--navy) 15%, rgba(7,26,43,.72) 100%)' }} />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 md:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">About Transplant Aquatics</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {selected?.title ?? 'Different journeys. Same water.'}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-on-dark)] sm:text-base">
            {selected?.description ?? 'A shared place to discover transplant swimming, its athletes and the community around the sport.'}
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
                {'external' in selected && selected.external && <a href={selected.external.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-[var(--accent-dark)] underline underline-offset-4">{selected.external.label}<ExternalLink size={14} /></a>}
                {'links' in selected && selected.links && <div className="flex flex-wrap gap-3 pt-2">{selected.links.map(link => <Link key={link.href} to={link.href} className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent-dark)] hover:bg-[var(--ice)]">{link.label}<ArrowRight size={15} /></Link>)}</div>}
              </div>
            </article>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ABOUT_SECTIONS.map((item, index) => (
                  <Link key={item.slug} to={`/about/${item.slug}`} className="group flex min-h-40 flex-col justify-between border border-[var(--border)] p-5 transition-colors hover:border-[var(--accent-dark)] hover:bg-[var(--surface)]" style={{ backgroundColor: index % 2 ? 'var(--paper-dark)' : 'var(--surface)' }}>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent-dark)]">0{index + 1}</span>
                    <span>
                      <span className="flex items-center justify-between gap-3 text-lg font-bold text-[var(--ink)]">{item.title}<ArrowRight size={17} className="shrink-0 transition-transform group-hover:translate-x-1" /></span>
                      <span className="mt-2 block text-sm leading-relaxed text-[var(--muted)]">{item.description}</span>
                      {item.slug === 'partners' && <span className="mt-3 inline-flex font-mono text-[10px] uppercase tracking-widest text-[var(--accent-dark)]">TBA</span>}
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
