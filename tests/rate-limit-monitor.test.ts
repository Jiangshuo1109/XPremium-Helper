import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { RateLimitMonitor } from "../src/rate-limit-monitor";
import { isRateLimitMessage, supportedRoute } from "../src/adapter";
import { mergeCooldown } from "../src/cooldown";

let monitor: RateLimitMonitor;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
});
afterEach(() => { monitor?.destroy(); vi.useRealTimers(); });

it("detects limits without viewer or supported route and consumes each occurrence once", () => {
  history.replaceState({}, "", "/explore");
  const detected = vi.fn();
  monitor = new RateLimitMonitor(document, detected, vi.fn());
  monitor.setEnabled(true);
  document.body.innerHTML = '<div role="alert">抱歉，你受到速度限制。请稍等片刻，然后再试一次。</div>';
  monitor.scan();
  monitor.scan();
  expect(detected).toHaveBeenCalledTimes(1);
  // Replacement by React is still the same visible occurrence.
  document.body.innerHTML = '<div role="alert">抱歉，你受到速度限制。请稍等片刻，然后再试一次。</div>';
  monitor.scan();
  expect(detected).toHaveBeenCalledTimes(1);
  const alert = document.querySelector<HTMLElement>('[role="alert"]')!;
  alert.hidden = true;
  monitor.scan();
  alert.hidden = false;
  monitor.scan();
  expect(detected).toHaveBeenCalledTimes(2);
  alert.textContent = "Rate limit exceeded";
  monitor.scan();
  expect(detected).toHaveBeenCalledTimes(3);
});

it("observes late attached chat roots and ignores generic errors", async () => {
  const detected = vi.fn(), unknown = vi.fn();
  monitor = new RateLimitMonitor(document, detected, unknown);
  monitor.setEnabled(true);
  const host = document.createElement("div");
  host.dataset.testid = "xchatEmbedOverlays";
  document.body.append(host);
  host.attachShadow({ mode: "open" }).innerHTML = '<div role="alert">Please try again later</div>';
  await vi.advanceTimersByTimeAsync(600);
  expect(detected).not.toHaveBeenCalled();
  expect(unknown).toHaveBeenCalledTimes(1);
  host.shadowRoot!.querySelector("div")!.textContent = "Too many requests";
  await vi.advanceTimersByTimeAsync(10);
  expect(detected).toHaveBeenCalledTimes(1);
  monitor.setEnabled(false);
  host.shadowRoot!.querySelector("div")!.textContent = "受到速度限制";
  monitor.scan();
  expect(detected).toHaveBeenCalledTimes(1);
});

it("does not turn posting limits or generic failures into follow cooldowns", () => {
  for (const text of ["Try again later", "请稍等片刻", "无法关注，请稍后再试",
    "You've reached the daily limit for sending posts", "今日私信达到上限"]) {
    expect(isRateLimitMessage(text)).toBe(false);
  }
  expect(isRateLimitMessage("You are rate limited")).toBe(true);
  expect(supportedRoute("/viewer/verified_followers")).toBe(true);
  expect(mergeCooldown(5000, 3000)).toBe(5000);
  expect(mergeCooldown(undefined, 3000)).toBe(3000);
});
