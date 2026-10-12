import { collectEvidence, handleFromHref } from "./adapter";
import type { Avatar, Evidence } from "./model";
import { pageRoots } from "./dom";

export class ProbeInterrupted extends Error {}

// Clip only new hover cards during background reads. Existing/user-opened cards stay visible.
function quietCards(doc: Document): () => void {
  const roots = pageRoots(doc);
  if (roots.some(root => root.querySelector('[data-testid="HoverCard"]'))) {
    throw new ProbeInterrupted("正在查看资料卡");
  }
  const styles = roots.map(root => {
    const style = doc.createElement("style");
    style.dataset.xfhQuiet = "";
    style.textContent = '[data-testid="HoverCard"] { clip-path: inset(100%) !important; pointer-events: none !important; }';
    (root === doc ? doc.head : root).appendChild(style);
    return style;
  });
  return () => styles.forEach(style => style.remove());
}

function pointer(anchor: HTMLElement, entering: boolean): void {
  const win = anchor.ownerDocument.defaultView!;
  const relatedTarget = anchor.ownerDocument.body;
  const rect = anchor.getBoundingClientRect();
  const options = { bubbles: true, composed: true, relatedTarget, pointerType: "mouse",
    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
  if (typeof PointerEvent !== "undefined") {
    anchor.dispatchEvent(new PointerEvent(entering ? "pointerover" : "pointerout", options));
  }
  anchor.dispatchEvent(new win.MouseEvent(entering ? "mouseover" : "mouseout", options));
  for (let node: HTMLElement | null = anchor; node && !node.matches('article, [data-dm-message-row]'); node = node.parentElement) {
    if (typeof PointerEvent !== "undefined") {
      node.dispatchEvent(new PointerEvent(entering ? "pointerenter" : "pointerleave", { ...options, bubbles: false }));
    }
    node.dispatchEvent(new win.MouseEvent(entering ? "mouseenter" : "mouseleave", { ...options, bubbles: false }));
  }
  if (entering) anchor.dispatchEvent(new win.MouseEvent("mousemove", options));
}

/** Keep the native card mounted until the caller has finished validating or acting. */
export async function withNativeCard<T>(
  doc: Document,
  avatar: Avatar,
  signal: AbortSignal,
  valid: () => boolean,
  use: (evidence: Evidence) => Promise<T> | T,
  excluded?: WeakSet<HTMLElement>,
  quiet = false,
): Promise<T> {
  const live = () => collectEvidence(doc, excluded).get(avatar.handle);
  if (signal.aborted || !valid()) throw new ProbeInterrupted("页面已变化");
  const existing = live();
  if (existing) return use(existing);
  let opened = false;
  const restore = quiet ? quietCards(doc) : () => {};
  let interrupted = false;
  let userHover = false;
  const interrupt = (event: Event) => {
    if (!event.isTrusted) return;
    interrupted = true;
    userHover = event.type.startsWith("pointer") && event.composedPath().some(node =>
      node instanceof HTMLAnchorElement && handleFromHref(node.getAttribute("href")) !== null);
  };
  if (quiet) {
    doc.addEventListener("pointermove", interrupt, true);
    doc.addEventListener("pointerdown", interrupt, true);
    doc.addEventListener("keydown", interrupt, true);
  }
  try {
    opened = true;
    pointer(avatar.anchor, true);
    const evidence = await new Promise<Evidence>((resolve, reject) => {
      let finished = false;
      const observer = new MutationObserver(check);
      const finish = (error?: Error, proof?: Evidence) => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        clearInterval(interval);
        clearTimeout(timeout);
        signal.removeEventListener("abort", check);
        if (error) reject(error);
        else resolve(proof!);
      };
      function check() {
        if (interrupted || signal.aborted || !valid() || !avatar.anchor.isConnected) {
          finish(new ProbeInterrupted("页面已变化或检查已暂停"));
          return;
        }
        const proof = live();
        if (proof) finish(undefined, proof);
      }
      const interval = setInterval(check, 100);
      const timeout = setTimeout(() => finish(new Error("未能读取原生资料卡，请打开该账号资料")), 2500);
      for (const root of pageRoots(doc)) observer.observe(root, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ["data-testid", "aria-label", "aria-disabled", "disabled"],
      });
      signal.addEventListener("abort", check, { once: true });
      check();
    });
    return await use(evidence);
  } finally {
    if (opened && !userHover && avatar.anchor.isConnected) pointer(avatar.anchor, false);
    if (quiet && !userHover && pageRoots(doc).some(root => root.querySelector('[data-testid="HoverCard"]'))) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    restore();
    doc.removeEventListener("pointermove", interrupt, true);
    doc.removeEventListener("pointerdown", interrupt, true);
    doc.removeEventListener("keydown", interrupt, true);
  }
}
