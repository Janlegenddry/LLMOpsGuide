# AI Infra 社招岗位

入口为 `/LLMOpsGuide/jobs/`，公开 JSON 为 `/LLMOpsGuide/api/jobs.json`。栏目与技术报告独立，避免招聘信息混入学习知识索引。首页、侧栏、动态与解读均可进入。

## 收录规则

- 维护 `src/content/jobs.json`；新增岗位用稳定 ID，复核时更新原条目，不重复收录。
- 优先官方岗位详情；招聘平台与社区来源须明确标注。只有真实核验到官方申请入口时才记 `open`，不能以搜索摘要、发布日期较新或公司正在招聘代替核验。
- `verifiedAt` 是核验日期；`postedAt` 仅填原页明确披露的发布日期，未知用 `null`。原页更新时间写在 `statusNote`，不得当作发布日期。
- `status`：`open` 为核验时可申请，`review` 为待复核，`closed` 为已结束。距离核验超过 30 天的 `open` 在页面自动显示“待复核”。JSON 保留原核验事实，消费方须根据日期判断时效。
- 来源只记录公开 HTTPS 原始链接，不加入登录令牌、追踪、推荐或带凭证链接。提供经验、地点和申请限制的准确范围。
- `priority` 是通用技术方向的关注优先级（`strong` / `related` / `stretch`），`matchReasons` 和 `gaps` 为岗位要求与准备项，不能包含个人任职、薪酬、工作许可、私人项目、求职状态或对个人能力的推断。
- `publicationApproved: true`、`containsPrivateData: false` 明确记录公开范围。字段校验不能代替人工核对隐私和来源。

## 字段

除上述字段外，每条包含 `schemaVersion: 1`、`id`、`company`、`title`、`locations`、`category`、`level`、`summary`、`skills`、`url`、`sourceName`、`sourceType`、`statusNote`。技术方向有 `inference`、`sre`、`platform`、`training`、`kernel`；来源有 `official`、`board`、`community`。数组不得为空；未知经验或限制应明写“原页未明确，需确认”。

## 验证与发布

使用 Node 24，运行 `npm test`、`npm run build`、`npm run content:verify`、`npm run library:verify`、`npm run jobs:verify` 和 `git diff --check`。浏览器核对筛选/清空/刷新/返回、详情展开、桌面与窄屏、明暗主题。无 JavaScript 时岗位和原始链接仍可访问。

通过后推送现有 `main`，跟踪对应 commit 的 GitHub Actions 与 Pages 发布，再核对线上 `/jobs/` 及公开 JSON。不得并发覆盖其他内容发布；发布前检查工作树、远端和运行中的工作流。
