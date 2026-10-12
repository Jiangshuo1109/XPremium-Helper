import { afterEach, expect, it, vi } from "vitest";
import { summarize } from "../src/statistics";
import { checkUpdate, feedRelease, latestRelease, newer, RELEASES_URL } from "../src/updates";
import type { PageStateRecord } from "../src/model";
afterEach(() => vi.unstubAllGlobals());

it("deduplicates page accounts, excludes self and separates unknown inbound from nonfollowers", () => {
  const record = (handle: string, relationship: PageStateRecord["relationship"],
    followsYou: boolean | null): PageStateRecord =>
    ({ handle, relationship, followsYou, blue: true, source: "native-card", observedAt: 1 });
  expect(summarize([
    record("alice", "following", true), record("alice", "following", true),
    record("bob", "following", null), record("carol", "following", false),
    record("dave", "not-following", true), record("viewer", "following", true),
    record("pending", "requested", null), record("unknown", "unknown", null),
  ], "viewer")).toEqual({
    total: 6, following: 3, followers: 2, followBack: 1, mutual: 1,
    unilateral: 1, unknown: 3, requested: 1, blue: 6,
  });
});

it("caches update checks, bypasses cache manually and reports network failure honestly", async () => {
  const cache: Record<string, unknown> = {};
  vi.stubGlobal("chrome", { storage: { local: {
    get: async () => cache,
    set: async (value: Record<string, unknown>) => Object.assign(cache, value),
  } } });
  const fetcher = vi.fn().mockResolvedValue({ ok: true,
    json: async () => [{ draft: false, tag_name: "v0.2.2-preview" }] });
  vi.stubGlobal("fetch", fetcher);
  expect((await checkUpdate()).version).toBe("0.2.2");
  await checkUpdate();
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockRejectedValue(new Error("offline"));
  const failed = await checkUpdate(true);
  expect(failed.error).toBeTruthy();
  expect(failed.version).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(3);
  await checkUpdate();
  expect(fetcher).toHaveBeenCalledTimes(3);
  cache.updateCheck = { ...failed, checkedAt: Date.now() - 61_000 };
  await checkUpdate();
  expect(fetcher).toHaveBeenCalledTimes(5);
});

const feed = (tag: string) => `<feed xmlns="http://www.w3.org/2005/Atom">
<link rel="self" href="${RELEASES_URL}.atom"/>
<entry><link rel="alternate" href="${RELEASES_URL}/tag/${tag}"/></entry></feed>`;

it("uses the public release feed when the API is rate limited", async () => {
  vi.stubGlobal("chrome", { storage: { local: { get: async () => ({}), set: vi.fn() } } });
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 403 })
    .mockResolvedValueOnce({ ok: true, text: async () => feed("v0.2.3-preview") });
  vi.stubGlobal("fetch", fetcher);
  const result = await checkUpdate(true);
  expect(result).toMatchObject({ version: "0.2.3", source: "feed" });
  expect(result.error).toBeUndefined();
  expect(fetcher.mock.calls[1][0]).toBe(`${RELEASES_URL}.atom`);
  expect(fetcher.mock.calls[1][1].credentials).toBe("omit");
});

it("rejects HTML errors, malformed feeds and foreign release links", () => {
  expect(() => feedRelease("<html>error</html>")).toThrow();
  expect(() => feedRelease("<feed")).toThrow();
  expect(() => feedRelease(feed("v0.2.3").replaceAll(RELEASES_URL, "https://example.org"))).toThrow();
  expect(feedRelease(feed("v0.2.3").replace(`${RELEASES_URL}/tag/`, "https://example.org/tag/"))).toBeNull();
  expect(feedRelease(feed("arbitrary"))).toBeNull();
});

it("reports both failures and shares a pending request", async () => {
  vi.stubGlobal("chrome", { storage: { local: { get: async () => ({}), set: vi.fn() } } });
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 })
    .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
  vi.stubGlobal("fetch", fetcher);
  const first = checkUpdate(true);
  expect(checkUpdate(true)).toBe(first);
  expect((await first).error).toBe("检查失败：接口GitHub 限流或拒绝访问；订阅请求超时");
});

it("compares versions numerically and ignores draft and malformed releases", () => {
  expect(newer("0.10.0", "0.9.9")).toBe(true);
  expect(newer("0.2.1", "0.2.1")).toBe(false);
  expect(newer("bad", "0.2.1")).toBe(false);
  expect(latestRelease([
    { draft: false, tag_name: "v0.2.1-preview" },
    { draft: false, tag_name: "v0.10.0-preview" },
    { draft: true, tag_name: "v9.0.0" }, { draft: false, tag_name: "arbitrary" },
  ])).toBe("0.10.0");
  expect(latestRelease([])).toBeNull();
  expect(() => latestRelease({ message: "rate limited" })).toThrow();
});
