import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Controller } from "../src/controller";
import { control, post } from "./fixtures";
import * as cards from "../src/native-card";

let controller: Controller;
beforeEach(() => {
  vi.useFakeTimers();
  history.replaceState({}, "", "/home");
  document.body.innerHTML = '<a data-testid="AppTabBar_Profile_Link" href="/viewer">Profile</a>' + post("alice");
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect(20, 100, 40, 40)], { item: () => new DOMRect(20, 100, 40, 40) }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 100, 40, 120));
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false }) });
  controller = new Controller(document, window);
});
afterEach(async () => {
  controller.destroy();
  await vi.advanceTimersByTimeAsync(300);
  vi.useRealTimers();
});

it("reuses verified relations across same-viewer route changes and clears them on viewer changes", async () => {
  const anchor = document.querySelector<HTMLAnchorElement>('article a')!;
  const open = vi.fn(() => document.body.insertAdjacentHTML("beforeend", control("alice")));
  anchor.addEventListener("mouseover", open);
  anchor.addEventListener("mouseout", () => document.querySelector('[data-testid="UserCell"]')?.remove());
  controller.setEnabled(true);
  await vi.advanceTimersByTimeAsync(500);
  history.replaceState({}, "", "/alice/status/123");
  controller.scan();
  await vi.advanceTimersByTimeAsync(500);
  expect(open).toHaveBeenCalledTimes(1);
  document.querySelector('[data-testid="AppTabBar_Profile_Link"]')!.setAttribute("href", "/other");
  controller.scan();
  await vi.advanceTimersByTimeAsync(500);
  expect(open).toHaveBeenCalledTimes(2);
});

it("retries a failed read once with backoff, then stops", async () => {
  const open = vi.fn();
  document.querySelector("article a")!.addEventListener("mouseover", open);
  controller.setEnabled(true);
  await vi.advanceTimersByTimeAsync(9000);
  expect(open).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(25000);
  expect(open).toHaveBeenCalledTimes(2);
});

it("resumes after repeated interruptions without exhausting failure attempts", async () => {
  const read = vi.spyOn(cards, "withNativeCard")
    .mockRejectedValueOnce(new cards.ProbeInterrupted("Paused"))
    .mockRejectedValueOnce(new cards.ProbeInterrupted("Paused"));
  const anchor = document.querySelector<HTMLAnchorElement>("article a")!;
  anchor.addEventListener("mouseover", () => document.body.insertAdjacentHTML("beforeend", control("alice")));
  controller.setEnabled(true);
  await vi.advanceTimersByTimeAsync(4000);
  expect(read).toHaveBeenCalledTimes(3);
  expect(document.querySelector("[data-xfh-root]")!.shadowRoot!.querySelector("button")?.textContent).toBe("关注");
});

it("prechecks a mounted author in the next screen before scrolling", async () => {
  document.body.insertAdjacentHTML("beforeend", post("bob", 2));
  const image = document.querySelector<HTMLElement>('[data-testid="UserAvatar-Container-bob"]')!;
  vi.spyOn(image, "getBoundingClientRect").mockReturnValue(new DOMRect(20, window.innerHeight + 80, 40, 40));
  const alice = document.querySelector<HTMLAnchorElement>("article a")!;
  const bob = image.querySelector("a")!;
  alice.addEventListener("mouseover", () => document.body.insertAdjacentHTML("beforeend", control("alice")));
  alice.addEventListener("mouseout", () => document.querySelector('[data-testid="UserCell"]')?.remove());
  const readBob = vi.fn(() => document.body.insertAdjacentHTML("beforeend", control("bob", "Following", true, 101)));
  bob.addEventListener("mouseover", readBob);
  controller.setEnabled(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(readBob).toHaveBeenCalledOnce();
  expect(document.querySelector("[data-xfh-root]")!.shadowRoot!.querySelector("[data-friend]")?.textContent).toBe("蓝朋友");
});
