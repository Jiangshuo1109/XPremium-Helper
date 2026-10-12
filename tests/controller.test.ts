import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Controller } from "../src/controller";
import { control, fixture, post } from "./fixtures";

let controller: Controller;
beforeEach(() => {
  vi.useFakeTimers();
  history.replaceState({}, "", "/home");
  document.documentElement.innerHTML = fixture().replace(/<!doctype html>|<\/?html[^>]*>/g, "");
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { left: 20, top: 60, bottom: this.tagName === "ARTICLE" ? 240 : 100,
      right: 60, width: 40, height: 40, x: 20, y: 60, toJSON: () => ({}) };
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true, value: () => ({ matches: false }),
  });
  controller = new Controller(document, window, false);
  controller.setEnabled(true);
});
afterEach(() => {
  controller.destroy();
  vi.useRealTimers();
});

const buttons = () => [...document.querySelector("[data-xfh-root]")!.shadowRoot!
  .querySelectorAll<HTMLButtonElement>("button")];

it("injects only known actionable users and stays idempotent", () => {
  expect(buttons().map(item => item.dataset.handle)).toEqual(["alice", "bob", "carol", "alice"]);
  expect(buttons().find(item => item.dataset.handle === "bob")!.textContent).toBe("回关");
  controller.scan();
  controller.scan();
  expect(buttons()).toHaveLength(4);
  expect(document.querySelectorAll("[data-xfh-root]")).toHaveLength(1);
});

it("retains verified relations when the user closes a native card", () => {
  document.querySelector('[aria-label="Follow @alice"]')!.remove();
  controller.scan();
  expect(buttons().map(item => item.dataset.handle)).toEqual(["alice", "bob", "carol", "alice"]);
});

it("does not duplicate native controls in the same region", () => {
  document.querySelector("article")!.insertAdjacentHTML("beforeend", control("alice"));
  controller.scan();
  expect(buttons().filter(button => button.dataset.handle === "alice")).toHaveLength(1);
});

it("resolves added rows, removed rows and reused anchors", async () => {
  document.querySelector("main")!.insertAdjacentHTML("beforeend", post("bob", 9));
  await vi.advanceTimersByTimeAsync(200);
  expect(buttons()).toHaveLength(5);
  const avatar = document.querySelector('[data-testid="UserAvatar-Container-alice"]')!;
  avatar.setAttribute("data-testid", "UserAvatar-Container-unknown");
  avatar.querySelector("a")!.setAttribute("href", "/unknown");
  controller.scan();
  expect(buttons()).toHaveLength(4);
  document.querySelectorAll("article")[1].remove();
  controller.scan();
  expect(buttons()).toHaveLength(3);
});

it("locks duplicate user actions and hides all copies on completion", async () => {
  const native = document.querySelector<HTMLButtonElement>('[aria-label="Follow @alice"]')!;
  const click = vi.spyOn(native, "click").mockImplementation(() => {
    native.dataset.testid = "100-unfollow";
    native.textContent = "Following";
    native.setAttribute("aria-label", "Following @alice");
  });
  const copies = buttons().filter(button => button.dataset.handle === "alice");
  copies[0].click();
  copies[1].click();
  expect(click).toHaveBeenCalledTimes(1);
  expect(copies.every(button => button.disabled)).toBe(true);
  expect(copies.every(button => button.textContent === "确认中")).toBe(true);
  await vi.advanceTimersByTimeAsync(1500);
  expect(buttons().filter(button => button.dataset.handle === "alice")
    .every(button => button.textContent === "取关")).toBe(true);
});

it("replaces follow-back buttons with a friend label after native confirmation", async () => {
  const native = document.querySelector<HTMLButtonElement>('[aria-label="Follow @bob"]')!;
  native.addEventListener("click", () => {
    native.dataset.testid = "101-unfollow";
    native.textContent = "Following";
    native.setAttribute("aria-label", "Following @bob");
  });
  buttons().find(button => button.dataset.handle === "bob")!.click();
  await vi.advanceTimersByTimeAsync(1500);
  expect(buttons().some(button => button.dataset.handle === "bob")).toBe(false);
  const label = document.querySelector("[data-xfh-root]")!.shadowRoot!.querySelector('[data-friend][data-handle="bob"]');
  expect(label?.textContent).toBe("蓝朋友");
  document.querySelector('[aria-label="Following @bob"]')!.closest('[data-testid="UserCell"]')!.remove();
  controller.scan();
  expect(label?.isConnected).toBe(true);
});

it("discards cached evidence when native controls conflict", () => {
  document.body.insertAdjacentHTML("beforeend", control("alice", "Following", true));
  controller.scan();
  expect(buttons().some(button => button.dataset.handle === "alice")).toBe(false);
  expect(document.querySelector("[data-xfh-root]")!.shadowRoot!.querySelector('[data-friend][data-handle="alice"]')).toBeNull();
});

it("blocks click from stale reused node and viewer changes", () => {
  const button = buttons()[0];
  const native = vi.spyOn(document.querySelector<HTMLElement>('[aria-label="Follow @alice"]')!, "click");
  document.querySelector("nav a")!.setAttribute("href", "/other");
  button.click();
  expect(native).not.toHaveBeenCalled();
  document.querySelector("nav a")!.remove();
  controller.scan();
  expect(buttons()).toHaveLength(0);
});

it("cleans up on toggle and unsupported routes", () => {
  history.pushState({}, "", "/search");
  controller.scan();
  expect(buttons()).toHaveLength(0);
  history.pushState({}, "", "/home");
  controller.scan();
  expect(buttons()).toHaveLength(4);
  controller.setEnabled(false);
  expect(document.querySelector("[data-xfh-root]")).toBeNull();
  controller.setEnabled(true);
  expect(buttons()).toHaveLength(4);
});

it("updates a profile followers list after SPA navigation without a refresh", async () => {
  history.pushState({}, "", "/viewer/followers");
  document.querySelector("aside")!.remove();
  document.querySelector("main")!.innerHTML = `<div data-testid="UserCell">
    <div data-testid="UserAvatar-Container-alice" class="avatar">
      <a href="/alice"><img src="${"data:image/gif;base64,R0lGODlhAQABAAD/ACw="}" alt=""></a>
    </div>
    <div data-testid="User-Name"><a href="/alice">@alice
      <svg data-testid="icon-verified" style="fill:rgb(29, 155, 240)"></svg></a></div>
  </div>`;
  await vi.advanceTimersByTimeAsync(1200);
  expect(buttons().map(button => button.dataset.handle)).toEqual(["alice"]);
  expect(buttons()[0].textContent).toBe("关注");
});

it("ignores untrusted synthetic clicks in the production controller", () => {
  controller.destroy();
  controller = new Controller(document, window);
  controller.setEnabled(true);
  const native = vi.spyOn(document.querySelector<HTMLElement>('[aria-label="Follow @alice"]')!, "click");
  buttons()[0].click();
  expect(native).not.toHaveBeenCalled();
});

it("quarantines old viewer controls until X replaces them", () => {
  document.querySelector("nav a")!.setAttribute("href", "/other");
  controller.scan();
  expect(buttons()).toHaveLength(0);
  document.querySelector("aside")!.innerHTML = control("alice");
  controller.scan();
  expect(buttons().map(button => button.dataset.handle)).toEqual(["alice", "alice"]);
});

it("renders mutual friends as noninteractive labels and hides unknown inbound relations", () => {
  document.querySelector("aside")!.innerHTML = control("alice", "Following", false)
    + control("bob", "Following", true, 101) + control("carol", "Following", null, 102);
  controller.scan();
  expect(buttons().map(button => button.textContent)).toEqual(["取关", "取关", "取关"]);
  const label = document.querySelector("[data-xfh-root]")!.shadowRoot!.querySelector('[data-friend]');
  expect(label?.textContent).toBe("蓝朋友");
  expect(label?.tagName).toBe("SPAN");
  expect(label?.hasAttribute("tabindex")).toBe(false);
});

it("shows an explicit group relation and delegates to a profile tab when no native control is mounted", async () => {
  controller.destroy();
  document.querySelector("main")!.insertAdjacentHTML("beforeend", post("groupuser", 20));
  const avatar = document.querySelector('[data-testid="UserAvatar-Container-groupuser"]')!;
  avatar.setAttribute("data-xfh-relationship", "not-following");
  avatar.setAttribute("data-xfh-follows-you", "true");
  avatar.setAttribute("data-xfh-blue", "true");
  const openExternal = vi.fn().mockResolvedValue(undefined);
  controller = new Controller(document, window, false, undefined, undefined, openExternal);
  controller.setEnabled(true);
  const button = buttons().find(item => item.dataset.handle === "groupuser")!;
  expect(button.textContent).toBe("回关");
  expect(button.dataset.external).toBeDefined();
  button.click();
  await Promise.resolve();
  expect(openExternal).toHaveBeenCalledWith("groupuser", "follow");
});
