import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { collectAvatars, collectEvidence, isVisible } from "../src/adapter";
import { Controller } from "../src/controller";
import { control } from "./fixtures";

// Structural attributes observed with Chrome Elements on 2026-10-11.
// Accounts and message contents are replaced; relationship controls remain synthetic.
function message(handle: string, key: string): string {
  return `<div data-dm-message-row="${key}" data-testid="message-${key}">
    <div style="grid-template-areas: 'avatar content' '. message-info'">
      <div style="grid-area: avatar"><div id="base-ui-${key}">
        <a href="https://x.com/${handle}"><img alt="user avatar"></a>
      </div></div>
      <div style="grid-area: content"><div role="article">
        <a href="https://x.com/quoted/status/123"><img alt="user avatar"></a>
        <a href="https://x.com/bodylink"><img alt="user avatar"></a>
      </div></div>
    </div>
  </div>`;
}

let root: ShadowRoot;
let controller: Controller | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  history.replaceState({}, "", "/i/chat/g123");
  document.body.innerHTML = `<nav><a data-testid="AppTabBar_Profile_Link" href="/viewer">Profile</a></nav>
    <div data-testid="xchatEmbedRoute"></div>`;
  root = document.querySelector('[data-testid="xchatEmbedRoute"]')!.attachShadow({ mode: "open" });
  root.innerHTML = `<div data-xchat-root="route"><div data-testid="dm-conversation-header">
    <img alt="user avatar"></div><div data-testid="dm-message-list">
      ${message("Alice", "first")}${message("Alice", "second")}
    </div></div>`;
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
  Object.defineProperty(window, "matchMedia", {
    configurable: true, value: () => ({ matches: false }),
  });
});
afterEach(() => {
  controller?.destroy();
  controller = undefined;
  vi.useRealTimers();
});

it("finds individual senders inside the real XChat shadow structure, excluding embedded content", () => {
  const avatars = collectAvatars(document, location.pathname);
  expect(avatars.map(avatar => avatar.handle)).toEqual(["alice", "alice"]);
  expect(avatars[0].anchor.href).toBe("https://x.com/Alice");
  expect(avatars[0].region.hasAttribute("data-dm-message-row")).toBe(true);
});

it("does not treat a hidden shadow host as visible", () => {
  (root.host as HTMLElement).hidden = true;
  expect(isVisible(root.querySelector("a")!)).toBe(false);
  expect(collectAvatars(document, location.pathname)).toHaveLength(0);
});

it("reads explicit controls in XChat overlays without inventing unknown relationships", () => {
  expect(collectEvidence(document).size).toBe(0);
  const overlay = document.createElement("div");
  overlay.dataset.testid = "xchatEmbedOverlays";
  document.body.append(overlay);
  overlay.attachShadow({ mode: "open" }).innerHTML = control("alice", "Follow", true);
  expect(collectEvidence(document).get("alice")?.followsYou).toBe(true);
});

it("observes updates within an existing shadow root and removes stale sender buttons", async () => {
  document.body.insertAdjacentHTML("beforeend", control("alice", "Following", false));
  controller = new Controller(document, window, false);
  controller.setEnabled(true);
  const handles = () => [...document.querySelector("[data-xfh-root]")!.shadowRoot!
    .querySelectorAll<HTMLElement>("button[data-handle]")].map(node => node.dataset.handle);
  expect(handles()).toEqual(["alice"]);
  root.querySelector("a")!.setAttribute("href", "/unknown");
  await vi.advanceTimersByTimeAsync(200);
  expect(handles()).toEqual(["alice"]);
  root.querySelector('[data-dm-message-row="second"]')!.remove();
  await vi.advanceTimersByTimeAsync(200);
  expect(handles()).toEqual([]);
});
