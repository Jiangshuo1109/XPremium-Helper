import { beforeEach, expect, it, vi } from "vitest";
import { collectAvatars } from "../src/adapter";
import { mayProbe, planProbes } from "../src/probe-queue";
import { post } from "./fixtures";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 100, 40, 40));
});
it("deduplicates loaded users and caps the queue at twenty", () => {
  document.body.innerHTML = post("viewer") + post("user0")
    + Array.from({ length: 30 }, (_, i) => post(`user${i}`)).join("");
  const queue = planProbes(collectAvatars(document, "/home"), "viewer", 800);
  expect(queue).toHaveLength(20);
  expect(new Set(queue.map(item => item.handle)).size).toBe(20);
  expect(queue.some(item => item.handle === "viewer")).toBe(false);
});
it("gives visible authors priority over mounted offscreen authors", () => {
  document.body.innerHTML = post("alice") + post("bob");
  const avatars = collectAvatars(document, "/home");
  Object.defineProperty(avatars[0].image, "getBoundingClientRect", {
    value: () => new DOMRect(20, 900, 40, 40),
    configurable: true,
  });
  expect(planProbes(avatars, "viewer", 800).map(item => item.handle)).toEqual(["bob", "alice"]);
});
it("allows a failed prefetch to try normally when the author becomes visible", () => {
  const attempt = { count: 0, after: 750, prefetched: true };
  expect(mayProbe(attempt, false, 1000)).toBe(false);
  expect(mayProbe(attempt, true, 1000)).toBe(true);
  expect(mayProbe({ count: 2, after: 0 }, true, 1000)).toBe(false);
});
