import { beforeEach, expect, it, vi } from "vitest";
import { insertReply, readReplyContext } from "../src/reply-context";

beforeEach(() => {
  document.body.innerHTML = `<article data-testid="tweet">
    <div data-testid="User-Name"><strong>作者甲</strong><a href="/alice">@alice</a></div>
    <p data-testid="tweetText">请问这个方法怎么使用？</p>
    <div><div contenteditable="true" role="textbox" data-testid="tweetTextarea_0"></div>
    <button data-testid="tweetButtonInline">回复</button></div>
  </article>`;
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
});

it("reads only the editor's single visible post context", () => {
  const editor = document.querySelector<HTMLElement>("[contenteditable]")!;
  expect(readReplyContext(editor)).toMatchObject({
    name: "作者甲", handle: "alice", topic: "请问这个方法怎么使用？",
  });
  editor.parentElement!.insertAdjacentHTML("beforeend",
    '<div contenteditable="true" data-testid="tweetTextarea_1"></div>');
  expect(readReplyContext(editor)).toBeNull();
});

it("inserts a candidate into the draft and emits input", () => {
  const editor = document.querySelector<HTMLElement>("[contenteditable]")!;
  const input = vi.fn();
  editor.addEventListener("input", input);
  Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
  expect(insertReply(editor, "可以先看说明")).toBe(true);
  expect(editor.textContent).toBe("可以先看说明");
  expect(input).toHaveBeenCalledOnce();
});

it("binds a notification reply dialog to its own preceding post", () => {
  history.replaceState(null, "", "/notifications");
  const post = document.querySelector("article")!;
  const composer = post.lastElementChild!;
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.append(post, composer);
  document.body.append(dialog);
  expect(readReplyContext(composer.querySelector<HTMLElement>("[contenteditable]")!))
    .toMatchObject({ handle: "alice", topic: "请问这个方法怎么使用？" });
});

it("does not borrow a background post for an empty reply dialog", () => {
  history.replaceState(null, "", "/notifications");
  const composer = document.querySelector("article")!.lastElementChild!;
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.append(composer);
  document.body.append(dialog);
  expect(readReplyContext(composer.querySelector<HTMLElement>("[contenteditable]")!)).toBeNull();
});

it("accepts an accessible reply label when the button has no visible text", () => {
  history.replaceState(null, "", "/notifications");
  const button = document.querySelector<HTMLButtonElement>("[data-testid=tweetButtonInline]")!;
  button.textContent = "";
  button.setAttribute("aria-label", "回复");
  expect(readReplyContext(document.querySelector<HTMLElement>("[contenteditable]")!))
    .toMatchObject({ handle: "alice" });
});

it("reads the post context before X has mounted the native reply button", () => {
  const button = document.querySelector<HTMLButtonElement>("[data-testid=tweetButtonInline]")!;
  button.remove();
  expect(readReplyContext(document.querySelector<HTMLElement>("[contenteditable]")!))
    .toMatchObject({ handle: "alice", topic: "请问这个方法怎么使用？" });
});

it("reads a non-article post from the current reply dialog", () => {
  history.replaceState(null, "", "/notifications");
  const original = document.querySelector("article")!;
  const editor = original.querySelector<HTMLElement>("[contenteditable]")!;
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.innerHTML = `<div class="post-shell">
    <div data-testid="User-Name"><strong>弹窗作者</strong><a href="/dialoguser">@dialoguser</a></div>
    <div data-testid="tweetText">弹窗里的当前留言</div>
  </div>`;
  dialog.append(editor.parentElement!);
  original.remove();
  document.body.append(dialog);
  expect(readReplyContext(editor)).toMatchObject({
    name: "弹窗作者", handle: "dialoguser", topic: "弹窗里的当前留言",
  });
});

it("does not duplicate text when execCommand changes the editor but reports false", () => {
  const editor = document.querySelector<HTMLElement>("[contenteditable]")!;
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: vi.fn(() => {
      editor.textContent = "可以先看说明";
      return false;
    }),
  });
  expect(insertReply(editor, "可以先看说明")).toBe(true);
  expect(editor.textContent).toBe("可以先看说明");
});

it("does not append the same candidate when the editor already contains it", () => {
  const editor = document.querySelector<HTMLElement>("[contenteditable]")!;
  editor.textContent = "可以先看说明";
  Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
  expect(insertReply(editor, "可以先看说明")).toBe(true);
  expect(editor.textContent).toBe("可以先看说明");
});

it("recognizes a modal editor exposed only as a semantic textbox", () => {
  history.replaceState(null, "", "/status/123");
  const editor = document.querySelector<HTMLElement>("[contenteditable]")!;
  editor.removeAttribute("data-testid");
  editor.setAttribute("role", "textbox");
  expect(readReplyContext(editor)).toMatchObject({ handle: "alice" });
});

it("ignores editors in other posts while reading the current reply region", () => {
  const other = document.createElement("article");
  other.innerHTML = `<div data-testid="User-Name"><strong>作者乙</strong><a href="/bob">@bob</a></div>
    <p data-testid="tweetText">另一条帖子</p>
    <div><div contenteditable="true" role="textbox" data-testid="tweetTextarea_1"></div>
    <button data-testid="tweetButtonInline">回复</button></div>`;
  document.body.append(other);
  const editor = document.querySelector<HTMLElement>("[contenteditable]")!;
  expect(readReplyContext(editor)).toMatchObject({ handle: "alice" });
});
