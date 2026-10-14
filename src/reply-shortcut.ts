import { isVisible } from "./adapter";

export const EDITOR = '[contenteditable="true"][role="textbox"], [contenteditable="true"][data-testid^="tweetTextarea_"]';
const SUBMIT = '[data-testid="tweetButtonInline"], [data-testid="tweetButton"], [role="button"]';
const REPLY = /^(?:Reply|回复|回覆|回復|Post|发帖|發佈|发布)$/i;

function isDisabled(element: HTMLElement): boolean {
  return element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
}

function submitLabel(element: HTMLElement): string {
  return element.textContent?.trim() || element.getAttribute("aria-label")?.trim() || "";
}

export function replyButton(editor: HTMLElement): HTMLElement | null {
  for (let scope = editor.parentElement; scope && scope.tagName !== "BODY"; scope = scope.parentElement) {
    const editors = [...scope.querySelectorAll<HTMLElement>(EDITOR)].filter(isVisible);
    if (editors.length !== 1 || editors[0] !== editor) return null;
    const buttons = [...scope.querySelectorAll<HTMLElement>(SUBMIT)]
      .filter(button => (button instanceof HTMLButtonElement || button.getAttribute("role") === "button")
        && isVisible(button)
        && REPLY.test(submitLabel(button)));
    if (!buttons.length) continue;
    if (buttons.length !== 1) return null;
    return buttons[0];
  }
  return null;
}

export class ReplyShortcut {
  private enabled = false;
  private composing = new WeakSet<HTMLElement>();
  private compositionEnded = new WeakMap<HTMLElement, number>();
  private sent = new WeakMap<HTMLElement, number>();

  constructor(private doc: Document, private trustedOnly = true) {
    doc.addEventListener("keydown", this.keydown, true);
    doc.addEventListener("compositionstart", this.compositionStart, true);
    doc.addEventListener("compositionend", this.compositionEnd, true);
  }

  setEnabled(value: boolean): void { this.enabled = value; }

  private editor(event: Event): HTMLElement | null {
    return event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(EDITOR) : null;
  }

  private compositionStart = (event: CompositionEvent): void => {
    const editor = this.editor(event);
    if (editor) this.composing.add(editor);
  };

  private compositionEnd = (event: CompositionEvent): void => {
    const editor = this.editor(event);
    if (editor) {
      this.composing.delete(editor);
      this.compositionEnded.set(editor, Date.now());
    }
  };

  private keydown = (event: KeyboardEvent): void => {
    if (!this.enabled || (this.trustedOnly && !event.isTrusted) || event.defaultPrevented
      || event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey
      || event.isComposing || event.keyCode === 229) return;
    const editor = this.editor(event);
    if (!editor || !isVisible(editor) || this.composing.has(editor)
      || Date.now() - (this.compositionEnded.get(editor) ?? -Infinity) < 150) return;

    // Let X's mention/hashtag menu consume Enter when it is selecting a suggestion.
    const controls = (editor.getAttribute("aria-controls") ?? "").split(/\s+/).filter(Boolean);
    if (controls.some(id => {
      const menu = this.doc.getElementById(id);
      return menu && isVisible(menu) && menu.querySelector('[role="option"], [role="listbox"]');
    }) || [...this.doc.querySelectorAll<HTMLElement>('[role="listbox"]')].some(isVisible)) return;

    const button = replyButton(editor);
    if (!button || isDisabled(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat || Date.now() - (this.sent.get(editor) ?? -Infinity) < 1500) return;
    this.sent.set(editor, Date.now());
    button.click();
  };

  destroy(): void {
    this.enabled = false;
    this.doc.removeEventListener("keydown", this.keydown, true);
    this.doc.removeEventListener("compositionstart", this.compositionStart, true);
    this.doc.removeEventListener("compositionend", this.compositionEnd, true);
  }
}
