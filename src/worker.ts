import { FOLLOW_COOLDOWN_MS, mergeCooldown } from "./cooldown";

// Serialize writes from all tabs; only this worker writes cooldownUntil.
let writes = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "xfh-rate-limit" || !sender.url?.startsWith("https://x.com/")) return;
  const detectedUntil = Date.now() + FOLLOW_COOLDOWN_MS;
  writes = writes.catch(() => {}).then(async () => {
    const data = await chrome.storage.local.get("cooldownUntil");
    const until = mergeCooldown(data.cooldownUntil, detectedUntil);
    await chrome.storage.local.set({ cooldownUntil: until });
    respond({ until });
  }).catch(() => respond({ error: "无法保存冷却时间" }));
  return true;
});

// Content scripts need explicit access to the short-lived session area.
void chrome.storage.session.setAccessLevel({
  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
}).catch(() => {});
