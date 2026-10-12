export const FOLLOW_COOLDOWN_MS = 30 * 60 * 1000;

export function mergeCooldown(current: unknown, candidate: number): number {
  return Math.max(typeof current === "number" && Number.isFinite(current) ? current : 0, candidate);
}

export function cooldownActive(until: number, now = Date.now()): boolean {
  return Number.isFinite(until) && until > now;
}

export function formatRemaining(until: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
