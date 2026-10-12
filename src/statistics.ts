import type { PageStateRecord } from "./model";

export function summarize(records: PageStateRecord[], viewer: string | null) {
  const users = [...new Map(records.filter(r => r.handle !== viewer)
    .map(r => [r.handle.toLowerCase(), r])).values()];
  return {
    total: users.length,
    following: users.filter(r => r.relationship === "following").length,
    followers: users.filter(r => r.followsYou === true).length,
    followBack: users.filter(r => r.relationship === "not-following" && r.followsYou === true).length,
    mutual: users.filter(r => r.relationship === "following" && r.followsYou === true).length,
    unilateral: users.filter(r => r.relationship === "following" && r.followsYou === false).length,
    unknown: users.filter(r => r.relationship === "unknown" || r.followsYou === null).length,
    requested: users.filter(r => r.relationship === "requested").length,
    blue: users.filter(r => r.blue === true).length,
  };
}
