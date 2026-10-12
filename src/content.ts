import { Controller } from "./controller";
import { ReplyShortcut } from "./reply-shortcut";
import { currentViewer } from "./adapter";
import { clearExternalTask, createExternalTask, readExternalTask } from "./task";
import type { PageState } from "./model";

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
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === "xfh-page-state") {
      controller?.scan();
      respond(latestState);
    }
  });
  const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local") return;
    if (changes.enabled) {
      revision++;
      controller?.setEnabled(changes.enabled.newValue !== false);
      reply?.setEnabled(changes.enabled.newValue !== false);
    }
    if (changes.cooldownUntil) {
      const until = changes.cooldownUntil.newValue;
      controller?.setCooldownUntil(typeof until === "number" ? until : 0);
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
    controller = new Controller(document, window, true, until => {
      void chrome.storage.local.set({ cooldownUntil: until });
    }, publishState, async (handle, action) => {
      const viewer = currentViewer(document);
      if (!viewer) throw new Error("无法确认当前账号");
      const tab = window.open("about:blank", "_blank");
      if (!tab) throw new Error("浏览器阻止了新标签页，请允许弹出窗口");
      await createExternalTask(viewer, handle, action);
      tab.location.href = `https://x.com/${handle}`;
    });
    reply = new ReplyShortcut(document);
    chrome.storage.onChanged.addListener(changed);
    const initialRevision = ++revision;
    chrome.storage.local.get(["enabled", "cooldownUntil"]).then(data => {
      if (initialRevision === revision) {
        controller?.setEnabled(data.enabled !== false);
        controller?.setCooldownUntil(typeof data.cooldownUntil === "number" ? data.cooldownUntil : 0);
        reply?.setEnabled(data.enabled !== false);
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
    chrome.storage.onChanged.removeListener(changed);
    void chrome.storage.local.remove("xfhPageStateFallback").catch(() => {});
  };
  start();
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", start);
}
