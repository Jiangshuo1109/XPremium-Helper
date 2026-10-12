# 隐私说明 / Privacy

适用版本：0.2.1。更新日期：2026-10-12。

## 读取什么

扩展在 `https://x.com/*` 读取当前登录账号标识、页面头像与个人主页链接、蓝 V 标记、关注关系及原生操作控件。回复快捷键判断编辑器和发送按钮状态，不建立帖子或私信内容档案。不访问 Cookie，不读取其他站点，不调用私有 API。

## 存储什么

| 位置 | 字段／内容 | 保留与清理 |
| --- | --- | --- |
| 页面内存 | 已核实关系、读取队列、临时 DOM 状态 | 关系缓存一分钟；页面生命周期和账号变化会触发清理 |
| `storage.local` | `enabled`、`cooldownUntil` | 跨会话保留开关和冷却截止时间 |
| `storage.session` | `xfhPageState`：账号 handle、关系、反向关注、蓝 V、来源及统计 | 最近一次上报覆盖旧值，多个标签页共用；会话结束后由浏览器清理 |
| `storage.session` | `xfhExternalAction`：任务 ID、当前账号、目标账号、操作、时间等 | 有效期30秒；执行或读取到过期任务时清理，过期不代表立即物理删除 |
| `storage.local` 回退 | `xfhPageStateFallback`、`xfhExternalActionFallback` | session 访问失败时使用，可能跨重启保留；成功 session 写入、页面退出或任务清理只覆盖相应路径，不保证异常退出后立即删除 |

停用扩展不等于清空全部存储。当前没有“一键删除数据”按钮；要完整删除扩展保存的数据，可在浏览器扩展管理页移除扩展。自行使用开发者工具时应同时检查 local 与 session 区域。

## 数据流向

扩展没有自建服务器、遥测或分析 SDK，不向维护者上传关系或聊天数据。关注、取关、发帖仍通过 X 原生页面发送到 X，受 X 自身的数据处理规则约束。点击作者链接或 GitHub 链接会访问对应网站。

请勿在公开 Issue、截图或日志中上传真实聊天、完整账号列表、Cookie、令牌、密钥及私人路径。演示截图仅使用虚构测试数据。

## English

The extension reads account identity, avatar/profile links, blue-badge evidence, relationships, and native controls on `https://x.com/*`. It has no telemetry, cookie access, private API calls, or backend. It does not maintain an archive of posts or DMs.

Settings and cooldown deadlines persist in local storage. Relationship summaries (handles, relationship flags, badge evidence, source, and counts) and one-time profile tasks prefer session storage. If session access fails, they fall back to local storage and may survive a browser restart. Cleanup is conditional; a task's 30-second validity is not a guarantee of immediate physical deletion. Multiple X tabs currently share the last-reported summary.

Disabling is not deletion. Remove the extension through browser settings to remove its stored data. There is no built-in “delete all data” button yet. Actions made through X controls still go to X. Following author or GitHub links visits those services. Do not attach private account data or credentials to public reports.
