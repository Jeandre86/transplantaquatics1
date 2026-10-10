import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ExternalLink, Medal, UsersRound, BookOpenText, Globe2, ClipboardCheck, HeartHandshake, Waves, Trophy, CalendarDays, MapPin, UserPlus, Building2, Handshake } from 'lucide-react';
import { DEFAULT_ABOUT_SECTIONS, type AboutSection } from '../lib/aboutContent';
import { supabase } from '../lib/supabase';
import ContactMessageForm from '../components/ContactMessageForm';

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
      <section className="ta-page-top relative overflow-hidden border-b border-[var(--navy-light)]">
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 md:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">About Transplant Aquatics</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {selected?.title ?? story.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-on-dark)] sm:text-base">
            {selected?.description ?? story.description}
          </p>
        </div>
      </section>

      <section className="min-h-[420px] bg-[var(--paper)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
          {selected && section !== 'our-story' ? (
            selected.slug === 'what-we-do' ? (
              <article className="space-y-14">
                <section className="grid gap-8 border-b border-[var(--border)] pb-12 md:grid-cols-[1.05fr_.95fr] md:gap-16">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">A global home for transplant swimming</p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--ink)] sm:text-4xl">We bring the sport, its performances and its people together.</h2>
                  </div>
                  <div className="space-y-4 text-base leading-relaxed text-[var(--muted)]">
                    {selected.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                    <Link to="/athletes" className="inline-flex items-center gap-2 pt-1 font-semibold text-[var(--accent-dark)] hover:underline">Explore athlete profiles <ArrowRight size={15} /></Link>
                  </div>
                </section>

                <section aria-labelledby="what-we-do-pillars">
                  <div className="max-w-2xl">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">What that looks like</p>
                    <h2 id="what-we-do-pillars" className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">A connected picture of the sport</h2>
                  </div>
                  <div className="mt-7 grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { icon: Medal, title: 'Bring results together', copy: 'Find swims from transplant meets and Games in one results library, with meet names and dates to give each performance its context.', href: '/results', link: 'Browse results' },
                      { icon: ClipboardCheck, title: 'Make progress visible', copy: 'Compare event rankings, personal bests and recognised records to follow how performances develop over time.', href: '/rankings', link: 'Explore rankings' },
                      { icon: UsersRound, title: 'Put athletes first', copy: 'Discover swimmer profiles that bring together results, meet history and the details athletes choose to share.', href: '/athletes', link: 'Meet the athletes' },
                      { icon: Globe2, title: 'Connect countries and clubs', copy: 'Explore the people and clubs that make up an international community, and find ways to connect closer to home.', href: '/clubs', link: 'Find a club' },
                      { icon: BookOpenText, title: 'Share stories from the pool deck', copy: 'Read news and personal stories that put the people, preparation and community behind the performances in view.', href: '/from-the-pool-deck', link: 'Read the stories' },
                      { icon: HeartHandshake, title: 'Celebrate the gift of donation', copy: 'Recognise the donors, families, clinicians, teammates and supporters whose generosity makes new journeys possible.', href: '/about/partners', link: 'Learn about our community' },
                    ].map(({ icon: Icon, title, copy, href, link }) => <div key={title} className="flex flex-col bg-white p-6 sm:p-7">
                      <Icon size={21} strokeWidth={1.7} className="text-[var(--accent-dark)]" aria-hidden="true" />
                      <h3 className="mt-5 text-lg font-bold text-[var(--ink)]">{title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">{copy}</p>
                      <Link to={href} className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--accent-dark)] hover:underline">{link}<ArrowRight size={14} /></Link>
                    </div>)}
                  </div>
                </section>

                <section className="grid gap-8 bg-[var(--navy)] p-7 text-white sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="max-w-2xl">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Be part of it</p>
                    <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">Every lane is stronger when more people can find the sport.</h2>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">Whether you swim, coach, volunteer or cheer someone on, start by exploring the community and the stories that bring it to life.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/join" className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--navy)] transition-colors hover:bg-white">Get involved<ArrowRight size={15} /></Link>
                    <Link to="/records" className="inline-flex items-center gap-2 border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">See the records</Link>
                  </div>
                </section>
              </article>
            ) : selected.slug === 'transplant-swimming-and-the-games' ? (
              <article className="space-y-14">
                <section className="grid gap-8 border-b border-[var(--border)] pb-12 md:grid-cols-[1.05fr_.95fr] md:gap-16">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">The sport and the celebration</p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--ink)] sm:text-4xl">A race is measured in seconds. The journey to the starting block is much bigger.</h2>
                  </div>
                  <div className="space-y-4 text-base leading-relaxed text-[var(--muted)]">
                    {selected.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                    <a href={selected.external_href ?? 'https://wtgf.org/swimming/'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 pt-1 font-semibold text-[var(--accent-dark)] underline underline-offset-4">{selected.external_label ?? 'Swimming at the World Transplant Games'}<ExternalLink size={14} /></a>
                  </div>
                </section>

                <section aria-labelledby="games-swimming-basics">
                  <div className="max-w-2xl">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">The events</p>
                    <h2 id="games-swimming-basics" className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">Four strokes, individual races and team relays</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Swimming at the Games includes races in freestyle, backstroke, breaststroke and butterfly. Individual medley combines all four strokes in one race; relays bring four swimmers together for a team event.</p>
                  </div>
                  <div className="mt-7 grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { title: 'Freestyle', copy: 'A fast, adaptable stroke raced across a range of distances.' },
                      { title: 'Backstroke', copy: 'Swimmers race on their backs, with distinct starts and turns.' },
                      { title: 'Breaststroke', copy: 'A technically precise stroke with a recognisable rhythm and timing.' },
                      { title: 'Butterfly & medley', copy: 'Butterfly brings power and timing; the individual medley tests all four strokes.' },
                    ].map(item => <div key={item.title} className="bg-white p-5 sm:p-6"><Waves size={20} strokeWidth={1.7} className="text-[var(--accent-dark)]" aria-hidden="true" /><h3 className="mt-4 text-base font-bold text-[var(--ink)]">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.copy}</p></div>)}
                  </div>
                </section>

                <section className="grid gap-8 md:grid-cols-2 md:gap-12">
                  <div className="border-t-2 border-[var(--accent)] pt-5">
                    <Trophy size={21} strokeWidth={1.7} className="text-[var(--accent-dark)]" aria-hidden="true" />
                    <h2 className="mt-4 text-xl font-bold text-[var(--ink)]">Competition with a shared spirit</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Swimmers come to test themselves, improve their times and represent their countries. The Games also create a rare chance to meet people from around the world who share the experience of life after transplant.</p>
                  </div>
                  <div className="border-t-2 border-[var(--accent)] pt-5">
                    <CalendarDays size={21} strokeWidth={1.7} className="text-[var(--accent-dark)]" aria-hidden="true" />
                    <h2 className="mt-4 text-xl font-bold text-[var(--ink)]">Each Games has its own programme</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Events, age groups, eligibility and competition rules are set for each edition. Check the current Games information before planning an entry or comparing event programmes across years.</p>
                    <a href="https://wtgf.org/swimming/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)] hover:underline">See the Federation’s swimming information<ExternalLink size={14} /></a>
                  </div>
                </section>

                <section className="grid gap-8 bg-[var(--navy)] p-7 text-white sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="max-w-2xl">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Explore the sport</p>
                    <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">Follow the swims. Discover the people behind them.</h2>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">Browse results, see recognised Games records and explore athlete profiles from across the transplant swimming community.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/results" className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--navy)] transition-colors hover:bg-white">Browse results<ArrowRight size={15} /></Link>
                    <Link to="/records" className="inline-flex items-center gap-2 border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">See Games records</Link>
                  </div>
                </section>
              </article>
            ) : selected.slug === 'community-and-clubs' ? (
              <article className="space-y-14">
                <section className="grid gap-8 border-b border-[var(--border)] pb-12 md:grid-cols-[1.05fr_.95fr] md:gap-16">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">People make the community</p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--ink)] sm:text-4xl">A place to find your people, your club and your next lane.</h2>
                  </div>
                  <div className="space-y-4 text-base leading-relaxed text-[var(--muted)]">
                    {selected.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                    <Link to="/clubs" className="inline-flex items-center gap-2 pt-1 font-semibold text-[var(--accent-dark)] hover:underline">Browse transplant swim clubs <ArrowRight size={15} /></Link>
                  </div>
                </section>

                <section aria-labelledby="community-who">
                  <div className="max-w-2xl">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">A shared space</p>
                    <h2 id="community-who" className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">More than the people on the blocks</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Transplant swimming brings together athletes at different stages of their journey and the people who help make participation possible.</p>
                  </div>
                  <div className="mt-7 grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { icon: UsersRound, title: 'Swimmers', copy: 'Train, compete, share your progress and connect your profile with your club.' },
                      { icon: Building2, title: 'Clubs', copy: 'Help people discover where you train and how to get in touch.' },
                      { icon: UserPlus, title: 'Coaches & teams', copy: 'Support preparation, build confidence and help swimmers find a path into competition.' },
                      { icon: HeartHandshake, title: 'Family & supporters', copy: 'Encourage athletes and celebrate the community around every performance.' },
                    ].map(({ icon: Icon, title, copy }) => <div key={title} className="bg-white p-5 sm:p-6"><Icon size={21} strokeWidth={1.7} className="text-[var(--accent-dark)]" aria-hidden="true" /><h3 className="mt-4 text-base font-bold text-[var(--ink)]">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{copy}</p></div>)}
                  </div>
                </section>

                <section className="grid gap-8 md:grid-cols-2 md:gap-12">
                  <div className="border-t-2 border-[var(--accent)] pt-5">
                    <MapPin size={21} strokeWidth={1.7} className="text-[var(--accent-dark)]" aria-hidden="true" />
                    <h2 className="mt-4 text-xl font-bold text-[var(--ink)]">Looking for a place to swim?</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Search the club directory by name, city or country. Club pages can share location details and contact information so you can find out whether a group is right for you.</p>
                    <Link to="/clubs" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)] hover:underline">Find a club<ArrowRight size={14} /></Link>
                  </div>
                  <div className="border-t-2 border-[var(--accent)] pt-5">
                    <Building2 size={21} strokeWidth={1.7} className="text-[var(--accent-dark)]" aria-hidden="true" />
                    <h2 className="mt-4 text-xl font-bold text-[var(--ink)]">Run or coach a club?</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Register your group so swimmers nearby can discover it. Club owners can add coaches, and swimmers can connect their athlete profiles with their club.</p>
                    <Link to="/join" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-dark)] hover:underline">Get started<ArrowRight size={14} /></Link>
                  </div>
                </section>

                <section className="border border-[var(--border)] bg-white p-6 sm:p-8">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">How it works on this site</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)]">Connect a swimmer profile to a club</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">A club connection helps keep athlete profiles and results linked to the right community. Swimmers need to belong to a club to submit their own results. Administrators can still verify official imported results without a club connection.</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link to="/athletes" className="inline-flex items-center gap-2 border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--accent-dark)]">Explore swimmer profiles<ArrowRight size={14} /></Link>
                    <Link to="/clubs" className="inline-flex items-center gap-2 border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--accent-dark)]">Explore clubs<ArrowRight size={14} /></Link>
                  </div>
                </section>

                <section className="grid gap-8 bg-[var(--navy)] p-7 text-white sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="max-w-2xl">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Find your connection</p>
                    <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">Start with a swimmer, a club or a story.</h2>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">Explore the directory, meet the athletes and see how transplant swimming brings people together around the world.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/clubs" className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--navy)] transition-colors hover:bg-white">Browse clubs<ArrowRight size={15} /></Link>
                    <Link to="/athletes" className="inline-flex items-center gap-2 border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">Meet athletes</Link>
                  </div>
                </section>
              </article>
            ) : selected.slug === 'partners' ? (
              <article className="space-y-14">
                <section className="grid gap-8 border-b border-[var(--border)] pb-12 md:grid-cols-[1.05fr_.95fr] md:gap-16">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">Working together</p>
                    <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--ink)] sm:text-4xl">Partnerships help transplant swimming reach further.</h2>
                  </div>
                  <div className="space-y-4 text-base leading-relaxed text-[var(--muted)]">
                    <p>Transplant Aquatics is a growing platform for the swimmers, clubs and stories around transplant swimming. We welcome conversations with organisations that share an interest in the sport and the people who make it special.</p>
                    <p>We’re starting by recognising the World Transplant Games Federation and its central role in the international Games and transplant sport.</p>
                  </div>
                </section>

                <section aria-labelledby="featured-partner-heading" className="grid overflow-hidden border border-[var(--border)] bg-white md:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="p-6 sm:p-9">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">First featured organisation</p>
                    <div className="mt-4 inline-flex max-w-full items-center border border-[var(--border)] bg-white px-3 py-2.5">
                      <img src="/assets/world-transplant-games-federation-logo.png" alt="World Transplant Games Federation" className="h-auto w-[260px] max-w-full object-contain" width="300" height="74" />
                    </div>
                    <h2 id="featured-partner-heading" className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">World Transplant Games Federation</h2>
                    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">The World Transplant Games Federation (WTGF) is an international organisation that celebrates successful transplantation through the World Transplant Games and promotes awareness of organ donation and the benefits of sport after transplant. The Federation says the first competitive event for transplant recipients was held in Portsmouth in 1978.</p>
                    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">Swimming has been part of the World Transplant Games since their beginning. Its programme includes individual races and relays across the recognised strokes, with event details set out in the rules for each Games.</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <a href="https://wtgf.org/about-us/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[var(--navy)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-dark)]">About the WTGF<ExternalLink size={14} /></a>
                      <a href="https://wtgf.org/swimming/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent-dark)]">Swimming at the Games<ExternalLink size={14} /></a>
                    </div>
                  </div>
                  <div className="flex flex-col justify-between gap-8 bg-[var(--navy)] p-6 text-white sm:p-8">
                    <div><Handshake size={24} strokeWidth={1.6} className="text-[var(--accent)]" aria-hidden="true" /><p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">Why we’re featuring them</p><p className="mt-3 text-lg font-semibold leading-snug">The Federation is at the heart of the international Games that bring transplant athletes together.</p></div>
                    <p className="border-t border-white/15 pt-4 text-xs leading-relaxed text-white/55">This page recognises the WTGF’s role and links to its official information. It does not imply an endorsement or formal partnership.</p>
                  </div>
                </section>

                <section aria-labelledby="partner-welcome-heading">
                  <div className="max-w-2xl">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">Partners are welcome</p>
                    <h2 id="partner-welcome-heading" className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">Help us make the sport easier to discover and support.</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">We’re open to conversations with groups and businesses whose work can strengthen the transplant swimming community.</p>
                  </div>
                  <div className="mt-7 grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { icon: Trophy, title: 'Sport organisations', copy: 'Federations, event organisers and swimming bodies.' },
                      { icon: HeartHandshake, title: 'Transplant community', copy: 'Clubs, charities and organisations supporting recipients and donors.' },
                      { icon: UsersRound, title: 'Health & wellbeing', copy: 'Teams helping people stay active, connected and informed.' },
                      { icon: Globe2, title: 'Supporters & sponsors', copy: 'Businesses and individuals ready to help the community grow.' },
                    ].map(({ icon: Icon, title, copy }) => <div key={title} className="bg-white p-5 sm:p-6"><Icon size={21} strokeWidth={1.7} className="text-[var(--accent-dark)]" aria-hidden="true" /><h3 className="mt-4 text-base font-bold text-[var(--ink)]">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{copy}</p></div>)}
                  </div>
                </section>

                <section className="grid gap-8 bg-[var(--navy)] p-7 text-white sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="max-w-2xl">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Start a conversation</p>
                    <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">Interested in supporting transplant swimming?</h2>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">We’d be glad to hear from organisations interested in working with Transplant Aquatics as the platform and community develop.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/about/contact-us" className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--navy)] transition-colors hover:bg-white">Contact us<ArrowRight size={15} /></Link>
                    <Link to="/clubs" className="inline-flex items-center gap-2 border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">Explore the community</Link>
                  </div>
                </section>
              </article>
            ) : selected.slug === 'contact-us' ? (
              <article className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
                <ContactMessageForm />
                <aside className="border border-[var(--border)] bg-white p-5 sm:p-6">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-dark)]">Get in touch</p>
                  <h2 className="mt-3 text-xl font-bold text-[var(--ink)]">What can we help with?</h2>
                  <ul className="mt-5 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
                    <li><strong className="text-[var(--ink)]">Partnerships:</strong> tell us about your organisation and how you’d like to support transplant swimming.</li>
                    <li><strong className="text-[var(--ink)]">Clubs:</strong> ask about listing a club or helping swimmers find a place to train.</li>
                    <li><strong className="text-[var(--ink)]">Results and profiles:</strong> include the swimmer or meet name and the relevant dates.</li>
                    <li><strong className="text-[var(--ink)]">General enquiries:</strong> share your question and the team will review it.</li>
                  </ul>
                  <p className="mt-5 border-t border-[var(--border)] pt-4 text-xs leading-relaxed text-[var(--muted)]">Please don’t include medical records, account passwords or other sensitive personal information.</p>
                </aside>
              </article>
            ) : <article className="max-w-3xl">
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
