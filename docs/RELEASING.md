# 版本发布流程 / Releasing

本仓库使用三段数字版本，并以 Git 标签后缀标明预览状态：包版本 `0.2.1` 对应标签 `v0.2.1-preview`。扩展 manifest 不使用带连字符的版本号。当前发布工作流只接受预览版本，正式版本发布需要另行调整验收与流程。

## 日常更新

- 修复和文档维护增加 patch；新增兼容功能增加 minor；不兼容变化单独说明。
- 每个 PR 运行 CI，更新 Unreleased，保留“模拟页面通过”和“真实站点通过”的区别。
- Dependabot 每周提出 npm 和 Actions 依赖更新 PR，不自动合并或自动升级用户的扩展。
- 用户通过 Releases 或作者账号了解更新；后续维护仍需要实际开发与验收。

## 发布一个预览版

```sh
# 在干净的 main 上更新；不要手工只改其中一个版本文件。
npm version patch --no-git-tag-version
# 把 Unreleased 整理为新版本条目，更新五语 README 的版本与行为。
npm run check:release
npm run check
npm run test:browser
npm run package
git add package.json package-lock.json public/manifest.json CHANGELOG.md README*.md
git commit -m "chore: prepare preview release"
git push origin main
# 将示例替换为 package.json 中的实际版本。
git tag -a v0.2.2-preview -m "XPremium Helper 0.2.2 preview"
git push origin v0.2.2-preview
```

`npm version` 会运行 `scripts/sync-version.mjs` 同步 manifest。发布检查会拒绝标签、package、lockfile、manifest 或 CHANGELOG 不一致的版本。

标签触发 `.github/workflows/release.yml`：

1. 安装锁定依赖，检查版本，运行类型检查、单元测试和构建。
2. 安装 Chromium，在隔离样例页执行浏览器回归。
3. 打包 Chrome / Edge ZIP，生成 SHA-256 清单。
4. 先创建 draft release、上传两份 ZIP 和校验文件，再公开为 **Pre-release**。失败时不把缺附件的草稿当作已发布。
5. 将浏览器报告保存为 Actions artifact。该报告不代表真实 X 通过。

工作流使用 GitHub 提供的 `GITHUB_TOKEN`，不需要维护者把 PAT 写入仓库。发布任务才拥有 `contents: write` 权限。

## 发布后回读

检查 Actions 成功、Release 为预发布且包含三份附件、安装包的 manifest 与标签一致、校验文件匹配。用新目录加载包，确认文档与图片可用。不要仅凭 tag 推送成功声称发行包已发布。

已发布标签不得移动或覆盖。若发布失败，修复后使用新的 patch 版本；若只是草稿上传中断，可核对草稿后重新运行任务。错误公开版本应标记撤回说明并发布替代版本，不悄悄替换安装包。

## English

Use numeric package versions and `v<version>-preview` tags. Bump with `npm version patch --no-git-tag-version`, update CHANGELOG and all READMEs, run checks, commit, push, then tag. The version script synchronizes the manifest. CI verifies metadata and isolated Chromium behavior before packaging.

The release workflow creates a draft, uploads both browser archives and `SHA256SUMS`, then publishes a prerelease. Inspect the public release and download checksums afterward. Never move a published tag. Dependency PRs are weekly and require review; installed unpacked extensions still update manually.
