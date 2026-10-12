# 贡献指南 / Contributing

欢迎选择器修复、可复现问题、测试和翻译。请先阅读 [README](README.md)、[技术说明](docs/需求与技术说明.md)和[验证记录](docs/验证记录.md)。

## 开发步骤

1. Fork 仓库并创建独立分支；使用 Node.js 22+ 和 `npm ci`。
2. 修复关系识别或操作逻辑时，先用虚构账号补充能复现问题的测试。
3. 执行 `npm run check`、`npm run check:release`；涉及页面行为时执行 `npm run test:browser`。
4. 在 PR 中说明触发条件、修改后的行为、验证结果与未覆盖场景。
5. 用户可见的变化写入 `CHANGELOG.md` 的 Unreleased；同步五语 README，或明确列出尚未同步的翻译。

不要提交 `node_modules`、`dist`、`release`、浏览器个人资料、真实页面备份、聊天内容或凭据。公开截图应来自可复现的虚构样例，放入 `docs/screenshots/`。

## 产品边界

关系不明确时保持未知；身份冲突时停止操作。真实输入触发单次操作，取关需要确认。不要新增批量关注、互动刷量、自动私信或绕过平台限制的逻辑。外部贡献应保留这些边界。

样例页面通过和真实 X 验收分开记录。不用普通用户账号做反复关注／取关测试。真实行为测试必须由账号所有者明确授权。

## English

Fork and work on a branch. Install with `npm ci` on Node.js 22+. Add fictional fixtures for relationship and action regressions; run `npm run check` and `npm run check:release`, plus `npm run test:browser` for UI changes.

Describe the trigger, resulting behavior, evidence, and remaining gaps in the PR. Update Unreleased and affected translations. Never commit credentials, personal browser profiles, conversations, real account lists, or generated build folders.

Preserve user-triggered single actions, unknown-state handling, identity checks, and unfollow confirmation. Do not add bulk engagement, automatic DMs, or limit evasion. Fixture success must not be presented as live-site acceptance. Contributions are distributed under the repository's MIT license.
