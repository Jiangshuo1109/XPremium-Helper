# 更新记录 / Changelog

仅将实际发布的版本标记为 Release；历史条目来自本地开发记录，不代表当时已在 GitHub 发布。预览版标签统一使用 `v<version>-preview`。

## [Unreleased]

- 尚无已合入变更。待办见 [ROADMAP](docs/ROADMAP.md)。

## [0.2.2] - 2026-10-12

- GitHub 入口使用官方 Octicons 标志；冷却状态统一为 13px。
- 当前标签页按账号去重展示九项关系统计；反向未知不计入明确未回关。
- 打开弹窗自动检查 GitHub 公开版本，缓存六小时，支持手动检查和下载入口；不会自动安装。
- 新增 GitHub API 主机权限；版本检测不发送 X 账号或关系数据。

## [0.2.1] - 2026-10-12

### 开源与维护 / Open-source preparation

- 添加 MIT 协议、中英西日葡五语 README 与虚构数据功能截图。
- 统一作者入口为「禁忌の小姜 @jiangza9」。
- 添加隐私说明、贡献指南、安全报告指引、问题模板与维护计划。
- 添加 CI、标签触发的预发布流程、版本一致性检查和安装包校验文件。
- 如实记录 local 存储回退、多标签页状态共享与群聊实站未验收的限制。
- 安装包包含许可、五语文档和功能截图；没有扩展新增权限或关系操作范围。
- 更新 Vitest 测试工具链，处理依赖审计发现的已知漏洞。
- 增加仓库级中英免责声明，并在各语言 README 与预览包中提供入口。

MIT license; five-language documentation and fixture screenshots; author links; CI and tag-based preview releases; version consistency checks; privacy and contribution documents. No new extension permissions or relationship actions.

## [0.2.0] - 2026-10-11

- 关系事实与可执行原生控件分离。
- 增加有明确关系字段时的群聊资料页单次任务，30秒有效期。
- 弹窗增加识别进度、账号搜索、关系筛选和作者入口。
- 真实群聊关系字段仍未验收，不把结构测试视为实站支持。

## [0.1.3] - 2026-10-11

- 增加「蓝朋友」标签、20人预检查队列和短期关系缓存。
- 读取时优先用户操作；增加关注者／正在关注列表适配。

## [0.1.2] - 2026-10-11

- 按可识别蓝 V 筛选关注／回关入口，区分三种操作颜色。
- 新增资料卡临时裁剪与 Enter 发帖支持。

## [0.1.1] - 2026-10-11

- 新增 Enter 回复、Shift+Enter 换行、输入法和重复按键保护。
- 改进资料卡读取与 XChat 头像结构识别。

## [0.1.0] - 2026-10-11

- 初始本地预览：头像快捷入口、身份核验、取关确认及 Chrome / Edge 构建。
