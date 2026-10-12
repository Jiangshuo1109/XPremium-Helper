export type Relationship = "unknown" | "not-following" | "following" | "requested";
export type RelationshipAction = "follow" | "unfollow";
export type RelationSource = "page" | "native-card";

export interface Evidence {
  handle: string;
  nativeId: string;
  relationship: Exclude<Relationship, "unknown">;
  followsYou: boolean | null;
  control: HTMLElement;
}

export interface RelationFact {
  handle: string;
  relationship: Relationship;
  followsYou: boolean | null;
  blue: boolean | null;
  source: RelationSource;
  observedAt: number;
  control?: HTMLElement;
  nativeId?: string;
}

export interface PageStateRecord {
  handle: string;
  relationship: Relationship;
  followsYou: boolean | null;
  blue: boolean | null;
  source: RelationSource;
  observedAt: number;
  error?: string;
}

export interface PageState {
  viewer: string | null;
  route: string;
  discovered: number;
  verified: number;
  pending: number;
  failed: number;
  paused: boolean;
  records: PageStateRecord[];
  updatedAt: number;
}

export interface Avatar {
  handle: string;
  anchor: HTMLAnchorElement;
  image: HTMLElement;
  region: HTMLElement;
}

export function buttonLabel(evidence: Evidence): string {
  if (evidence.relationship === "following" && evidence.followsYou !== true) return "取关";
  return evidence.followsYou === true ? "回关" : "关注";
}

export function availableAction(viewer: string | null, evidence: Evidence | undefined): RelationshipAction | null {
  if (!viewer || !evidence || viewer === evidence.handle) return null;
  if (evidence.relationship === "not-following") return "follow";
  if (evidence.relationship === "following" && evidence.followsYou !== true) return "unfollow";
  return null;
}

export function canFollow(viewer: string | null, evidence: Evidence | undefined): boolean {
  return availableAction(viewer, evidence) === "follow";
}

export function isMutual(viewer: string | null, evidence: Evidence | undefined): boolean {
  return !!viewer && !!evidence && viewer !== evidence.handle
    && evidence.relationship === "following" && evidence.followsYou === true;
}

export function actionFromRelation(
  viewer: string | null,
  relation: RelationFact | undefined,
): RelationshipAction | null {
  if (!viewer || !relation || viewer === relation.handle) return null;
  if (relation.relationship === "not-following") return "follow";
  if (relation.relationship === "following" && relation.followsYou !== true) return "unfollow";
  return null;
}
