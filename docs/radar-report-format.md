# 完整解读报告接口

沿用 `src/content/radar.json`、`schemaVersion: 1` 和既有导入 / 发布命令。在完整记录上增加可选 `report`，无需新接口或调度。可执行示例是 [radar-report-record.json](../examples/radar-report-record.json)，它包含一篇完整报告，原样重复导入应为 `unchanged`。

```json
{
  "schemaVersion": 1,
  "id": "sglang-v0-5-21",
  "report": {
    "version": 1,
    "scope": "资料核对范围、版本日期、哪些实验尚未执行",
    "sections": [
      {
        "id": "conclusion",
        "title": "结论：先证明交接安全，再证明优化有效",
        "blocks": [
          {"type": "paragraph", "basis": "inference", "sourceIndices": [], "text": "完整原创解释段落，可保留换行。"}
        ]
      }
    ]
  }
}
```

上面只展示增量结构；实际 payload 必须保留完整记录的原字段和下列九个章节。不要只发送这个片段。

| section.id | 内容 |
| --- | --- |
| conclusion | 结论摘要、读者应采取的判断 |
| background | 问题背景、成绩与负载范围 |
| mechanism | 充分解释原理，至少一张机制图 |
| evidence | 关键改动和证据，至少一张证据表 |
| tradeoffs | 取舍、适用负载与不能外推的边界 |
| production | 原创故障假设及对应诊断证据 |
| experiments | 待执行验证，至少一张实验矩阵 |
| acceptance | 指标口径和预定义验收，至少一张表 |
| pending | 未验证项、版本与复现未知 |

章节可按教学顺序排列，各 ID 必须恰好出现一次。站点直接在原详情 URL 渲染长文、目录、SVG 图和表格；列表显著显示“阅读完整报告”。无 `report` 的阅读清单明确显示“尚未解读”。

## 正文块

`basis` 为 `official`（官方事实）、`author`（作者报告结果）、`inference`（推导 / 教学示例）、`pending`（待验证）。`sourceIndices` 是记录 `sources` 的零基索引；官方事实和作者结果至少有一个有效来源。教学图必须说明是原创示意及非实测边界。

| type | 额外字段 | 说明 |
| --- | --- | --- |
| paragraph | text | 原创长段落；每段最多 20000 字符 |
| list | items: string[] | 完整解释或待验证清单 |
| callout | title, text | 带小标题的原理或边界说明 |
| code | language, text | 纯文本代码 / 公式，语言为 text/bash/python/json/promql |
| table | caption, columns, rows | 表格本身不带 basis；每行 `{cells, basis, sourceIndices}`，cells 与 columns 等长 |
| diagram | title, caption, nodes, edges | 自动生成 SVG，不接收原始 SVG / HTML |
| bars | title, caption, unit, series | 对比时间条图，教学数字应标 inference |

图节点：`{id, label, detail, column, row}`。节点 ID 唯一；column / row 为 0–3 的整数，不可重叠；label 最多 40 字符，充分解释写在 detail。图连线：`{from, to, label}`，必须指向不同的现有节点。完整节点与关系解释放在可展开注释中。旧坐标图继续支持，手机以可读的节点列表及关系说明显示。

技术图可选 `presentation: {kind, panels: [{title, tone, nodeIds}]}`。分组必须恰好覆盖全部节点一次，不能引用不存在或重复节点。站点根据语义分组生成原创 SVG；桌面适合阅读栏宽度，手机拆分面板或改为纵向布局，无需横向拖动。节点可选 `shortLabel`、`subtitle`、`tone`，连线可选 `shortLabel`，图内短文字不替换原始 label / detail。推荐短标题 2–8 字、副标题 4–12 字；完整计算语义继续写在原字段中。

| presentation.kind | panels 的节点数量 | 用途 |
| --- | --- | --- |
| request-lanes | 2 / 2 / 5 | 入口、P 实例、D 实例；D 内草稿、验证、提交回路 |
| lifecycle | 4 / 4 | 风险与保护两条生命周期 |
| boundary | 3 / 3 | 跨阶段计算责任对比 |
| cache-routing | 2 / 2 / 1 | 入口、核心分支、共同状态 |
| pipeline-loop | 3 / 3 | 普通及投机 PP 回传 |
| memory-budget | 1 / 4 / 1 | 总预算、四类共同扣减、KV 余量；面积不表示未测占比 |
| decision-gates | 1 / 1 / 1 / 1 | 质量、SLO、效率、负载选择 |
| paths | 2 / 2 | 两条计算路径对比 |

语义色 `compute / kv / communication / control / danger / neutral` 分别用于计算、KV、通信、控制、风险及普通状态。分组顺序定义绘图角色，例如 request-lanes 的 D 分组顺序为生成循环、草稿、验证、提交、响应。确认图与完整 edges 的语义一致后发布；本接口不接收可执行 SVG 或绘图脚本。

条图：`series: [{label, segments: [{label, value}]}]`，value 是有限正数；按数值比例渲染并列出完整数字。不要凭空画未测占用比例。

条图可选 `layout: "rank-timeline"`，每个 series 增加 `rankTimes: number[]`，segments 恰有计算与通信两段，计算值必须等于最慢 rank。图上所有方案使用相同时间尺度，等待为“最慢 rank − 当前 rank”。若示例忽略重叠，caption 必须明确说明。

可选 `layout: "token-cost"`，每个 series 的 segments 恰有一段完整迭代墙钟时间，增加正整数 `deliveredTokens`。单位成本直接计算为墙钟 / 实际提交 token；不能把有重叠的 kernel 时长机械相加。无 layout 的旧条图仍可导入。上述可选字段沿用 report.version 1，未知类型或不一致数字仍整笔拒绝。

来源可以用 `publishedAt` 表示真实原文日期，或用 `accessedAt` 表示在线文档查阅日期，也可同时提供。第一来源必须有真实 `publishedAt` 并与记录原文日期一致。在线文档和 main 分支不得伪装成冻结版本。[官方 AI Infra 来源表](radar-official-sources.md)继续精确识别；其他公开论文、博客、社区、论坛和新闻按[显式引用 review 字段](radar-public-citations.md)登记类别、发布者和核对范围，论文另注明同行评审状态。官方事实仅引用官方注册来源；非官方 attributed 来源可引用为 author，unverified 不能用 author。检索任务须核对原文与最终公开地址，元数据不会证明结果为真。原有 SGLang / LMSYS / NCCL 来源继续兼容。

## 不丢正文的更新规则

导入保持原子、幂等；未知字段、未知正文块、缺失章节、无证据事实、坏连线或超限文本都整笔失败，不会静默丢弃或截断。每篇 report 最多 200000 UTF-8 字节。较大报告一篇一次 dispatch；超过 GitHub 事件大小限制时，通过既有授权仓库提交完整内容文件，勿删正文以凑限制。

只更新摘要时可以省略 `report`，导入器会保留已有长文；此时必须保留来源顺序，避免证据指错原文。`report: null` 不允许删除报告。更新长文时发送完整 `report`，保留原 ID、kind 和第一来源，用相同或较新的 `reviewedAt`。更新前读取当前记录，勿用旧示例覆盖新知识。

```bash
npm run content:import -- /absolute/path/full-record.json --dry-run
npm run content:import -- /absolute/path/full-record.json
npm test
npm run build
npm run content:verify
```

`/api/radar.json` 保留全部 report 嵌套正文和图表数据；RSS 仍是摘要及详情入口。站点及 payload 只包含公开资料的原创解读，不包含私有日志或公司资料。
