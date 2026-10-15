# Agent 交付规则

## 每次更新必须同步 GitHub

每次完成代码、界面或功能更新后，交付前必须完成以下事项：

1. 更新 `CHANGELOG.md` 的 `Unreleased` 或对应版本条目。
2. 同步更新五份 README：`README.md`、`README.en.md`、`README.es.md`、`README.ja.md`、`README.pt-BR.md`。
3. 运行 `npm run check:release`，确认 `package.json`、`package-lock.json`、`public/manifest.json`、CHANGELOG 和 README 版本一致。
4. 运行 `npm run check`、`npm run test:browser`，再运行 `npm run package` 生成 Chrome、Edge 安装包和 `SHA256SUMS`。
5. 将源码、README、CHANGELOG、版本标签和 Release 资产更新到 GitHub。预览版使用 `v<version>-preview` 标签。
6. 发布完成后回读 GitHub 远端提交、Release 状态、三份附件、安装包 manifest 和 SHA-256 清单。只完成本地构建或推送标签，不能视为 Release 资产已经发布。
7. README、Release notes 和安装文档中的版本、下载文件名、预览版状态必须一致。不能只更新源码而遗漏 README 或 Release 资产。

如果真实 X 页面、Chrome/Edge 安装或 GitHub Release 仍有未完成验证，必须在交付说明中明确写出，不能用本地测试或本地 ZIP 代替。
