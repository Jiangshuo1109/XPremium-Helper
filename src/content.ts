import { Controller } from "./controller";
import { ReplyShortcut } from "./reply-shortcut";
import { currentViewer } from "./adapter";
import { clearExternalTask, createExternalTask, readExternalTask } from "./task";
import type { PageState } from "./model";
import { RateLimitMonitor } from "./rate-limit-monitor";
import { FOLLOW_COOLDOWN_MS } from "./cooldown";
import { View } from "./view";
import { ReplyOverlay } from "./reply-overlay";

declare global {
  interface Window {
    __xfhStarted?: boolean;
  }
}

if (!window.__xfhStarted && window === window.top) {
  window.__xfhStarted = true;
  let controller: Controller | null = null;
  let reply: ReplyShortcut | null = null;
  let revision = 0;
  let latestState: PageState | null = null;
  let rateMonitor: RateLimitMonitor | null = null;
  let notices: View | null = null;
  let overlay: ReplyOverlay | null = null;
  let currentCooldown = 0;
  let featureEnabled = false;
  const applyCooldown = (until: number) => {
    currentCooldown = Math.max(currentCooldown, until);
    controller?.setCooldownUntil(currentCooldown);
    if (featureEnabled && currentCooldown > Date.now()) {
      notices ??= new View(document);
      notices.showCooldown(currentCooldown);
    }
  };
  const reportRateLimit = () => {
    // Optimistic UI blocks actions while the worker persists the shared deadline.
    applyCooldown(Date.now() + FOLLOW_COOLDOWN_MS);
    void chrome.runtime.sendMessage({ type: "xfh-rate-limit" }).then(result => {
      if (typeof result?.until === "number") applyCooldown(result.until);
    }).catch(() => notices?.notify("冷却同步失败，请重新加载扩展"));
  };
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === "xfh-recheck" && typeof message.handle === "string") {
      controller?.recheck(message.handle.toLowerCase());
      respond({ accepted: true });
    }
    if (message?.type === "xfh-page-state") {
      controller?.scan();
      respond(latestState);
    }
  });
  const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local") return;
    if (changes.enabled) {
      revision++;
      featureEnabled = changes.enabled.newValue !== false;
      controller?.setEnabled(changes.enabled.newValue !== false);
      reply?.setEnabled(changes.enabled.newValue !== false);
      rateMonitor?.setEnabled(changes.enabled.newValue !== false);
      if (changes.enabled.newValue === false) { notices?.destroy(); notices = null; }
      else applyCooldown(currentCooldown);
    }
    if (changes.cooldownUntil) {
      const until = changes.cooldownUntil.newValue;
      applyCooldown(typeof until === "number" ? until : 0);
    }
  };
  const start = () => {
    if (controller) return;
    const publishState = (state: PageState) => {
      latestState = state;
      void chrome.storage.session.set({ xfhPageState: state }).then(() =>
        chrome.storage.local.remove("xfhPageStateFallback").catch(() => {}),
      ).catch(() =>
        chrome.storage.local.set({ xfhPageStateFallback: state }).catch(() => {}),
      );
    };
    controller = new Controller(document, window, true, reportRateLimit, publishState, async (handle, action) => {
      const viewer = currentViewer(document);
      if (!viewer) throw new Error("无法确认当前账号");
      const tab = window.open("about:blank", "_blank");
      if (!tab) throw new Error("浏览器阻止了新标签页，请允许弹出窗口");
      await createExternalTask(viewer, handle, action);
      tab.location.href = `https://x.com/${handle}`;
    });
    reply = new ReplyShortcut(document);
    overlay = new ReplyOverlay(document);
    rateMonitor = new RateLimitMonitor(document, reportRateLimit, text => {
      notices ??= new View(document);
      notices.notify(`X 提示：${text}`);
    });
    chrome.storage.onChanged.addListener(changed);
    const initialRevision = ++revision;
    chrome.storage.local.get(["enabled", "cooldownUntil"]).then(data => {
      if (initialRevision === revision) {
        featureEnabled = data.enabled !== false;
        controller?.setEnabled(data.enabled !== false);
        applyCooldown(typeof data.cooldownUntil === "number" ? data.cooldownUntil : 0);
        reply?.setEnabled(data.enabled !== false);
        rateMonitor?.setEnabled(data.enabled !== false);
        void readExternalTask().then(async task => {
          if (!task || task.expiresAt <= Date.now()) return;
          const viewer = currentViewer(document);
          const target = location.pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase();
          if (viewer && viewer === task.viewer && target === task.target.toLowerCase()) {
            await controller?.executeExternalTask(task);
            await clearExternalTask(task.id);
          }
        });
      }
    }).catch(() => {
      controller?.setEnabled(false);
      reply?.setEnabled(false);
    });
  };
  const stop = () => {
    revision++;
    controller?.destroy();
    controller = null;
    reply?.destroy();
    reply = null;
    overlay?.destroy();
    overlay = null;
    rateMonitor?.destroy();
    rateMonitor = null;
    notices?.destroy();
    notices = null;
    chrome.storage.onChanged.removeListener(changed);
    void chrome.storage.local.remove("xfhPageStateFallback").catch(() => {});
  };
  start();
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", start);
}
