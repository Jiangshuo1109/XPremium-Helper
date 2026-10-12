import { afterEach, expect, it, vi } from "vitest";
import { summarize } from "../src/statistics";
import { checkUpdate, latestRelease, newer } from "../src/updates";
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
  fetcher.mockRejectedValueOnce(new Error("offline"));
  const failed = await checkUpdate(true);
  expect(failed.error).toBeTruthy();
  expect(failed.version).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
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
