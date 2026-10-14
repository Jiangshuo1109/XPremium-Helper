import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReplyOverlay } from "../src/reply-overlay";

let overlay: ReplyOverlay;
const root = () => document.querySelector("[data-xfh-reply-root]")!.shadowRoot!;
const click = (selector: string) => root().querySelector<HTMLButtonElement>(selector)!.click();
const composer = () => {
  const article = document.createElement("article");
  article.dataset.testid = "tweet";
  article.innerHTML = `<div data-testid="User-Name"><a href="/alice">@alice</a></div>
    <p data-testid="tweetText">测试留言</p><section>
    <div contenteditable="true" role="textbox"></div><button data-testid="tweetButton">回复</button></section>`;
  document.body.append(article);
  return article.querySelector<HTMLElement>("[contenteditable]")!;
};

beforeEach(() => {
  history.replaceState(null, "", "/home");
  document.body.replaceChildren();
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue(
    Object.assign([new DOMRect()], { item: () => new DOMRect() }),
  );
  vi.stubGlobal("chrome", { storage: { local: { get: vi.fn().mockResolvedValue({}) } },
    runtime: { sendMessage: vi.fn() } });
  Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
  overlay = new ReplyOverlay(document);
  overlay.setEnabled(true);
});
afterEach(() => { overlay.destroy(); vi.unstubAllGlobals(); });

it("opens without any editor and stays open on outside clicks", () => {
  click('[aria-label="打开快捷回复"]');
  document.body.click();
  expect(root().querySelector(".box")).not.toBeNull();
  click(".close");
  expect(root().querySelector('[aria-label="打开快捷回复"]')).not.toBeNull();
});

it("retains a preset selected before an editor exists and inserts without API or sending", () => {
  click('[aria-label="打开快捷回复"]');
  click(".item");
  const editor = composer();
  editor.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  const send = vi.fn();
  document.querySelector('[data-testid="tweetButton"]')!.addEventListener("click", send);
  click(".insert");
  expect(editor.textContent).toContain("感谢留言");
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it("does not choose the first of multiple reply editors", () => {
  composer(); composer();
  click('[aria-label="打开快捷回复"]');
  click(".item"); click(".insert");
  expect([...document.querySelectorAll("[contenteditable]")].every(editor => !editor.textContent)).toBe(true);
});

it("clears candidates when disabled and keeps private-message editors unbound", () => {
  composer();
  history.replaceState(null, "", "/messages/123");
  click('[aria-label="打开快捷回复"]');
  click(".item"); click(".insert");
  expect(document.querySelector("[contenteditable]")!.textContent).toBe("");
  overlay.setEnabled(false);
  expect(document.querySelector("[data-xfh-reply-root]")).toBeNull();
  overlay.setEnabled(true);
  click('[aria-label="打开快捷回复"]');
  expect(root().querySelector(".candidate")!.hasAttribute("hidden")).toBe(true);
});
