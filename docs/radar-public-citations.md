# 经核验的公开引用

`schemaVersion: 1`、`report.version: 1`、原子导入和云端发布入口保持不变。精确[官方注册表](radar-official-sources.md)仍提供默认官方识别。未在表中的公开论文、博客、社区、论坛及新闻无需逐域名改代码，但必须在 source 上登记 `review`。官方技术报告若来自未登记域名，也按实际资料类别登记，不自行声明 `official`。

## source 字段

以下是单个 source 的结构示例，不是可直接导入的完整记录；URL、日期、publisher 和 note 均须由检索任务按实际原文填写。`unverified` 表示尚未核对原文陈述，不能当成已完成阅读的报告证据。

```json
{
  "title": "论文标题",
  "url": "https://arxiv.org/abs/2309.06180",
  "publishedAt": "2023-09-12",
  "accessedAt": "2026-10-03",
  "review": {
    "category": "paper",
    "publisher": "arXiv",
    "status": "unverified",
    "note": "字段演示；尚未完成原文核对，不应据此声称结果已验证。",
    "peerReview": "unknown"
  }
}
```

| review 字段 | 值 / 规则 |
| --- | --- |
| category | `paper`、`community`、`blog`、`news`；不能填写 `official` |
| publisher | 实际刊物、网站、作者博客或社区名称，1–100 字；不冒用项目品牌 |
| status | `attributed`：已阅读并核对原文确实这样陈述；`unverified`：陈述尚待核对。两者都不表示结果已独立验证 |
| note | 1–1200 字，说明读了哪些部分、作者/版本/日期核验、主要证据与限制、尚未复现的结果；勿仅写“reviewed” |
| peerReview | 论文必填 `preprint`、`peer-reviewed`、`unknown`；其他类别不可填写。须核对所引用版本及会议/期刊出版记录，未知不能猜为已同行评审 |

登记 review 时 `accessedAt` 必填，是实际核验/查阅日期，不得晚于记录 `reviewedAt`；第一来源仍须有真实 `publishedAt`，且等于记录发布日期。论文作者实验结果应写明“论文作者报告……、尚未独立复现”，不能套用官方产品结论。登记为 `attributed` 前，任务须真正读到支持该段陈述的原文；登记字段本身不是核验证据。

GitHub issue、discussion、PR 下的社区评论即使位于注册仓库，也必须 `category: community`。个人 fork、公开论坛和第三方文章不继承仓库或品牌的官方身份。列表显示 publisher 和类别，论文显示同行评审状态；资料区显示核对状态及完整 note，报告证据链接可查看相同信息。

## 报告与摘记的依据等级

- `basis: official` 仅可引用未被改分类的精确官方注册来源；非官方引用不能通过 review 升级。
- `basis: author` 可以引用已核对的 `attributed` 原文陈述，呈现作者/报道方报告的结果；`unverified` 引用不能使用这个等级。
- `basis: inference` 用于明确标注的推导、假设和原创教学示例；`pending` 用于尚未核对或待复现的问题。若引用 unverified，须保留不确定性，不将猜测写成事实。
- 摘记 `claims.status: confirmed` 仅可使用官方注册证据；非官方引用使用 `inference` 或 `pending` 并在 text 明确归因。更完整的作者结果应放入 `report` 的 author 段落/表格行。若官方资料可佐证某项事实，把它登记为独立 source，并使事实段落指向实际支持该事实的官方来源。

导入器验证结构和等级一致性，无法自动证明论文、新闻或官方资料的每个陈述为真。权威性、作者身份、实验有效性、交叉验证和推测边界仍由检索任务负责。不能靠“已核对”字段替代读取和证据定位；检索片段不足时继续查询或标为待验证，不虚构摘要，不增加新实验结果。

## URL 与公开范围

只接受 HTTPS 域名；拒绝用户名密码、非默认端口、IP 字面量（包括公网 IP、IPv6、数字/八进制等变体）、localhost、单标签主机、常见内网/本机域名及 IP 映射别名。未提供 review 的来源仍受官方精确域名和路径限制。

非官方引用支持 OpenReview、Hacker News 等公开文献标识参数：`id`、`p`、`v`、`doi`、`paper`、`paperId`、`article`、`articleId`、`page`（键大小写不影响允许判断，但保留实际拼写）。值须为 1–160 字的 ASCII 字母/数字及 `. _ / -`，以字母或数字开始，键不重复；例如 `https://openreview.net/forum?id=Paper123`。参数排序保证幂等。认证、签名、session、跟踪、重定向及其他未知参数一律拒绝；清除 tracking，勿清除文献身份所需 id。review 引用保留安全内容锚点，以便定位社区评论；锚点不能携带认证或脚本参数。原官方 URL 的旧规范化规则保持不变。

校验器**不联网、不解析 DNS、不抓取或执行来源代码**，也不注入来源的 HTML。静态域名检查不能保证 DNS 当前解析到公网，也不能发现后续重定向、受限内容或域名伪装。检索任务必须核验公开访问范围、实际发布者、DNS/访问目标与重定向最终地址；不得读取或发布本机/私网资源、带访问凭证的链接、公司日志、客户数据或私人笔记。引用最终公开 URL，不用公开入口包装私人资源。

只整理公开资料的原创解读及必要短引文，保留原文链接和日期，不整文转载。完整记录沿用[报告格式](radar-report-format.md)和[现有发布通道](radar-publishing.md)，不增加抓取调度、凭证或权限。
