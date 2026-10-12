# 后续维护计划 / Roadmap

本页是待办与验收条件，不是发布日期承诺。完成后通过 PR、CHANGELOG 和 Release 记录实际结果。

| 优先级 | 工作 | 完成条件 |
| --- | --- | --- |
| 高 | 群聊关系字段实站核验 | 取得脱敏结构证据；字段缺失时保持未知；通过明确授权的测试账号验证 |
| 高 | 面板按标签页隔离 | 多个 X 标签页不同账号和路由不互相覆盖，面板明确对应来源 |
| 高 | session 失败的数据保留策略 | 移除或限制本地回退；补过期清理、异常退出与删除数据的验证 |
| 高 | Chrome / Edge 实站验收 | 安装、刷新、关注、回关、取关取消／确认及延迟回滚分别留证 |
| 中 | 独立 Enter 发送开关 | 用户可保留关系功能并单独关闭快捷发送；升级保留选择 |
| 中 | 界面及 X 语言支持 | 把中文硬编码界面拆出语言资源；逐种语言补原生控件测试 |
| 中 | 浏览器商店准备 | 商店素材、权限说明、隐私政策和审核结果齐全后再公告 |

## Maintenance Priorities

Live group-chat evidence; per-tab panel state; bounded fallback retention and data deletion; authorized real-site tests; a separate Enter-to-send switch; UI/native-control localization; store submission after validation. No delivery dates or store approval are promised.
