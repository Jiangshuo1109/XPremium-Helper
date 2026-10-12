export const RELEASES_URL = "https://github.com/Jiangshuo1109/XPremium-Helper/releases";
const API = "https://api.github.com/repos/Jiangshuo1109/XPremium-Helper/releases?per_page=100";
const INTERVAL = 6 * 60 * 60 * 1000;
export interface UpdateResult { checkedAt: number; version: string | null; error?: string }

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
    if (!force && updateCheck && age >= 0 && age < INTERVAL) return updateCheck as UpdateResult;
    let result: UpdateResult;
    try {
      const response = await fetch(API, {
        credentials: "omit", referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
      result = { checkedAt: Date.now(), version: latestRelease(await response.json()) };
    } catch {
      result = { checkedAt: Date.now(), version: null, error: "检查失败，请稍后重试" };
    }
    await chrome.storage.local.set({ updateCheck: result });
    return result;
  })().finally(() => { pending = null; });
  return pending;
}
