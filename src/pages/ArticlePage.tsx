import { useParams, Link } from 'react-router-dom';
import { articles } from '../data/articles';
import { formatDate } from '../lib/utils';
import Eyebrow from '../components/Eyebrow';
import EmptyState from '../components/EmptyState';

const speedLines = {
  backgroundImage:
    'repeating-linear-gradient(-55deg, transparent, transparent 18px, rgba(255,255,255,0.02) 18px, rgba(255,255,255,0.02) 19px)',
};

// Extended article content (some articles get richer body text)
const ARTICLE_BODIES: Record<string, string[]> = {
  'the-race-doesnt-end-at-transplant': [
    'When Michael van der Berg stepped onto the blocks at the 2025 World Transplant Games in Perth, he carried with him a decade of waiting, one successful kidney transplant, and a lifetime personal best that would have been remarkable for any masters swimmer. What made it extraordinary was everything that came before the swim.',
    'Transplant athletes occupy a unique space in global sport. They compete not despite their medical histories but because of them — their surgical scars a reminder of the gift that made competition possible. For many, the transplant is not an ending but an origin story.',
    '"Swimming gave me my identity back," van der Berg said after his 100m Freestyle gold in Perth. "Before the transplant, I watched from the sidelines. After, I realised I had nothing to lose. I could only go forward."',
    'That sentiment is echoed by athletes from Cape Town to Tokyo. Camille Dupont, who received a bilateral lung transplant after years living with cystic fibrosis, returned to the water eighteen months post-surgery. She now holds the world record in the Women 30–39 100m Butterfly. Her coach, Pierre Marchand, describes her as the most focused athlete he has worked with in thirty years of coaching.',
    '"She doesn\'t waste a metre," Marchand says. "Every session has a purpose. She understands what her body has been through better than any athlete I\'ve coached."',
    'The data reflects this. Split Second\'s records show a consistent trend: transplant athletes who compete at the elite level tend to peak later than their non-transplant counterparts, with many recording personal bests in their forties and fifties. Recovery, it seems, is a form of preparation.',
    'For James Holloway, who received a liver transplant at 33 and returned to the competitive pool at 35, the mental component was as significant as the physical. "There was a period where I didn\'t believe I could be fast again," he says. "The transplant changed that. It recalibrated what I thought I deserved."',
    'As more transplant athletes push the boundaries of what is medically expected, the sport is attracting attention from clinicians and researchers. Papers have been published examining exercise capacity in heart and lung transplant recipients. The athletes are, in some sense, data points in a much larger conversation about post-transplant quality of life.',
    'But for the athletes themselves, the conversation is simpler. It is about competition. It is about the water. It is about a second chance used well.',
  ],
  'swim-faster-at-40-plus': [
    'The conventional wisdom in swimming is that peak performance arrives in the mid-twenties and declines steadily thereafter. For transplant athletes in the 40–49 age group, that wisdom often doesn\'t apply.',
    'Hans Müller began competing seriously only after his kidney transplant at 36. He is now, at 51, among the fastest breaststroke swimmers in the world in his age group. His training volume has increased, not decreased, with age.',
    '"Recovery is the key," says coach Petra Hoffmann, who has worked with Müller for over a decade. "Older athletes tend to understand their bodies better. They know when to push and when to rest. The younger ones often don\'t."',
    'The physiological changes post-transplant are complex. Immunosuppressant medications affect muscle composition, cardiovascular efficiency, and metabolic rates in ways that require adapted training programmes. Athletes and coaches who understand these dynamics tend to progress faster.',
    'Lars Eriksson, a three-time Scandinavian record-holder in the Men 50–59 100m Freestyle, trains six days a week despite competing for over fifteen years post-transplant. His weekly plan includes two technique-focused sessions, three high-intensity interval sets, and one long aerobic swim.',
    '"I don\'t try to swim like I\'m 25," Eriksson says. "I swim like I\'m 52 and I know exactly what that means. I have nothing to prove except to myself."',
    'The data from Split Second\'s records database shows that in virtually every transplant age group, times have been improving year-on-year. This is partly a function of the sport\'s growth — more athletes means more competition and faster times. But coaches attribute much of it to better training methodology and athlete education.',
  ],
  'perth-2025-recap': [
    'The 2025 World Transplant Games swimming programme was, by any measure, one of the most competitive in the event\'s history. Held across five days at the Perth Convention and Exhibition Centre Aquatics Facility, it attracted 312 swimmers from 29 nations and produced eight world records.',
    'Michael van der Berg of South Africa was the standout performer of the meet, claiming gold in the 50m and 100m Freestyle and finishing second in the 200m. His 100m Freestyle time of 58.92 seconds broke the previous world record by half a second and drew gasps from the assembled crowd.',
    'In the women\'s events, Sarah Brennan of the United Kingdom produced a dominant performance in the backstroke events, taking gold in the 50m and 100m Backstroke and silver in the 200m. Her 100m Backstroke time of 1:08.14 was a world record.',
    'The butterfly programme was defined by Camille Dupont\'s gold-medal double in the 50m and 100m events. The French lung transplant recipient\'s 100m time of 1:09.44 set a new world record in the Women 30–39 category — her third world record in as many years.',
    'Perhaps the most emotional moment of the meet came in the Men 40–49 200m Individual Medley, where Canadian Daniel Morrison touched the wall first to win gold in 2:28.14 — another world record. Morrison, who received a combined pancreas-kidney transplant in 2016, wept on the podium.',
    '"This is for my donor," he said. "Every world record we set is for our donors."',
    'Sixteen nations finished on the podium across all swimming events, with Australia claiming the most medals overall on home soil. South Africa led the individual rankings by gold medals, with van der Berg and teammate Liezel Joubert contributing four gold medals between them.',
    'Eight world records were set or equalled across the programme, with the largest concentration in the 40–49 age groups — a cohort that coaches and analysts say is currently experiencing a generational peak in talent.',
  ],
};

// Default body paragraphs for articles without extended content
function getArticleBody(slug: string, excerpt: string): string[] {
  if (ARTICLE_BODIES[slug]) return ARTICLE_BODIES[slug];
  // Expand excerpt into readable paragraphs
  return [
    excerpt,
    'The world of transplant swimming continues to grow, with athletes from every corner of the globe pushing boundaries and redefining what is possible after organ transplantation. From dedicated training programmes to community-driven clubs, the infrastructure supporting these athletes has never been stronger.',
    'As research into post-transplant exercise physiology advances, the performances recorded at meets like the World Transplant Games and the European Transplant & Dialysis Games provide valuable data for the medical community — and inspiration for the hundreds of thousands of transplant recipients worldwide who are yet to discover sport.',
    'The stories emerging from this community are as varied as the athletes themselves: kidney recipients turning to the water for the first time in their forties; heart transplant survivors completing open-water challenges; lung recipients setting butterfly records. Each story is a testament to the resilience of the human body and the transformative power of sport.',
    'For those looking to join the community, transplant swimming organisations operate in over forty countries worldwide. Most clubs welcome athletes of all abilities and experience levels, with many offering adapted programmes for those in early stages of post-transplant recovery.',
  ];
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = articles.find(a => a.slug === slug);

  if (!article) {
    return (
      <div style={{ backgroundColor: 'var(--navy)', minHeight: '100vh' }}>
        <div className="max-w-3xl mx-auto px-6 py-20">
          <EmptyState
            title="Article not found"
            subtitle="This article may have been moved or removed."
          />
          <div className="mt-8 flex justify-center">
            <Link
              to="/from-the-pool-deck"
              className="font-mono text-xs uppercase tracking-widest px-5 py-2.5 border transition-colors"
              style={{ borderColor: 'var(--navy-light)', color: 'var(--muted-on-dark)' }}
            >
              Back to articles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const related = articles.filter(a => a.slug !== slug).slice(0, 2);
  const bodyParagraphs = getArticleBody(article.slug, article.excerpt);

  return (
    <div style={{ backgroundColor: 'var(--navy)' }}>
      {/* Hero */}
      <section
        className="relative border-b"
        style={{
          backgroundColor: 'var(--navy-mid)',
          borderColor: 'var(--navy-light)',
          ...speedLines,
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
          {/* Back link */}
          <Link
            to="/from-the-pool-deck"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-8 transition-colors"
            style={{ color: 'var(--muted-on-dark)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            From the Pool Deck
          </Link>

          {/* Category */}
          <Eyebrow color="accent">{article.category}</Eyebrow>

          {/* Title */}
          <h1
            className="display mt-4 text-3xl md:text-5xl font-black uppercase leading-tight tracking-tight"
            style={{ color: 'var(--ink-on-dark)' }}
          >
            {article.title}
          </h1>

          {/* Meta */}
          <div
            className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs"
            style={{ color: 'var(--muted-on-dark)' }}
          >
            <span>{article.author}</span>
            <span style={{ color: 'var(--navy-light)' }}>·</span>
            <span>{formatDate(article.date)}</span>
            <span style={{ color: 'var(--navy-light)' }}>·</span>
            <span>{article.readTime} min read</span>
          </div>
        </div>
      </section>

      {/* Body */}
      <article className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        {/* Lead / excerpt */}
        <p
          className="text-lg md:text-xl leading-relaxed font-medium mb-10 pb-10 border-b"
          style={{ color: 'var(--ice)', borderColor: 'var(--navy-light)' }}
        >
          {article.excerpt}
        </p>

        {/* Body paragraphs */}
        <div className="space-y-6">
          {bodyParagraphs.map((para, i) => (
            <p
              key={i}
              className="text-base leading-8"
              style={{ color: 'var(--muted-on-dark)' }}
            >
              {para}
            </p>
          ))}
        </div>

        {/* Pull-quote */}
        <blockquote
          className="my-12 pl-6 border-l-4 py-2"
          style={{ borderColor: 'var(--accent)' }}
        >
          <p
            className="text-xl md:text-2xl font-bold italic leading-snug"
            style={{ color: 'var(--ink-on-dark)' }}
          >
            "Every split matters. Every lane tells a story."
          </p>
          <footer
            className="mt-3 font-mono text-xs uppercase tracking-widest"
            style={{ color: 'var(--accent)' }}
          >
            — Split Second
          </footer>
        </blockquote>
      </article>

      {/* Related articles */}
      <section
        className="border-t"
        style={{ borderColor: 'var(--navy-light)', backgroundColor: 'var(--navy-mid)' }}
      >
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Eyebrow light className="mb-6">Related</Eyebrow>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {related.map(a => (
              <Link
                key={a.id}
                to={`/from-the-pool-deck/${a.slug}`}
                className="block border p-6 transition-colors group"
                style={{ borderColor: 'var(--navy-light)', textDecoration: 'none' }}
              >
                <span
                  className="font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--accent)' }}
                >
                  {a.category}
                </span>
                <h3
                  className="mt-2 font-bold text-lg leading-snug tracking-tight group-hover:underline"
                  style={{ color: 'var(--ink-on-dark)' }}
                >
                  {a.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed line-clamp-2"
                  style={{ color: 'var(--muted-on-dark)' }}
                >
                  {a.excerpt}
                </p>
                <div
                  className="mt-4 flex items-center gap-3 font-mono text-xs"
                  style={{ color: 'var(--muted-on-dark)' }}
                >
                  <span>{a.author}</span>
                  <span>·</span>
                  <span>{a.readTime} min</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
