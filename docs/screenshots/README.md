# 演示截图 / Demo Screenshots

来源：`npm run test:browser` 实际加载 0.2.3 构建到隔离 Chromium，所有 X 请求均被本地虚构页面拦截。GitHub API 的403与公开订阅中的99.0.0版本均为模拟响应；冷却状态通过隔离扩展存储构造。作者头像使用扩展同梱素材。

更新流程：

```sh
npm run build
npm run test:browser
node scripts/update-screenshots.mjs
```

提交前人工检查截图，禁止换成包含私人账号、聊天内容或浏览器个人资料的截图。桌面视口 1280×900，窄窗口 390×844；popup 截图裁剪到真实面板区域。

Files: desktop-light, desktop-dark, narrow-light, unfollow-confirm, popup, popup-filtered, popup-cooldown. These are actual 0.2.3 extension renders over fictional fixtures, not evidence of live X operations. Version 99.0.0 and the active cooldown are simulated. Review regenerated images before committing.
