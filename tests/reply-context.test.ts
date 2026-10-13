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
