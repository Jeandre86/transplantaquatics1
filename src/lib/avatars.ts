const avatarKey = (firstName: string, lastName: string) =>
  `transplant-aquatics-avatar:${`${firstName} ${lastName}`.trim().toLowerCase()}`;
const bannerKey = (firstName: string, lastName: string) =>
  `transplant-aquatics-banner:${`${firstName} ${lastName}`.trim().toLowerCase()}`;
const socialsKey = (firstName: string, lastName: string) =>
  `transplant-aquatics-socials:${`${firstName} ${lastName}`.trim().toLowerCase()}`;

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
}

export function getSavedAvatar(firstName: string, lastName: string): string | null {
  try {
    return localStorage.getItem(avatarKey(firstName, lastName));
  } catch {
    return null;
  }
}

export function saveAvatar(firstName: string, lastName: string, image: string): void {
  try {
    localStorage.setItem(avatarKey(firstName, lastName), image);
  } catch {
    // Keep the current session usable if browser storage is unavailable or full.
  }
}

export function getSavedBanner(firstName: string, lastName: string): string | null {
  try {
    return localStorage.getItem(bannerKey(firstName, lastName));
  } catch {
    return null;
  }
}

export function saveBanner(firstName: string, lastName: string, image: string): void {
  try {
    localStorage.setItem(bannerKey(firstName, lastName), image);
  } catch {
    // Keep the profile usable when browser storage is unavailable or full.
  }
}

export function getSavedSocials(firstName: string, lastName: string): SocialLinks {
  try {
    return JSON.parse(localStorage.getItem(socialsKey(firstName, lastName)) ?? '{}') as SocialLinks;
  } catch {
    return {};
  }
}

export function saveSocials(firstName: string, lastName: string, socials: SocialLinks): void {
  try {
    localStorage.setItem(socialsKey(firstName, lastName), JSON.stringify(socials));
  } catch {
    // Keep profile editing usable when browser storage is unavailable or full.
  }
}
