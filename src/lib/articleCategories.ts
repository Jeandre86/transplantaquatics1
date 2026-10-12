export const ARTICLE_CATEGORIES = [
  'Athlete Stories',
  'Training',
  'Nutrition',
  'Community',
  'Competition',
  'News',
  'Recovery',
  'Lifestyle',
] as const;

export function articleCategoryKey(value: string) {
  const key = value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return key === 'athlete story' ? 'athlete stories' : key;
}
