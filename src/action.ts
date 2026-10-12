import { collectEvidence, currentViewer, isVisible, nativeAlerts, readControl } from "./adapter";
import { availableAction } from "./model";
import type { Evidence, RelationshipAction } from "./model";

export type ActionResult = "following" | "requested" | "not-following";

export interface ActionOptions {
  doc: Document;
  viewer: string;
  evidence: Evidence;
  signal: AbortSignal;
  validContext: () => boolean;
  excluded?: WeakSet<HTMLElement>;
  kind?: RelationshipAction;
  timeoutMs?: number;
  settleMs?: number;
  onDispatch?: () => void;
  onRateLimited?: (message: string) => void;
}

export async function performAction(options: ActionOptions): Promise<ActionResult> {
  const { doc, viewer, evidence, signal, validContext } = options;
  const kind = options.kind ?? "follow";
  const valid = () => !signal.aborted && validContext() && currentViewer(doc) === viewer;
  const live = readControl(evidence.control);
  const unanimous = collectEvidence(doc, options.excluded).get(evidence.handle);
  if (!valid() || !live || !unanimous || live.handle !== evidence.handle
    || live.nativeId !== evidence.nativeId
    || options.excluded?.has(evidence.control)
    || availableAction(viewer, live) !== kind || availableAction(viewer, unanimous) !== kind
    || viewer === live.handle) throw new Error("状态已变化，请查看 X 原生关注入口");

  const before = nativeAlerts(doc);
  const dialogSelector = '[role="dialog"], [role="alertdialog"], [data-testid="confirmationSheetDialog"]';
  const previousDialogs = new Set(doc.querySelectorAll(dialogSelector));
  return new Promise((resolve, reject) => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let stable: ActionResult | null = null;
    let stableAt = 0;
    const start = Date.now();
    let finished = false;
    let nativeConfirmed = false;
    let rateLimitReported = false;
    const finish = (error?: string, result?: ActionResult) => {
      if (finished) return;
      finished = true;
      clearInterval(interval);
      signal.removeEventListener("abort", abort);
      if (error) reject(new Error(error));
      else resolve(result!);
    };
    const abort = () => finish("操作检查已停止，请查看 X 原生状态");
    const check = () => {
      if (!valid()) return abort();
      for (const [node, text] of nativeAlerts(doc)) {
        if (before.get(node) !== text
          && /(?:unable|cannot|can't|limit|try again|went wrong|failed|无法|不能|失败|限制|稍后|出错)/i.test(text)) {
          if (!rateLimitReported && /(?:rate limit|too many requests|速度限制|频繁|稍等片刻)/i.test(text)) {
            rateLimitReported = true;
            options.onRateLimited?.(text);
          }
          return finish("X 未确认操作成功，请查看页面提示");
        }
      }
      if (kind === "unfollow" && !nativeConfirmed) {
        for (const dialog of doc.querySelectorAll(dialogSelector)) {
          if (previousDialogs.has(dialog)) continue;
          const heading = dialog.querySelector('h1, h2, [role="heading"]')?.textContent?.trim() ?? "";
          const handles = [...heading.matchAll(/@([A-Za-z0-9_]{1,15})/g)].map(match => match[1].toLowerCase());
          const confirm = dialog.querySelector<HTMLElement>('[data-testid="confirmationSheetConfirm"]');
          if (!confirm || !isVisible(confirm) || handles.length !== 1 || handles[0] !== evidence.handle
            || !/(?:Unfollow|取消关注)/i.test(heading)
            || !/^(?:Unfollow|取消关注)$/i.test(confirm.textContent?.trim() ?? "")
            || confirm.hasAttribute("disabled") || confirm.getAttribute("aria-disabled") === "true") continue;
          const latest = readControl(evidence.control);
          if (latest && availableAction(viewer, latest) !== "unfollow") {
            return finish("关注关系已变化，请重新查看");
          }
          nativeConfirmed = true;
          try { confirm.click(); } catch { return finish("原生确认控件不可用，请在 X 中操作"); }
          break;
        }
      }
      const observed = collectEvidence(doc, options.excluded).get(evidence.handle);
      const state = observed?.nativeId === evidence.nativeId ? observed.relationship : undefined;
      const complete = kind === "follow"
        ? state === "following" || state === "requested"
        : state === "not-following";
      if (complete && state) {
        if (state !== stable) {
          stable = state;
          stableAt = Date.now();
        }
        if (Date.now() - stableAt >= (options.settleMs ?? 1200)) return finish(undefined, state);
      } else {
        stable = null;
      }
      if (Date.now() - start >= (options.timeoutMs ?? 8000)) {
        finish("尚未确认结果，请查看 X 原生状态");
      }
    };
    signal.addEventListener("abort", abort, { once: true });
    interval = setInterval(check, 100);
    try {
      // One explicit action; only a target-matched native confirmation may follow.
      options.onDispatch?.();
      evidence.control.click();
      check();
    } catch {
      finish("原生关注控件不可用，请在 X 中操作");
    }
  });
}
