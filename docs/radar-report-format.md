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

图节点：`{id, label, detail, column, row}`。节点 ID 唯一；column / row 为 0–3 的整数，不可重叠；label 最多 40 字符，充分解释写在 detail。图连线：`{from, to, label}`，必须指向不同的现有节点。连线编号对应图下关系说明；图下同时显示完整节点解释，窄屏在图内滚动。

条图：`series: [{label, segments: [{label, value}]}]`，value 是有限正数；按数值比例渲染并列出完整数字。不要凭空画未测占用比例。

来源可以用 `publishedAt` 表示真实原文日期，或用 `accessedAt` 表示在线文档查阅日期，也可同时提供。第一来源必须有真实 `publishedAt` 并与记录原文日期一致。在线文档和 main 分支不得伪装成冻结版本。按[官方 AI Infra 来源表](radar-official-sources.md)接受精确仓库、域名和路径；采集任务须核对重定向最终地址。原有 SGLang / LMSYS / NCCL 来源继续兼容。

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
