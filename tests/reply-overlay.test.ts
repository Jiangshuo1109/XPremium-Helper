import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReplyOverlay } from "../src/reply-overlay";

let overlay: ReplyOverlay;
const root = () => document.querySelector("[data-xfh-reply-root]")!.shadowRoot!;
const click = (selector: string) => root().querySelector<HTMLButtonElement>(selector)!.click();
const composer = (semantic = true) => {
  const article = document.createElement("article");
  article.dataset.testid = "tweet";
  article.innerHTML = `<div data-testid="User-Name"><a href="/alice">@alice</a></div>
    <p data-testid="tweetText">测试留言</p><section>
    <div contenteditable="true"${semantic ? ' role="textbox"' : ""}></div><button data-testid="tweetButton">回复</button></section>`;
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
  const editor = composer(false);
  editor.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  const send = vi.fn();
  document.querySelector('[data-testid="tweetButton"]')!.addEventListener("click", send);
  click(".insert");
  expect(editor.textContent).toContain("感谢留言");
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it("binds a visible X editor even when the native reply label is not ready", () => {
  click('[aria-label="打开快捷回复"]');
  click(".item");
  const editor = composer();
  editor.parentElement!.querySelector("button")?.remove();
  editor.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  click(".insert");
  expect(editor.textContent).toContain("感谢留言");
});

it("inserts once and sends through the current native reply button", () => {
  const editor = composer();
  const send = vi.fn();
  const button = editor.parentElement!.querySelector("button")!;
  button.addEventListener("click", send);
  click('[aria-label="打开快捷回复"]');
  click(".item");
  click(".send");
  expect(editor.textContent).toContain("感谢留言");
  expect(send).toHaveBeenCalledOnce();
});

it("does not send when the native reply button is unavailable", () => {
  const editor = composer();
  editor.parentElement!.querySelector("button")!.remove();
  click('[aria-label="打开快捷回复"]');
  click(".item");
  click(".send");
  expect(editor.textContent).toBe("");
  expect(root().querySelector(".status")?.textContent).toContain("没有找到");
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
  expect(root().querySelector(".recommendation")?.textContent).toContain("生成后会自动写入");
});

it("automatically writes a generated reply and mirrors the editor draft", async () => {
  const editor = composer();
  vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ text: "这是一条完整的模型回复。" } as never);
  click('[aria-label="打开快捷回复"]');
  await root().querySelector<HTMLButtonElement>(".generate")!.click();
  await vi.waitFor(() => expect(editor.textContent).toBe("这是一条完整的模型回复。"));
  expect(root().querySelector(".recommendation")?.textContent).toBe("这是一条完整的模型回复。");
  expect(root().querySelector(".draft")?.textContent).toBe("这是一条完整的模型回复。");
  expect(root().querySelector(".draft-state")?.textContent).toContain("一致");
});

it("reports when the user changes the generated draft", async () => {
  const editor = composer();
  vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ text: "模型建议内容。" } as never);
  click('[aria-label="打开快捷回复"]');
  await root().querySelector<HTMLButtonElement>(".generate")!.click();
  await vi.waitFor(() => expect(editor.textContent).toBe("模型建议内容。"));
  editor.textContent = "用户手动改过的内容。";
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  await vi.waitFor(() => expect(root().querySelector(".draft-state")?.textContent).toContain("手动修改"));
  expect(root().querySelector(".status")?.textContent).toContain("手动修改");
});

it("does not write the same generated reply twice", async () => {
  const editor = composer();
  const input = vi.fn();
  editor.addEventListener("input", input);
  vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ text: "只写入一次。" } as never);
  click('[aria-label="打开快捷回复"]');
  await root().querySelector<HTMLButtonElement>(".generate")!.click();
  await vi.waitFor(() => expect(editor.textContent).toBe("只写入一次。"));
  click(".insert");
  expect(editor.textContent).toBe("只写入一次。");
  expect(input).toHaveBeenCalledOnce();
});
