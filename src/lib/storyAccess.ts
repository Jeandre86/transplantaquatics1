export const FREE_MEMBER_STORIES_PER_MONTH = 3;

function storageKey(): string {
  const now = new Date();
  return `transplant-aquatics-member-stories:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMemberStoryReads(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function recordMemberStoryRead(slug: string): string[] {
  const current = getMemberStoryReads();
  if (current.includes(slug) || current.length >= FREE_MEMBER_STORIES_PER_MONTH) return current;
  const next = [...current, slug];
  try {
    localStorage.setItem(storageKey(), JSON.stringify(next));
  } catch {
    // Keep the current page readable if storage is unavailable.
  }
  return next;
}

export function getRemainingMemberStoryReads(): number {
  return Math.max(0, FREE_MEMBER_STORIES_PER_MONTH - getMemberStoryReads().length);
}
