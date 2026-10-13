import { handleFromHref, isVisible } from "./adapter";
import { replyButton } from "./reply-shortcut";
import type { ReplyContext } from "./reply-model";

const EDITOR = '[contenteditable="true"][data-testid^="tweetTextarea_"]';

export function readReplyContext(editor: HTMLElement): ReplyContext | null {
  const doc = editor.ownerDocument;
  const path = doc.location.pathname;
  if (/^\/(?:messages|i\/chat|i\/grok)/.test(path)) return null;
  const button = replyButton(editor);
  if (!isVisible(editor) || !button || !/^(Reply|回复|回覆|回復)$/i.test(button.textContent?.trim() ?? "")) return null;
  if ([...doc.querySelectorAll<HTMLElement>(EDITOR)].filter(isVisible).length !== 1) return null;
  if (doc.querySelector('[data-testid="scheduledConfirmation"], [data-testid="scheduleDatePicker"]')) return null;
  let region: HTMLElement | null = editor;
  while (region && region.tagName !== "BODY") {
    const editors = [...region.querySelectorAll<HTMLElement>(EDITOR)].filter(isVisible);
    if (editors.length === 1 && editors[0] === editor) break;
    region = region.parentElement;
  }
  if (!region || region.tagName === "BODY") return null;
  let article = editor.closest<HTMLElement>('article[data-testid="tweet"]')
    ?? region.closest<HTMLElement>('article[data-testid="tweet"]');
  if (!article && /\/status\/\d+/.test(path)) {
    const scope = editor.closest('[role="dialog"]') ?? editor.closest('[data-testid="primaryColumn"]');
    const preceding = [...(scope?.querySelectorAll<HTMLElement>('article[data-testid="tweet"]') ?? [])]
      .filter(node => Boolean(node.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING));
    article = preceding.at(-1) ?? null;
  }
  const link = article?.querySelector<HTMLAnchorElement>('[data-testid="User-Name"] a[href]');
  const handle = handleFromHref(link?.getAttribute("href") ?? null);
  if (!handle) return null;
  const name = article?.querySelector<HTMLElement>('[data-testid="User-Name"] strong')?.textContent?.trim()
    ?? article?.querySelector<HTMLElement>('[data-testid="User-Name"]')?.textContent?.split("@")[0]?.trim()
    ?? handle;
  const topic = article?.querySelector<HTMLElement>('[data-testid="tweetText"]')?.textContent?.trim()
    ?? article?.querySelector<HTMLElement>("p")?.textContent?.trim() ?? "";
  if (!topic) return null;
  return { name, handle, topic: topic.slice(0, 2000), language: "中文", tone: "自然" };
}

export function insertReply(editor: HTMLElement, text: string): boolean {
  if (!text.trim() || !editor.isConnected) return false;
  editor.focus();
  const inserted = document.execCommand?.("insertText", false, text);
  if (!inserted) {
    editor.replaceChildren(document.createTextNode(text));
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }
  return true;
}
