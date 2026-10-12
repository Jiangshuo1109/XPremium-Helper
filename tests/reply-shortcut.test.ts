import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReplyShortcut } from "../src/reply-shortcut";

let shortcut: ReplyShortcut;
let editor: HTMLElement;
let submit: HTMLButtonElement;
let clicks: ReturnType<typeof vi.fn<() => void>>;
const enter = (options: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...options });
  editor.dispatchEvent(event);
  return event;
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
  document.body.innerHTML = `<main><section><div>
    <div role="textbox" data-testid="tweetTextarea_0" contenteditable="true">test reply</div>
  </div><div><button data-testid="tweetButtonInline">回复</button></div></section></main>`;
  editor = document.querySelector("[contenteditable]")!;
  submit = document.querySelector("button")!;
  clicks = vi.fn();
  submit.addEventListener("click", clicks);
  shortcut = new ReplyShortcut(document, false);
  shortcut.setEnabled(true);
});
afterEach(() => { shortcut.destroy(); vi.useRealTimers(); });

it("routes Enter to the native reply button and prevents newline and repeat sends", () => {
  expect(enter().defaultPrevented).toBe(true);
  enter();
  enter({ repeat: true });
  expect(clicks).toHaveBeenCalledTimes(1);
});
it.each(["回复", "回覆", "Reply", "Post", "发帖", "發佈"])("handles the native submit label %s", label => {
  submit.textContent = label;
  enter();
  expect(clicks).toHaveBeenCalledTimes(1);
});
it.each(["shiftKey", "ctrlKey", "metaKey", "altKey"])("preserves modifier %s", key => {
  expect(enter({ [key]: true }).defaultPrevented).toBe(false);
  expect(clicks).not.toHaveBeenCalled();
});
it("never sends while composing or confirming Chinese text", async () => {
  enter({ isComposing: true });
  enter({ keyCode: 229 });
  editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
  enter();
  editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  enter();
  expect(clicks).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(151);
  enter();
  expect(clicks).toHaveBeenCalledTimes(1);
});
it("preserves Enter when selecting a mention", () => {
  document.body.insertAdjacentHTML("beforeend", '<div role="listbox"><div role="option">@test</div></div>');
  expect(enter().defaultPrevented).toBe(false);
  expect(clicks).not.toHaveBeenCalled();
});
it("ignores disabled replies, messages and unknown buttons", () => {
  submit.disabled = true;
  enter();
  submit.disabled = false;
  submit.setAttribute("aria-disabled", "true");
  enter();
  submit.removeAttribute("aria-disabled");
  submit.textContent = "Schedule";
  enter();
  submit.textContent = "回复";
  submit.dataset.testid = "dm-send";
  enter();
  expect(clicks).not.toHaveBeenCalled();
});
it("binds the focused editor to its own composer", () => {
  document.body.insertAdjacentHTML("beforeend", '<button data-testid="tweetButton">Reply</button>');
  enter();
  expect(clicks).toHaveBeenCalledTimes(1);
});
it("fails closed when two visible editors share a submit area", () => {
  editor.parentElement!.append(editor.cloneNode(true));
  enter();
  expect(clicks).not.toHaveBeenCalled();
});
it("supports dynamically mounted reply dialogs", () => {
  document.querySelector("section")!.setAttribute("role", "dialog");
  submit.dataset.testid = "tweetButton";
  enter();
  expect(clicks).toHaveBeenCalledTimes(1);
});
it("supports X reply controls exposed as role buttons with an aria label", () => {
  const replacement = document.createElement("div");
  replacement.setAttribute("role", "button");
  replacement.dataset.testid = "tweetButtonInline";
  replacement.setAttribute("aria-label", "回复");
  replacement.tabIndex = 0;
  replacement.addEventListener("click", clicks);
  submit.replaceWith(replacement);
  enter();
  expect(clicks).toHaveBeenCalledTimes(1);
});
it("removes listeners and respects the extension switch", () => {
  shortcut.setEnabled(false);
  enter();
  shortcut.setEnabled(true);
  shortcut.destroy();
  enter();
  expect(clicks).not.toHaveBeenCalled();
});
