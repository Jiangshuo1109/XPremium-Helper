import { FOLLOW_COOLDOWN_MS, mergeCooldown } from "./cooldown";
import { requestReply } from "./reply-service";
import type { ModelConfig, ReplyContext } from "./reply-model";

// Serialize writes from all tabs; only this worker writes cooldownUntil.
let writes = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === "xfh-generate-reply" && message.context) {
    if (sender.id !== chrome.runtime.id ||
      !(sender.url?.startsWith("https://x.com/") || sender.url?.startsWith(chrome.runtime.getURL("")))) return;
    void generateReply(message.context as ReplyContext).then(
      text => respond({ text }),
      error => respond({ error: error instanceof Error ? error.message : "生成失败" }),
    );
    return true;
  }
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

async function generateReply(context: ReplyContext): Promise<string> {
  const data = await chrome.storage.local.get("modelConfig");
  const config = data.modelConfig;
  if (!config || typeof config !== "object") throw new Error("请先在扩展弹窗配置模型接口");
  if (!context || typeof context.topic !== "string" || typeof context.handle !== "string" ||
    typeof context.name !== "string" || !context.topic.trim()) throw new Error("回复上下文无效");
  return requestReply(config as ModelConfig, context,
    origin => chrome.permissions.contains({ origins: [origin] }));
}

// Content scripts need explicit access to the short-lived session area.
void chrome.storage.session.setAccessLevel({
  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
}).catch(() => {});
