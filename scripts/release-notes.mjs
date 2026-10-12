import { mkdir, readFile, writeFile } from "node:fs/promises";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const changelog = await readFile("CHANGELOG.md", "utf8");
const section = changelog.split(/^## /m).find(text => text.startsWith(`[${version}]`));
if (!section) throw new Error(`Missing changelog for ${version}`);
await mkdir("release", { recursive: true });
await writeFile("release/NOTES.md", `## ${section.trim()}

### 安装 / Installation

下载对应浏览器的 ZIP，解压后在开发者模式下加载包含 manifest.json 的目录。更新时重新加载扩展并刷新 X，先处理未发送草稿。

Download the Chrome or Edge ZIP, extract it, then use Developer mode > Load unpacked. Reload the extension and refresh X after updates, handling unsent drafts first. Compare downloads with SHA256SUMS.

### 预览边界 / Preview status

群聊关系读取尚未完成实站验收。演示与自动测试使用虚构账号；没有把本地测试当作 X 服务端验收。启用扩展后 Enter 会发送单编辑器中的帖子或回复。面板状态目前跨标签页共享；session 不可用时存在本地存储回退。

Group-chat relationships remain unverified on the live site. Automated tests use fictional fixtures, not live X operations. Enter submits single-composer posts/replies when enabled. Panel state is shared across tabs; local-storage fallback may retain data across restarts.

MIT · [文档 / Documentation](https://github.com/Jiangshuo1109/XPremium-Helper/tree/v${version}-preview)

关注 / Follow [禁忌の小姜 @jiangza9](https://x.com/jiangza9)
`);
