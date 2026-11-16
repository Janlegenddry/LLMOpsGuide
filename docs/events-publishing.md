# AI Infra 活动维护

页面 `/LLMOpsGuide/events/`，只读 API `/LLMOpsGuide/api/events.json`。沿用当前 Astro 和 Pages，不走 radar payload，也不创建调度或报名服务。

后续普通更新只编辑 `src/content/events.json`。输入为数组，稳定 `id` 更新原条目；不要另起 ID 重复同一官方活动页。每条须有 `schemaVersion: 1`、`publicationApproved: true`、`containsPrivateData: false`，仅包含公开活动信息，不保存个人身份、行程或报名数据。当前完整记录可作输入示例。

- `scope: local`：线下仅杭州、杭州周边、深圳、上海。`region` 为 `hangzhou / hangzhou-nearby / shenzhen / shanghai`；周边活动须在 `scopeNote` 写明范围依据并人工核对，不能用此值包装其他地区。
- `scope: online`：地区不限，但须核验公开直播 URL，`livestream.status: available`、`publicAccess: true`。会场内屏幕转播、未发布回放不满足此条件。
- `scope: archive`：仅限明确批准的已结束例外，`region: null`、`archiveExceptionApproved: true`，说明保留理由。首发 SGLang Summit 属于这一例外。其他本地已结束活动可继续保留为 local。
- `startDate / endDate` 为活动当地真实日期，`timeZone` 为 IANA 时区。`startAt / endAt` 仅在公开时刻已确认时填写带 UTC 偏移的 ISO 字符串（如 `2026-11-28T09:00:00+08:00`），否则填 `null`。时刻和当地日期必须一致。只有日期时只显示当地日历天数；取消、活动当天、进行中和结束不显示负倒计时。
- `status` 为 `scheduled / cancelled`。结束状态按当地时间计算，不改原始活动日期。页面每分钟及返回页面时刷新倒计时，无 JavaScript 仍保留日期、全部卡片与官方链接。
- `registration.status` 为 `qr / link / closed / unconfirmed`。`deadline` 未确认填 `null`；已确认可填日期或带偏移的时刻，页面另给报名倒计时。报名链接可见不等于当前仍有名额或无需审核。二维码只引导到官方页，不复制、不自动扫码。
- `livestream / replay` 分别记录 `status: unconfirmed / pending / available`、`url`、`publicAccess`、`note`；available 必须有已核验公开链接，其余 URL 为 `null`。回放计划不等于已经发布。
- `officialUrl`、`agendaUrl`、报名、直播、回放须分别保留实际官方链接；未确认 `agendaUrl` 填 `null`。`sources` 包含官方活动页。只允许公开 HTTPS，拒绝凭证、内网、IP 和追踪参数；新的合法参数先审查，不改 URL 伪装通过。
- `verifiedAt` 是核验日期，不能当活动日或报名截止。不要凭旧文章推断当前开放，不报告未核实票价、余票、时刻、直播或回放；不代报名、不联系主办方。

使用 Node 24：

```sh
npm test
npm run build
npm run events:verify
npm run content:verify
npm run jobs:verify
npm run library:verify
git diff --check
```

核对桌面与窄屏、筛选/清除/刷新/返回、活动与报名倒计时、时区、明暗主题、官方链接与空态。无法实际浏览器验收时明确记录未测范围，不把静态检查称为实测。

发布前检查最新 main、工作树和运行中 Actions，同仓库唯一写入者串行操作。普通维护仅提交 `src/content/events.json`，`git push origin main` 触发现有 `deploy.yml`；首次实现同时提交必要代码和文档。不要强推、不要重发结果不明的写入。等待该 commit 的 Build and publish knowledge base 与对应 gh-pages 的 Pages 成功，完整读取线上 events API 和页面，对比构建字节/哈希及整个对象。radar/jobs 数据保持不变。
