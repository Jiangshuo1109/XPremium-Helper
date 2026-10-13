import { isRateLimitMessage, nativeAlerts } from "./adapter";
import { pageRoots } from "./dom";

/** A visible occurrence is consumed once, even if X replaces its DOM node. */
export class RateLimitMonitor {
  private visible = new Set<string>();
  private observer: MutationObserver;
  private roots: Array<Document | ShadowRoot> = [];
  private heartbeat: ReturnType<typeof setInterval>;
  private enabled = false;

  constructor(private doc: Document, private detected: () => void,
    private unknownError: (text: string) => void) {
    this.observer = new MutationObserver(this.scan);
    this.heartbeat = setInterval(this.scan, 500);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.scan();
    else this.visible.clear();
  }

  scan = (): void => {
    if (!this.enabled) return;
    const roots = pageRoots(this.doc);
    if (roots.length !== this.roots.length || roots.some((root, i) => root !== this.roots[i])) {
      this.observer.disconnect();
      this.roots = roots;
      for (const root of roots) this.observer.observe(root, {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ["role", "data-testid", "class", "style", "hidden", "aria-hidden"],
      });
    }
    const texts = new Set([...nativeAlerts(this.doc).values()].map(text => text.replace(/\s+/g, " ").trim()));
    for (const text of texts) {
      if (!text || this.visible.has(text)) continue;
      if (isRateLimitMessage(text)) this.detected();
      else if (/try again|稍后|稍等|失败|error|failed/i.test(text)) this.unknownError(text.slice(0, 200));
    }
    this.visible = texts;
  };

  destroy(): void {
    this.enabled = false;
    this.observer.disconnect();
    clearInterval(this.heartbeat);
    this.visible.clear();
  }
}
