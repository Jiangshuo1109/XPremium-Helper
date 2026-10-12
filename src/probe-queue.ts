import { hasBlueBadge } from "./adapter";
import type { Avatar } from "./model";

export interface ProbeAttempt { count: number; after: number; prefetched?: boolean }

/** Queue only mounted authors, preferring this screen and then the next one. */
export function planProbes(avatars: Avatar[], viewer: string, height: number): Avatar[] {
  const ranked = avatars.filter(avatar => avatar.handle !== viewer && hasBlueBadge(avatar))
    .map(avatar => ({ avatar, rect: avatar.image.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width >= 28 && rect.bottom > 0)
    .sort((a, b) => Math.max(0, a.rect.top - height) - Math.max(0, b.rect.top - height));
  const seen = new Set<string>();
  return ranked.filter(({ avatar }) => {
    if (seen.has(avatar.handle)) return false;
    seen.add(avatar.handle);
    return true;
  }).slice(0, 20).map(item => item.avatar);
}

export function mayProbe(attempt: ProbeAttempt | undefined, visible: boolean, now: number): boolean {
  return (attempt?.count ?? 0) < 2 && (attempt?.after ?? 0) <= now
    && (visible || !attempt?.prefetched);
}
