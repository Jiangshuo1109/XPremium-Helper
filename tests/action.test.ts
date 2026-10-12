import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { performAction as performFollow } from "../src/action";
import { collectEvidence } from "../src/adapter";
import { control, fixture } from "./fixtures";

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.innerHTML = fixture().replace(/<!doctype html>|<\/?html[^>]*>/g, "");
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
});
afterEach(() => vi.useRealTimers());

function setup() {
  const evidence = collectEvidence(document).get("alice")!;
  const click = vi.spyOn(evidence.control, "click");
  const abort = new AbortController();
  return {
    evidence, click, abort,
    options: { doc: document, viewer: "viewer", evidence, signal: abort.signal,
      validContext: () => true, timeoutMs: 600, settleMs: 100 },
  };
}

function state(button: HTMLElement, label: string) {
  button.textContent = label;
  button.setAttribute("aria-label", `${label} @alice`);
  button.dataset.testid = "100-unfollow";
}

it.each(["Following", "Requested"])("checks a stable %s result after exactly one click", async label => {
  const { options, click, evidence } = setup();
  click.mockImplementation(() => state(evidence.control, label));
  const result = performFollow(options);
  await vi.advanceTimersByTimeAsync(200);
  expect(await result).toBe(label === "Requested" ? "requested" : "following");
  expect(click).toHaveBeenCalledTimes(1);
});

it("never clicks an already-followed or detached control", async () => {
  const { options, click, evidence } = setup();
  state(evidence.control, "Following");
  await expect(performFollow(options)).rejects.toThrow("状态已变化");
  evidence.control.remove();
  await expect(performFollow(options)).rejects.toThrow("状态已变化");
  expect(click).not.toHaveBeenCalled();
});

it("aborts before clicking if viewer changed", async () => {
  const { options, click } = setup();
  document.querySelector("nav a")!.setAttribute("href", "/different");
  await expect(performFollow(options)).rejects.toThrow("状态已变化");
  expect(click).not.toHaveBeenCalled();
});

it("reports timeout, does not retry, and releases polling", async () => {
  const { options, click } = setup();
  const result = expect(performFollow(options)).rejects.toThrow("尚未确认");
  await vi.advanceTimersByTimeAsync(700);
  await result;
  expect(click).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("treats removal of the original control as unknown, not success", async () => {
  const { options, evidence, click } = setup();
  click.mockImplementation(() => evidence.control.remove());
  const result = expect(performFollow(options)).rejects.toThrow("尚未确认");
  await vi.advanceTimersByTimeAsync(700);
  await result;
});

it("detects newly displayed X failure and optimistic rollback", async () => {
  const { options, click, evidence } = setup();
  click.mockImplementation(() => {
    state(evidence.control, "Following");
    document.body.insertAdjacentHTML("beforeend", '<div role="alert">无法关注，请稍后再试</div>');
  });
  await expect(performFollow(options)).rejects.toThrow("X 未确认");
  expect(click).toHaveBeenCalledTimes(1);
});

it("reports X speed limits to the cooldown handler", async () => {
  const { options, click, evidence } = setup();
  const rateLimited = vi.fn();
  click.mockImplementation(() => {
    state(evidence.control, "Following");
    document.body.insertAdjacentHTML("beforeend",
      '<div role="alert">抱歉，你受到速度限制。请稍等片刻，然后再试一次。</div>');
  });
  await expect(performFollow({ ...options, onRateLimited: rateLimited })).rejects.toThrow("X 未确认");
  expect(rateLimited).toHaveBeenCalledWith("抱歉，你受到速度限制。请稍等片刻，然后再试一次。");
});

it("does not treat an earlier unrelated alert as a new failure", async () => {
  document.body.insertAdjacentHTML("beforeend", '<div role="alert">try again</div>');
  const { options, click, evidence } = setup();
  click.mockImplementation(() => state(evidence.control, "Following"));
  const result = performFollow(options);
  await vi.advanceTimersByTimeAsync(200);
  expect(await result).toBe("following");
});

it("stops after abort without another click", async () => {
  const { options, abort, click } = setup();
  const result = expect(performFollow(options)).rejects.toThrow("检查已停止");
  abort.abort();
  await result;
  expect(click).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects transient success that rolls back", async () => {
  const { options, click, evidence } = setup();
  click.mockImplementation(() => state(evidence.control, "Following"));
  const result = expect(performFollow(options)).rejects.toThrow("尚未确认");
  evidence.control.textContent = "Follow";
  evidence.control.setAttribute("aria-label", "Follow @alice");
  evidence.control.dataset.testid = "100-follow";
  await vi.advanceTimersByTimeAsync(700);
  await result;
});

it("refuses unfollow for mutual followers but allows unknown inbound relationships", async () => {
  for (const followsYou of [true]) {
    document.querySelector("aside")!.innerHTML = control("alice", "Following", followsYou);
    const { options, click } = setup();
    await expect(performFollow({ ...options, kind: "unfollow" })).rejects.toThrow("状态已变化");
    expect(click).not.toHaveBeenCalled();
  }
});

it("completes explicit unilateral unfollow with target-matched native confirmation", async () => {
  document.querySelector("aside")!.innerHTML = control("alice", "Following", false);
  const { options, evidence, click } = setup();
  const confirmed = vi.fn(() => {
    evidence.control.textContent = "Follow";
    evidence.control.setAttribute("aria-label", "Follow @alice");
    evidence.control.dataset.testid = "100-follow";
    document.querySelector('[role="dialog"]')!.remove();
  });
  click.mockImplementation(() => {
    document.body.insertAdjacentHTML("beforeend",
      '<div role="dialog"><h2>Unfollow @alice?</h2><button data-testid="confirmationSheetConfirm">Unfollow</button></div>');
    document.querySelector('[data-testid="confirmationSheetConfirm"]')!.addEventListener("click", confirmed);
  });
  const result = performFollow({ ...options, kind: "unfollow" });
  await vi.advanceTimersByTimeAsync(200);
  expect(await result).toBe("not-following");
  expect(click).toHaveBeenCalledTimes(1);
  expect(confirmed).toHaveBeenCalledTimes(1);
});

it("never confirms another account's native unfollow dialog", async () => {
  document.querySelector("aside")!.innerHTML = control("alice", "Following", false);
  const { options, click } = setup();
  const confirmed = vi.fn();
  click.mockImplementation(() => {
    document.body.insertAdjacentHTML("beforeend",
      '<div role="dialog"><h2>Unfollow @bob?</h2><button data-testid="confirmationSheetConfirm">Unfollow</button></div>');
    document.querySelector('[data-testid="confirmationSheetConfirm"]')!.addEventListener("click", confirmed);
  });
  const result = expect(performFollow({ ...options, kind: "unfollow" })).rejects.toThrow("尚未确认");
  await vi.advanceTimersByTimeAsync(700);
  await result;
  expect(confirmed).not.toHaveBeenCalled();
});
