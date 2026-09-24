export interface Club {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  memberCount: number;
  foundedYear: number;
  description: string;
  athleteIds: string[];
  city: string;
}

export const clubs: Club[] = [
  {
    id: 'cape-town-aquatics',
    name: 'Cape Town Aquatics',
    country: 'South Africa',
    countryCode: 'ZA',
    city: 'Cape Town',
    memberCount: 34,
    foundedYear: 2014,
    description:
      'One of the most successful transplant swimming clubs in the southern hemisphere. Based at the Cape Town International Aquatics Centre, the club is known for its high-performance training environment and community outreach work across the Western Cape.',
    athleteIds: ['michael-van-der-berg'],
  },
  {
    id: 'manchester-aquatics',
    name: 'Manchester Aquatics',
    country: 'United Kingdom',
    countryCode: 'GB',
    city: 'Manchester',
    memberCount: 48,
    foundedYear: 2010,
    description:
      'Founded in 2010 by a group of transplant recipients who met during rehabilitation, Manchester Aquatics has grown into a nationally recognised programme. The club runs weekly group sessions and an annual open invitational meet that draws competitors from across Europe.',
    athleteIds: ['james-holloway'],
  },
  {
    id: 'sydney-transplant-sc',
    name: 'Sydney Transplant SC',
    country: 'Australia',
    countryCode: 'AU',
    city: 'Sydney',
    memberCount: 41,
    foundedYear: 2011,
    description:
      'Sydney Transplant SC operates out of the Sydney Olympic Park Aquatic Centre and is the largest transplant swim club in Australia. The club fields teams at the Australian Transplant Games each year and provides mentoring for athletes newly entering the sport post-transplant.',
    athleteIds: ['peter-nguyen'],
  },
  {
    id: 'edinburgh-city-swim',
    name: 'Edinburgh City Swim Club',
    country: 'United Kingdom',
    countryCode: 'GB',
    city: 'Edinburgh',
    memberCount: 29,
    foundedYear: 2015,
    description:
      'Scotland\'s premier transplant swimming club, operating out of the Royal Commonwealth Pool. The club places a strong emphasis on athlete welfare and runs a peer-mentoring programme connecting new members with experienced swimmers.',
    athleteIds: ['sarah-brennan'],
  },
  {
    id: 'toulouse-natation',
    name: 'Toulouse Natation',
    country: 'France',
    countryCode: 'FR',
    city: 'Toulouse',
    memberCount: 22,
    foundedYear: 2017,
    description:
      'A progressive French club with a strong butterfly and medley tradition. Toulouse Natation was founded by a group of lung and heart transplant recipients who sought a structured training environment adapted to post-transplant physiology.',
    athleteIds: ['camille-dupont'],
  },
  {
    id: 'sc-magdeburg-masters',
    name: 'SC Magdeburg Masters',
    country: 'Germany',
    countryCode: 'DE',
    city: 'Magdeburg',
    memberCount: 37,
    foundedYear: 2008,
    description:
      'One of Germany\'s oldest transplant swimming clubs, SC Magdeburg Masters has accumulated more medals at the European Transplant & Dialysis Games than any other German club. The club trains six days a week and regularly hosts international training camps.',
    athleteIds: ['hans-mueller'],
  },
  {
    id: 'clube-nautico-minas',
    name: 'Clube Náutico Minas',
    country: 'Brazil',
    countryCode: 'BR',
    city: 'Belo Horizonte',
    memberCount: 19,
    foundedYear: 2018,
    description:
      'The leading transplant swimming club in South America, Clube Náutico Minas has produced the fastest female transplant swimmers on the continent. The club is affiliated with the Brazilian Transplant Sport Federation and provides subsidised training for athletes from lower-income backgrounds.',
    athleteIds: ['ana-silva'],
  },
  {
    id: 'zpc-amersfoort',
    name: 'ZPC Amersfoort',
    country: 'Netherlands',
    countryCode: 'NL',
    city: 'Amersfoort',
    memberCount: 31,
    foundedYear: 2006,
    description:
      'The oldest dedicated transplant swimming club in the Benelux region. ZPC Amersfoort has a storied history at international meets and mentors other clubs across the Netherlands in establishing transplant sport programmes.',
    athleteIds: ['pieter-de-vries'],
  },
];
