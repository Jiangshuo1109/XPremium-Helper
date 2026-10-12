import { summarize } from "./statistics";
import { checkUpdate, newer } from "./updates";
import type { PageState, PageStateRecord } from "./model";

const enabled = document.querySelector<HTMLInputElement>("#enabled")!;
const status = document.querySelector<HTMLElement>("#status")!;
const cooldown = document.querySelector<HTMLElement>("#cooldown")!;
const progress = document.querySelector<HTMLElement>("#progress")!;
const search = document.querySelector<HTMLInputElement>("#search")!;
const filter = document.querySelector<HTMLSelectElement>("#filter")!;
const records = document.querySelector<HTMLElement>("#records")!;
const refresh = document.querySelector<HTMLButtonElement>("#refresh")!;
let cooldownUntil = 0;
type PageRecord = PageStateRecord;
const emptyState: PageState = { viewer: null, route: "", updatedAt: 0,
  discovered: 0, verified: 0, pending: 0, failed: 0, paused: false, records: [] };
let pageState = emptyState;
let targetTab: number | undefined;

async function readPage(): Promise<void> {
  try {
    targetTab ??= (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    pageState = targetTab === undefined ? emptyState
      : await chrome.tabs.sendMessage(targetTab, { type: "xfh-page-state" }) ?? emptyState;
  } catch { pageState = emptyState; }
  renderPanel();
}

function renderCooldown(): void {
  const seconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  if (seconds <= 0) {
    cooldown.textContent = cooldownUntil ? "建议冷却已结束，以 X 为准" : "暂无冷却";
    return;
  }
  const minutes = Math.floor(seconds / 60);
  cooldown.textContent = `建议冷却：${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

async function load(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(["enabled", "cooldownUntil"]);
    await readPage();
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
  const counts = summarize(pageState.records, pageState.viewer);
  const statistics = document.querySelector("#statistics")!;
  statistics.replaceChildren();
  const dimensions: Array<[string, number]> = [
    ["识别账号", counts.total], ["已关注", counts.following], ["关注你", counts.followers],
    ["待回关", counts.followBack], ["互关", counts.mutual], ["明确未回关", counts.unilateral],
    ["关系待确认", counts.unknown], ["请求已发送", counts.requested], ["已识别蓝 V", counts.blue],
  ];
  for (const [label, count] of dimensions) {
    const group = document.createElement("div"), title = document.createElement("dt"),
      value = document.createElement("dd");
    title.textContent = label; value.textContent = String(count);
    group.append(title, value); statistics.append(group);
  }
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
});
search.addEventListener("input", renderPanel);
filter.addEventListener("change", renderPanel);
refresh.addEventListener("click", () => void readPage());
const updateButton = document.querySelector<HTMLButtonElement>("#check-update")!;
async function renderUpdate(force = false): Promise<void> {
  updateButton.disabled = true;
  const text = document.querySelector("#update-status")!;
  text.textContent = "正在检查版本";
  const link = document.querySelector<HTMLElement>("#download-update")!;
  link.hidden = true;
  try {
    const result = await checkUpdate(force);
    const available = result.version && newer(result.version, chrome.runtime.getManifest().version);
    text.textContent = result.error ?? (available ? `发现新版 ${result.version}`
      : result.version ? newer(chrome.runtime.getManifest().version, result.version)
        ? `本地版本领先；公开版本 ${result.version}` : "当前已是最新发布版本"
        : "暂无公开版本");
    link.hidden = !available;
    text.setAttribute("title", `检查时间：${new Date(result.checkedAt).toLocaleString()}；来源：${result.source === "feed" ? "GitHub 公开版本订阅" : "GitHub API"}；下载后需手动重新加载扩展`);
  } catch { text.textContent = "检查失败，请稍后重试"; }
  finally { updateButton.disabled = false; }
}
document.querySelector(".version")!.textContent = chrome.runtime.getManifest().version;
updateButton.addEventListener("click", () => void renderUpdate(true));
setInterval(() => void readPage(), 2000);
setInterval(renderCooldown, 1000);
void load();
void renderUpdate();
