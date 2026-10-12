export const RELEASES_URL = "https://github.com/Jiangshuo1109/XPremium-Helper/releases";
const API = "https://api.github.com/repos/Jiangshuo1109/XPremium-Helper/releases?per_page=100";
const INTERVAL = 6 * 60 * 60 * 1000;
const FAILURE_INTERVAL = 60 * 1000;
export interface UpdateResult { checkedAt: number; version: string | null; error?: string; source?: "api" | "feed" }

export function feedRelease(xml: string): string | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const ns = "http://www.w3.org/2005/Atom";
  if (doc.querySelector("parsererror") || doc.documentElement.localName !== "feed"
    || doc.documentElement.namespaceURI !== ns) throw new Error("版本订阅格式无效");
  const links = [...doc.documentElement.children].filter(el => el.localName === "link");
  if (!links.some(el => el.getAttribute("rel") === "self"
    && el.getAttribute("href") === `${RELEASES_URL}.atom`)) throw new Error("版本订阅来源无效");
  const releases = [...doc.getElementsByTagNameNS(ns, "entry")].flatMap(entry =>
    [...entry.getElementsByTagNameNS(ns, "link")].flatMap(link => {
      const href = link.getAttribute("href") ?? "";
      if (link.getAttribute("rel") !== "alternate" || !href.startsWith(`${RELEASES_URL}/tag/`)) return [];
      return [{ draft: false, tag_name: href.slice(`${RELEASES_URL}/tag/`.length) }];
    }));
  return latestRelease(releases);
}

async function request(url: string): Promise<Response> {
  const response = await fetch(url, {
    credentials: "omit", referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: url.endsWith(".atom") ? "application/atom+xml" : "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

function failureReason(error: unknown): string {
  if (error instanceof Error || error instanceof DOMException) {
    if (error.message === "HTTP 403" || error.message === "HTTP 429") return "GitHub 限流或拒绝访问";
    if (error.name === "TimeoutError" || error.name === "AbortError") return "请求超时";
    if (error.message.startsWith("HTTP ")) return error.message;
    if (error.message.startsWith("版本")) return error.message;
  }
  return "网络连接失败";
}

export function newer(a: string, b: string): boolean {
  if (![a, b].every(v => /^\d+\.\d+\.\d+$/.test(v))) return false;
  const left = a.split(".").map(Number), right = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i];
  return false;
}

export function latestRelease(data: unknown): string | null {
  if (!Array.isArray(data)) throw new Error("版本响应无效");
  let latest: string | null = null;
  for (const item of data) {
    if (!item || typeof item !== "object" || item.draft !== false
      || typeof item.tag_name !== "string") continue;
    const match = /^v(\d+\.\d+\.\d+)(?:-preview)?$/.exec(item.tag_name);
    if (match && (!latest || newer(match[1], latest))) latest = match[1];
  }
  return latest;
}

let pending: Promise<UpdateResult> | null = null;
export function checkUpdate(force = false): Promise<UpdateResult> {
  if (pending) return pending;
  pending = (async () => {
    const data = await chrome.storage.local.get("updateCheck");
    const candidate = data.updateCheck as Partial<UpdateResult> | undefined;
    const updateCheck = candidate && typeof candidate.checkedAt === "number"
      && (candidate.version === null || typeof candidate.version === "string")
      ? candidate as UpdateResult : undefined;
    const age = Date.now() - (updateCheck?.checkedAt ?? 0);
    if (!force && updateCheck && age >= 0
      && age < (updateCheck.error ? FAILURE_INTERVAL : INTERVAL)) return updateCheck;
    let result: UpdateResult;
    try {
      const response = await request(API);
      result = { checkedAt: Date.now(), version: latestRelease(await response.json()), source: "api" };
    } catch (apiError) {
      try {
        const response = await request(`${RELEASES_URL}.atom`);
        result = { checkedAt: Date.now(), version: feedRelease(await response.text()), source: "feed" };
      } catch (feedError) {
        result = { checkedAt: Date.now(), version: null,
          error: `检查失败：接口${failureReason(apiError)}；订阅${failureReason(feedError)}` };
      }
    }
    await chrome.storage.local.set({ updateCheck: result });
    return result;
  })().finally(() => { pending = null; });
  return pending;
}
