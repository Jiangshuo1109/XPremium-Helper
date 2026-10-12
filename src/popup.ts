export {};

const enabled = document.querySelector<HTMLInputElement>("#enabled")!;
const status = document.querySelector<HTMLElement>("#status")!;
const cooldown = document.querySelector<HTMLElement>("#cooldown")!;
const progress = document.querySelector<HTMLElement>("#progress")!;
const search = document.querySelector<HTMLInputElement>("#search")!;
const filter = document.querySelector<HTMLSelectElement>("#filter")!;
const records = document.querySelector<HTMLElement>("#records")!;
const refresh = document.querySelector<HTMLButtonElement>("#refresh")!;
let cooldownUntil = 0;
type PageRecord = {
  handle: string; relationship: "unknown" | "not-following" | "following" | "requested";
  followsYou: boolean | null; blue: boolean | null; source: string;
};
type PageState = {
  discovered: number; verified: number; pending: number; failed: number; paused: boolean;
  records: PageRecord[];
};
let pageState: PageState = { discovered: 0, verified: 0, pending: 0, failed: 0, paused: false, records: [] };

function renderCooldown(): void {
  const seconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  if (seconds <= 0) {
    cooldown.textContent = "回关 CD 已结束，可以继续操作";
    return;
  }
  const minutes = Math.floor(seconds / 60);
  cooldown.textContent = `回关 CD：${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

async function load(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(["enabled", "cooldownUntil"]);
    try {
      const session = await chrome.storage.session.get("xfhPageState");
      if (session.xfhPageState) pageState = session.xfhPageState as PageState;
    } catch {
      const fallback = await chrome.storage.local.get("xfhPageStateFallback");
      if (fallback.xfhPageStateFallback) pageState = fallback.xfhPageStateFallback as PageState;
    }
    enabled.checked = data.enabled !== false;
    cooldownUntil = typeof data.cooldownUntil === "number" ? data.cooldownUntil : 0;
    renderCooldown();
    enabled.disabled = false;
    status.textContent = enabled.checked ? "已启用" : "已停用";
    renderPanel();
  } catch {
    status.textContent = "无法读取设置，请重新打开扩展";
  }
}

function label(record: PageRecord): string {
  if (record.relationship === "following") return record.followsYou === true ? "蓝朋友" : "取关";
  if (record.relationship === "requested") return "请求已发送";
  if (record.relationship === "not-following") return record.followsYou === true ? "回关" : "关注";
  return "待确认";
}

function matches(record: PageRecord): boolean {
  const query = search.value.trim().toLowerCase();
  if (query && !record.handle.includes(query)) return false;
  switch (filter.value) {
    case "can-follow": return record.relationship === "not-following" && record.followsYou !== true;
    case "follow-back": return record.relationship === "not-following" && record.followsYou === true;
    case "mutual": return record.relationship === "following" && record.followsYou === true;
    case "unfollow": return record.relationship === "following" && record.followsYou !== true;
    case "unknown": return record.relationship === "unknown" || record.followsYou === null;
    default: return true;
  }
}

function renderPanel(): void {
  progress.textContent = `已发现 ${pageState.discovered} · 已确认 ${pageState.verified} · 待处理 ${pageState.pending}`
    + (pageState.failed ? ` · 失败 ${pageState.failed}` : "")
    + (pageState.paused ? " · 用户操作中" : "");
  records.replaceChildren();
  for (const record of pageState.records.filter(matches).slice(0, 80)) {
    const row = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = `@${record.handle}`;
    const state = document.createElement("span");
    state.textContent = label(record);
    row.append(name, state);
    records.append(row);
  }
  if (!records.children.length) {
    const empty = document.createElement("li");
    empty.textContent = "当前页面暂无可显示的关系";
    records.append(empty);
  }
}

enabled.addEventListener("change", async () => {
  const value = enabled.checked;
  enabled.disabled = true;
  try {
    await chrome.storage.local.set({ enabled: value });
    status.textContent = value ? "已启用" : "已停用";
  } catch {
    enabled.checked = !value;
    status.textContent = "保存失败，请重试";
  } finally {
    enabled.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.cooldownUntil) {
    cooldownUntil = typeof changes.cooldownUntil.newValue === "number" ? changes.cooldownUntil.newValue : 0;
    renderCooldown();
  }
  if (area === "session" && changes.xfhPageState) {
    pageState = changes.xfhPageState.newValue as PageState ?? pageState;
    renderPanel();
  }
});
search.addEventListener("input", renderPanel);
filter.addEventListener("change", renderPanel);
refresh.addEventListener("click", async () => {
  try {
    const session = await chrome.storage.session.get("xfhPageState");
    if (session.xfhPageState) pageState = session.xfhPageState as PageState;
  } catch {
    const fallback = await chrome.storage.local.get("xfhPageStateFallback");
    if (fallback.xfhPageStateFallback) pageState = fallback.xfhPageStateFallback as PageState;
  }
  renderPanel();
});
setInterval(renderCooldown, 1000);
void load();
