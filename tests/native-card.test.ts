import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { withNativeCard } from "../src/native-card";
import { collectAvatars } from "../src/adapter";
import { control, post } from "./fixtures";

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = post("alice");
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
});
afterEach(() => vi.useRealTimers());

it("reads a matching card before use and closes it afterward without clicking follow", async () => {
  const avatar = collectAvatars(document, "/home")[0];
  const clicks = vi.fn();
  avatar.anchor.addEventListener("mouseover", () => {
    document.body.insertAdjacentHTML("beforeend", control("alice"));
    document.querySelector("button")!.addEventListener("click", clicks);
  });
  const closed = vi.fn();
  avatar.anchor.addEventListener("mouseout", closed);
  const value = await withNativeCard(document, avatar, new AbortController().signal, () => true,
    proof => proof.relationship);
  expect(value).toBe("not-following");
  expect(closed).toHaveBeenCalledOnce();
  expect(clicks).not.toHaveBeenCalled();
});

it("times out instead of using another user's card and does not retry", async () => {
  const avatar = collectAvatars(document, "/home")[0];
  const open = vi.fn(() => document.body.insertAdjacentHTML("beforeend", control("bob")));
  avatar.anchor.addEventListener("mouseover", open);
  const use = vi.fn();
  const promise = withNativeCard(document, avatar, new AbortController().signal, () => true, use);
  const assertion = expect(promise).rejects.toThrow("未能读取");
  await vi.advanceTimersByTimeAsync(2600);
  await assertion;
  expect(use).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalledOnce();
});

it("aborts pending reads when the viewing context changes", async () => {
  const avatar = collectAvatars(document, "/home")[0];
  const abort = new AbortController();
  const use = vi.fn();
  const promise = withNativeCard(document, avatar, abort.signal, () => true, use);
  const assertion = expect(promise).rejects.toThrow("页面已变化");
  abort.abort();
  await assertion;
  expect(use).not.toHaveBeenCalled();
});

it("clips background cards before opening and removes masking after close", async () => {
  const avatar = collectAvatars(document, "/home")[0];
  avatar.anchor.addEventListener("mouseover", () => {
    expect(document.querySelector("style[data-xfh-quiet]")).not.toBeNull();
    document.body.insertAdjacentHTML("beforeend", `<div data-testid="HoverCard">${control("alice")}</div>`);
  });
  avatar.anchor.addEventListener("mouseout", () => document.querySelector('[data-testid="HoverCard"]')?.remove());
  const use = vi.fn(proof => proof.relationship);
  const promise = withNativeCard(document, avatar, new AbortController().signal, () => true, use, undefined, true);
  await vi.advanceTimersByTimeAsync(250);
  expect(await promise).toBe("not-following");
  expect(use).toHaveBeenCalledOnce();
  expect(document.querySelector("style[data-xfh-quiet]")).toBeNull();
});

it("does not mask a card the user already opened", async () => {
  document.body.insertAdjacentHTML("beforeend", '<div data-testid="HoverCard">User card</div>');
  const avatar = collectAvatars(document, "/home")[0];
  await expect(withNativeCard(document, avatar, new AbortController().signal, () => true,
    vi.fn(), undefined, true)).rejects.toThrow("正在查看资料卡");
  expect(document.querySelector("style[data-xfh-quiet]")).toBeNull();
});

it("consumes a newly mounted native control without waiting for the polling interval", async () => {
  const avatar = collectAvatars(document, "/home")[0];
  avatar.anchor.addEventListener("mouseover", () => {
    setTimeout(() => document.body.insertAdjacentHTML("beforeend", control("alice")), 20);
  });
  const use = vi.fn(proof => proof.relationship);
  const promise = withNativeCard(document, avatar, new AbortController().signal, () => true, use);
  await vi.advanceTimersByTimeAsync(20);
  expect(use).toHaveBeenCalledOnce();
  expect(await promise).toBe("not-following");
});
