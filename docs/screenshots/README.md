# 演示截图 / Demo Screenshots

来源：`npm run test:browser` 实际加载当前构建到隔离 Chromium，所有 X 请求均被本地虚构页面拦截。

更新流程：

```sh
npm run build
npm run test:browser
node scripts/update-screenshots.mjs
```

提交前人工检查截图，禁止换成包含私人账号、聊天内容或浏览器个人资料的截图。桌面视口 1280×900，窄窗口 390×844；popup 截图裁剪到真实面板区域。

Files: desktop-light, desktop-dark, narrow-light, unfollow-confirm, popup, popup-filtered. These are real extension renders over fictional fixtures, not evidence of live X operations. Review regenerated images before committing.
