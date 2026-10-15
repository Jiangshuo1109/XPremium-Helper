import { handleFromHref, isVisible } from "./adapter";
import { EDITOR } from "./reply-shortcut";
import type { ReplyContext } from "./reply-model";

function beforeEditor(node: Node, editor: HTMLElement): boolean {
  return Boolean(node.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function authorHandle(root: ParentNode): string | null {
  const link = root.querySelector<HTMLAnchorElement>('[data-testid="User-Name"] a[href]')
    ?? root.querySelector<HTMLAnchorElement>('a[href^="/"][href]:not([href^="/i/"])');
  return handleFromHref(link?.getAttribute("href") ?? null);
}

function postRoot(text: HTMLElement): HTMLElement | null {
  return text.closest<HTMLElement>('article[data-testid="tweet"], [role="article"]')
    ?? text.parentElement;
}

function findCurrentPost(editor: HTMLElement, region: HTMLElement): HTMLElement | null {
  const direct = editor.closest<HTMLElement>('article[data-testid="tweet"], [role="article"]');
  if (direct) return direct;
  const dialog = editor.closest<HTMLElement>('[role="dialog"]');
  const scope = dialog ?? region.closest<HTMLElement>('[data-testid="primaryColumn"]') ?? region;
  const candidates = [...scope.querySelectorAll<HTMLElement>('[data-testid="tweetText"]')]
    .filter(text => isVisible(text) && beforeEditor(text, editor))
    .map(text => postRoot(text))
    .filter((root): root is HTMLElement => Boolean(root && authorHandle(root)));
  return candidates.at(-1) ?? null;
}

export function readReplyContext(editor: HTMLElement): ReplyContext | null {
  const doc = editor.ownerDocument;
  const path = doc.location.pathname;
  if (/^\/(?:messages|i\/chat|i\/grok)/.test(path)) return null;
  if (!isVisible(editor)) return null;
  if (doc.querySelector('[data-testid="scheduledConfirmation"], [data-testid="scheduleDatePicker"]')) return null;
  let region: HTMLElement | null = editor;
  while (region && region.tagName !== "BODY") {
    const editors = [...region.querySelectorAll<HTMLElement>(EDITOR)].filter(isVisible);
    if (editors.length === 1 && editors[0] === editor) break;
    region = region.parentElement;
  }
  if (!region || region.tagName === "BODY") return null;
  const visibleEditors = [...region.querySelectorAll<HTMLElement>(EDITOR)].filter(isVisible);
  if (visibleEditors.length !== 1 || visibleEditors[0] !== editor) return null;
  let article = findCurrentPost(editor, region);
  if (!article) {
    const scope = editor.closest('[role="dialog"]');
    const referencedHandles = new Set(
      [...(scope?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? [])]
        .map(link => handleFromHref(link.getAttribute("href")))
        .filter((handle): handle is string => Boolean(handle)),
    );
    if (referencedHandles.size) {
      const preceding = [...doc.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')]
        .filter(node => isVisible(node) && beforeEditor(node, editor))
        .filter(node => {
          const handle = handleFromHref(
            node.querySelector<HTMLAnchorElement>('[data-testid="User-Name"] a[href]')?.getAttribute("href") ?? null,
          );
          return Boolean(handle && referencedHandles.has(handle));
        });
      article = preceding.at(-1) ?? null;
    }
  }
  const link = article?.querySelector<HTMLAnchorElement>('[data-testid="User-Name"] a[href]')
    ?? article?.querySelector<HTMLAnchorElement>('a[href^="/"][href]:not([href^="/i/"])');
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
  const before = editor.textContent ?? "";
  document.execCommand?.("insertText", false, text);
  const after = editor.textContent ?? "";
  // Chromium/X can report false after the command has already changed the editor.
  if (after !== before) {
    return after.includes(text);
  }
  if (before.includes(text)) return true;
  if (!after.trim()) {
    editor.replaceChildren(document.createTextNode(text));
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return true;
  }
  return false;
}
