export type AboutLink = { label: string; href: string };

export type AboutSection = {
  slug: string;
  title: string;
  description: string;
  paragraphs: string[];
  badge?: string;
  external_label?: string;
  external_href?: string;
  links: AboutLink[];
};

export const DEFAULT_ABOUT_SECTIONS: AboutSection[] = [
  {
    slug: 'overview', title: 'Different journeys. Same water.',
    description: 'A shared place to discover transplant swimming, its athletes and the community around the sport.',
    paragraphs: [], links: [],
  },
  {
    slug: 'our-story', title: 'Our Story',
    description: 'One place to follow transplant swimming and the people who make it.',
    paragraphs: [
      'Transplant Aquatics brings the sport into one shared space. Athlete profiles, competition results, rankings, records and stories help swimmers and supporters follow performances across countries and Games.',
      'The idea is simple: make transplant swimming easier to discover, understand and celebrate, while keeping the athletes and their achievements at the centre.',
    ], links: [],
  },
  {
    slug: 'what-we-do', title: 'What We Do',
    description: 'Explore the sport, follow performances and share the stories behind them.',
    paragraphs: [
      'Transplant Aquatics is a digital home for transplant swimming. It brings together athlete profiles, results, records, rankings, country directories and stories from the pool deck.',
      'Athletes can build a profile and submit results for review. Visitors can explore performances, compare times and learn more about the community around the sport.',
    ], links: [],
  },
  {
    slug: 'transplant-swimming-and-the-games', title: 'Transplant Swimming and the Games',
    description: 'Swimming has been part of the World Transplant Games since the first Games in 1978.',
    paragraphs: [
      'Transplant swimming includes pool and open-water competition. Events use the familiar strokes—freestyle, backstroke, breaststroke, butterfly and individual medley—with distances and formats set by each Games programme.',
      'The World Transplant Games Federation describes swimming as one of the most popular sports at the Games. For current event formats, eligibility and official rules, check the Federation’s published guidance.',
    ], external_label: 'Swimming at the World Transplant Games', external_href: 'https://wtgf.org/swimming/', links: [],
  },
  {
    slug: 'community-and-clubs', title: 'Community and Clubs',
    description: 'Find swimmers, clubs and connections across the transplant aquatics community.',
    paragraphs: [
      'A local swimming club can offer coached sessions, help with technique and a welcoming place to train. The Athletes directory and club listings on this site are designed to help people find connections across the community.',
      'If you are new to transplant swimming, start by exploring athlete profiles and club listings, then get in touch with a club that suits your location and experience.',
    ], links: [{ label: 'Browse athletes', href: '/athletes' }, { label: 'Explore clubs', href: '/clubs' }],
  },
  {
    slug: 'partners', title: 'Partners',
    description: 'We welcome organisations that want to support transplant swimming.',
    paragraphs: ['Partner information is being prepared. This page will introduce confirmed partners and explain how they support the transplant swimming community.'],
    badge: 'Partner details to be announced', links: [],
  },
  {
    slug: 'contact-us', title: 'Contact Us',
    description: 'Choose the route that best matches what you need.',
    paragraphs: ['A public contact email or message form has not been configured for this site yet. In the meantime, use the relevant site page below to get started.'],
    links: [{ label: 'Join Transplant Aquatics', href: '/join' }, { label: 'Submit a result', href: '/submit' }, { label: 'Manage your profile', href: '/profile' }],
  },
];
