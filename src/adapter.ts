import type { Avatar, Evidence, RelationFact, Relationship } from "./model";
import { composedParent, pageQuery, pageRoots } from "./dom";

const RESERVED = new Set([
  "home", "explore", "notifications", "messages", "i", "settings", "search",
  "compose", "login", "logout", "signup", "tos", "privacy", "intent",
]);
const PROFILE = '[data-testid="AppTabBar_Profile_Link"], nav a[aria-label="个人资料"], nav a[aria-label="Profile"]';
const CARD = '[data-testid="UserCell"], [data-testid="HoverCard"]';
const NATIVE = 'button[data-testid], [role="button"][data-testid]';
const STATE_WORDS: Array<[RegExp, Exclude<Relationship, "unknown">]> = [
  [/^(?:Requested|Cancel follow request|已请求|请求已发送|取消关注请求)$/i, "requested"],
  [/^(?:Following|Unfollow|正在关注|已关注|取消关注)$/i, "following"],
  [/^(?:Follow|Follow back|关注|回关)$/i, "not-following"],
];

export function handleFromHref(href: string | null): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, "https://x.com");
    if (url.origin !== "https://x.com") return null;
    const match = /^\/([a-zA-Z0-9_]{1,15})\/?$/.exec(url.pathname);
    const handle = match?.[1].toLowerCase();
    return handle && !RESERVED.has(handle) ? handle : null;
  } catch {
    return null;
  }
}

export function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected || !element.getClientRects().length) return false;
  for (let node: HTMLElement | null = element; node; node = composedParent(node)) {
    const style = getComputedStyle(node);
    if (node.hidden || node.getAttribute("aria-hidden") === "true"
      || style.display === "none" || style.visibility === "hidden"
      || style.visibility === "collapse" || style.opacity === "0") return false;
  }
  return true;
}

export function currentViewer(doc: Document): string | null {
  const handles = new Set([...doc.querySelectorAll<HTMLAnchorElement>(PROFILE)]
    .filter(isVisible).map(link => handleFromHref(link.getAttribute("href"))).filter(Boolean));
  return handles.size === 1 ? [...handles][0]! : null;
}

function cardHandle(card: Element): string | null {
  const handles = new Set([...card.querySelectorAll<HTMLAnchorElement>("a[href]")]
    .map(link => handleFromHref(link.getAttribute("href"))).filter(Boolean));
  return handles.size === 1 ? [...handles][0]! : null;
}

function stateFromWords(words: string): Exclude<Relationship, "unknown"> | null {
  return STATE_WORDS.find(([pattern]) => pattern.test(words.trim()))?.[1] ?? null;
}

export function readControl(control: HTMLElement): Evidence | null {
  if (!control.matches(NATIVE) || !/^\d+-(?:unfollow|follow)$/.test(control.dataset.testid ?? "")
    || !isVisible(control) || control.closest("[data-xfh-root]")
    || control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") return null;

  const label = control.getAttribute("aria-label")?.trim() ?? "";
  const labelled = /^(.+?)\s+@([A-Za-z0-9_]{1,15})$/.exec(label);
  const card = control.closest(CARD);
  const scopeHandle = card ? cardHandle(card) : null;
  const handle = labelled?.[2].toLowerCase() ?? scopeHandle;
  if (!handle || (scopeHandle && scopeHandle !== handle)) return null;

  const text = control.textContent?.trim() ?? "";
  // Pending requests can keep an "unfollow" test id. The visible label takes precedence.
  const labelState = stateFromWords(labelled?.[1] ?? label);
  const textState = stateFromWords(text);
  const relationship = textState === "requested" ? textState : labelState ?? textState;
  if (!relationship) return null;
  if (textState && labelState && textState !== labelState && textState !== "requested") return null;
  if (relationship === "not-following" && !control.dataset.testid?.endsWith("-follow")) return null;
  if (relationship !== "not-following" && !control.dataset.testid?.endsWith("-unfollow")) return null;

  const indicator = card?.querySelector<HTMLElement>('[data-testid="userFollowIndicator"]');
  let followsYou: boolean | null = null;
  if (card && scopeHandle === handle && indicator && isVisible(indicator)) {
    const words = indicator.textContent?.trim() ?? "";
    if (/^(?:Follows you|关注了你|正在关注你|關注你)$/i.test(words)) followsYou = true;
    if (/^(?:Does not follow you|Doesn't follow you|Not following you|未关注你|没有关注你|尚未关注你)$/i.test(words)) {
      followsYou = false;
    }
  }
  return { handle, nativeId: control.dataset.testid!.split("-")[0], relationship, followsYou, control };
}

export function collectEvidence(doc: Document, excluded?: WeakSet<HTMLElement>,
  conflicts = new Set<string>()): Map<string, Evidence> {
  const evidence = new Map<string, Evidence>();
  for (const control of pageQuery<HTMLElement>(doc, NATIVE)) {
    if (excluded?.has(control)) continue;
    const item = readControl(control);
    if (!item) continue;
    const previous = evidence.get(item.handle);
    if (previous && (previous.relationship !== item.relationship
      || previous.nativeId !== item.nativeId
      || (previous.followsYou !== null && item.followsYou !== null && previous.followsYou !== item.followsYou))) {
      conflicts.add(item.handle);
    }
    if (!previous || (previous.followsYou === null && item.followsYou !== null)) evidence.set(item.handle, item);
  }
  for (const handle of conflicts) evidence.delete(handle);
  return evidence;
}

export function quarantineControls(doc: Document, excluded: WeakSet<HTMLElement>): void {
  for (const control of pageQuery<HTMLElement>(doc, NATIVE)) excluded.add(control);
}

export function supportedRoute(pathname: string): boolean {
  return pathname === "/home" || /^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/.test(pathname)
    || /^\/[A-Za-z0-9_]{1,15}\/(?:followers|verified_followers|following)\/?$/.test(pathname)
    || /^\/(?:messages|i\/chat)(?:\/|$)/.test(pathname);
}

export function collectAvatars(doc: Document, pathname: string): Avatar[] {
  if (!supportedRoute(pathname)) return [];
  const chat = /^\/(?:messages|i\/chat)(?:\/|$)/.test(pathname);
  const profileList = /^\/[A-Za-z0-9_]{1,15}\/(?:followers|verified_followers|following)\/?$/.test(pathname);
  const selector = chat
    ? '[data-testid="conversation"], [data-testid="DM_Conversation_Header"]'
    : 'article[data-testid="tweet"]';
  const result: Avatar[] = [];
  if (chat) {
    for (const root of pageRoots(doc)) {
      if (root === doc) continue;
      const rows = root.querySelectorAll<HTMLElement>(
        '[data-dm-message-row], [data-testid="DM_Message_Container"], [data-testid^="message-"]',
      );
      for (const region of rows) {
        if (!region.closest('[data-testid="dm-message-list"]')
          && !region.matches("[data-dm-message-row]")) continue;
        const anchors = [...region.querySelectorAll<HTMLAnchorElement>("a[href]")].filter(anchor => {
          const handle = handleFromHref(anchor.getAttribute("href"));
          if (!handle || anchor.getAttribute("href")?.includes("/i/chat/")) return false;
          const avatar = anchor.closest<HTMLElement>(
            '[data-testid^="UserAvatar-Container-"], [data-testid="DM_Conversation_Avatar"]',
          );
          let slot = anchor.parentElement;
          while (slot && slot !== region && slot.style.gridArea !== "avatar") slot = slot.parentElement;
          return Boolean(avatar || (slot !== region && slot?.style.gridArea === "avatar"));
        });
        if (anchors.length !== 1) continue;
        const anchor = anchors[0];
        const handle = handleFromHref(anchor.getAttribute("href"));
        if (handle && isVisible(anchor)) {
          const image = anchor.querySelector<HTMLElement>("img")?.parentElement ?? anchor;
          result.push({ handle, anchor, image, region });
        }
      }
    }
  }
  if (profileList) {
    for (const region of pageQuery<HTMLElement>(doc, '[data-testid="UserCell"]')) {
      if (region.parentElement?.closest('[data-testid="UserCell"]')) continue;
      const avatars = [...region.querySelectorAll<HTMLElement>('[data-testid^="UserAvatar-Container-"]')]
        .filter(avatar => avatar.closest('[data-testid="UserCell"]') === region);
      if (avatars.length !== 1) continue;
      const image = avatars[0];
      if (!isVisible(image)) continue;
      const anchor = image.querySelector<HTMLAnchorElement>("a[href]");
      if (!anchor) continue;
      const handle = handleFromHref(anchor.getAttribute("href"));
      if (!handle || image.dataset.testid?.slice("UserAvatar-Container-".length).toLowerCase() !== handle) {
        continue;
      }
      result.push({ handle, anchor, image, region });
    }
    return result;
  }
  for (const region of doc.querySelectorAll<HTMLElement>(selector)) {
    if (region.parentElement?.closest(selector)) continue;
    const avatars = [...region.querySelectorAll<HTMLElement>('[data-testid^="UserAvatar-Container-"]')]
      .filter(avatar => avatar.closest(selector) === region);
    // A conversation must expose one unambiguous profile link. Conversation ids are not user ids.
    if (chat && avatars.length !== 1) continue;
    const image = avatars[0];
    if (!image || !isVisible(image)) continue;
    const anchor = image.querySelector<HTMLAnchorElement>("a[href]");
    if (!anchor) continue;
    const handle = handleFromHref(anchor.getAttribute("href"));
    if (!handle || image.dataset.testid?.slice("UserAvatar-Container-".length).toLowerCase() !== handle) continue;
    if (chat && region.querySelector('a[href*="/i/chat/g"]')) continue;
    result.push({ handle, anchor, image, region });
  }
  return result;
}

function parseBoolean(value: string | null): boolean | null {
  if (value === "true" || value === "yes" || value === "1") return true;
  if (value === "false" || value === "no" || value === "0") return false;
  return null;
}

/**
 * Reads only explicit, page-owned relationship fields. Missing fields stay unknown;
 * ordinary visible text is deliberately not treated as relationship evidence.
 */
export function collectRelationFacts(
  avatars: Avatar[],
  evidence: Map<string, Evidence>,
  now = Date.now(),
): Map<string, RelationFact> {
  const facts = new Map<string, RelationFact>();
  for (const avatar of avatars) {
    const explicit = [avatar.image, avatar.anchor, avatar.region]
      .find(node => node.dataset.xfhRelationship || node.dataset.xfhFollowsYou || node.dataset.xfhBlue)
      ?? avatar.region;
    const known = evidence.get(avatar.handle);
    const relationshipValue = explicit.dataset.xfhRelationship;
    const relationship: Relationship = relationshipValue === "following"
      || relationshipValue === "not-following" || relationshipValue === "requested"
      ? relationshipValue : known?.relationship ?? "unknown";
    const followsYou = parseBoolean(explicit.dataset.xfhFollowsYou ?? null)
      ?? known?.followsYou ?? null;
    const blue = parseBoolean(explicit.dataset.xfhBlue ?? null);
    if (relationship === "unknown" && followsYou === null && blue === null) continue;
    facts.set(avatar.handle, {
      handle: avatar.handle, relationship, followsYou, blue,
      source: known ? "native-card" : "page",
      observedAt: now, control: known?.control, nativeId: known?.nativeId,
    });
  }
  return facts;
}

export function nativeAlerts(doc: Document): Map<Element, string> {
  return new Map(pageQuery<HTMLElement>(doc, '[role="alert"], [role="status"], [data-testid="toast"], [data-testid="toastContainer"]')
    .filter(isVisible).map(node => [node, node.textContent?.trim() ?? ""]));
}

export function isRateLimitMessage(text: string): boolean {
  if (/(?:发帖|帖子|私信|消息|搜索|posts?|tweets?|messages?|search).*(?:limit|限制|上限)/i.test(text)) return false;
  return /(?:rate.?limit(?:ed| exceeded)?|too many requests|速度限制|操作过于频繁|关注.{0,12}(?:限制|上限)|follow.{0,20}limit)/i.test(text);
}

/** Only count the badge attached to this author's name, never a quoted post's badge. */
export function hasBlueBadge(avatar: Avatar): boolean {
  for (const name of avatar.region.querySelectorAll<HTMLElement>('[data-testid="User-Name"]')) {
    const article = name.closest('article[data-testid="tweet"]');
    if (article && article !== avatar.region) continue;
    for (const link of name.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      if (handleFromHref(link.getAttribute("href")) !== avatar.handle) continue;
      for (const badge of link.querySelectorAll<SVGElement>('svg[data-testid="icon-verified"]')) {
        const style = getComputedStyle(badge);
        const color = style.fill.toLowerCase() === "currentcolor" || !style.fill ? style.color : style.fill;
        if (/^rgba?\(\s*29,\s*155,\s*240\s*(?:,\s*1(?:\.0+)?\s*)?\)$/.test(color)) return true;
      }
    }
  }
  return false;
}
