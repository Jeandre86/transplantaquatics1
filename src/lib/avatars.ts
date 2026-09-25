const avatarKey = (firstName: string, lastName: string) =>
  `transplant-aquatics-avatar:${`${firstName} ${lastName}`.trim().toLowerCase()}`;

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
