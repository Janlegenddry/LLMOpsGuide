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
| build-runtime | 3 / 3 / 3 / 1 | 框架、扩展、运行时编译三条来源→产物→使用泳道；独立 GPU / 驱动基础层 |
| causal-branches | 1 / 3 / 3 / 2 | 症状分叉为编译产物与库调用，再汇入独立参考与局部归因 |
| acceptance-gates | 6 / 2 | 六道串行验收门；前五道未满足时进入停止与处置分支 |
| kv-map | 2 / 1 / 1 / 2 | 全注意力 A/B、窗口 X、环形索引零 R；旧逻辑区间与本次分配身份对比 |
| kv-zeroing | 3 / 3 / 3 / 1 | 分配器、连接器、执行器泳道，各按旧 X、新 X、新 Y 的角色分组；独立 X 冲突焦点 |
| release-gates | 4 / 2 | 合入、定向回归、部署验证、正式发布四种证据；相邻修复状态独立旁路，标题取自 payload |
| state-lanes | 3 / 3 / 3 / 3 / 1 | 四个共同阶段，每阶段三条独立状态轨道；旧请求终点或跨轨证据边界单列 |
| failure-settlement | 4 / 3 / 2 / 2 | 工作线程四节点、旧句柄三分支节点、room 清理 / ACK 两节点、恢复两节点 |
| peer-reload | 4 / 3 / 3 / 1 | 登记 / 锁 / 冷却检查、清缓存 / 载入 / 准备、跳过 / 成功 / 回退、健康旁路 |
| constant-paths | 1 / 3 / 3 / 1 | 编译期共用输入、旧文本构造三步、直接构造三步、独立运行时张量路径 |
| source-containment | 2 / 3 / 2 / 1 | 稳定标签引用、框架 pin 引用、修复提交引用与实际产物待核查；箭头不是日期先后 |
| deployment-gates | 4 / 1 / 1 | 计划执行的产物身份、最小语义、真实算子 / 精度、小范围上线四门；失败返回与独立性能检查 |
| overload-sources | 2 / 2 / 1 / 1 / 1 | 请求提示与监控双源、过滤、提示失效、再次评估；不代表健康恢复 |
| choice-cleanup | 1 / 3 / 1 / 1 / 1 / 1 / 1 / 1 / 1 | 请求、三候选、输出、未完成 ID、完成事件、取消、abort、迟到 ID、资源观察 |
| deployment-paths | 1 / 2 / 2 / 4 / 1 / 1 | 计划、标准 decode、sidecar、媒体、逐路径验收、暂缓 |
| release-evidence | 4 / 3 / 3 / 1 | 标签、main、相邻修复状态三条平行证据；实际产物另行核对 |
| preload-restart | 3 / 4 / 3 / 1 / 1 | 常驻权重、引擎生命周期、初始化、条件回退、独立约束 |
| rollout-checks | 7 / 1 / 1 / 1 | 七道计划验收门、失败返回、P/D 附着检查、preload 附着检查 |
| metadata-ownership | 4 / 3 / 2 | 路由快照、在途 slice、完成处理三角色；旧/修复路径的时间与重新生成路径的重试关系 |
| handshake-boundaries | 3 / 1 / 3 / 1 | 三种对端条件、socket 写入、条件结果、旧 SIGPIPE 故障；发送时限为未闭合门 |
| fault-acceptance | 5 / 1 | 构建包含、安全、时限、数据、业务五道未执行门；发布标签只指向第一门 |
| graph-buffer-identity | 3 / 2 / 2 / 1 / 1 / 1 / 1 / 2 | 旧 tier 与 Python 对象、旧设备缓冲、旧图、live 布局、新 tier、新对象、新缓冲、新图；图只引用设备地址 |
| pause-kv-drain | 3 / 3 / 2 / 3 / 1 | 普通队列、持块在途、空闲流式、控制与资源观测、独立传输停滞；计数排除不表示删除 |
| test-start-barrier | 3 / 4 | 旧测试竞态与修订测试同步；首个输出是测试栅栏，不是生产 API 前提 |
| tcp-idle-probe | 2 / 3 / 3 / 1 | 空闲复用条件、三种 peek 结果、条件性复用/丢弃/后续 pump、独立业务边界 |

2026-10-09 四种构图只绘制 payload 的 edges。graph-buffer-identity 的旧对象组依次为 tier、对象 A、对象 B，旧缓冲与图各按 A/B 排列；live 与新 tier、对象、缓冲分别单列，新图组为 A/B。Python 对象拥有张量，CUDA graph 固化设备地址，不得用图到 Python 对象的箭头代替地址引用。pause-kv-drain 的普通队列依次为排队、暂停保留、恢复；持块轨为等待、可推进、完成待核对；流式轨为未来输入、计数排除；观测组为排空核对、缓存操作、控制响应。停滞分支不通向成功。test-start-barrier 的旧末节点是条件性测试超时，新路径的首输出仅同步实验。tcp-idle-probe 的结果依次为暂不可读、EOF/错误、读到字节；后续组为允许复用、断连、后续 pump 重连。最后一组是独立待验业务结果，不添加成功边。手机按角色纵排不形成额外转移；观察与验收节点保留空心状态。

2026-10-08 三种故障图仍只绘制 payload 的 edges。metadata-ownership 的第一组依次为旧 A、旧 B、修复 A、修复 B；第二组为借用、复制、重试重新生成；第三组为旧失效读取、修复完成使用副本。桌面横轴为时间，旧/修复路径各保留三个角色泳道；手机按路径排列，重试始终返回新尝试的标识复制。handshake-boundaries 的停止读取结果使用橙色未闭合门，不能把接收超时画成发送保证。fault-acceptance 的五门均为空心状态，源码和单元证据不替代真实部署验收。

2026-10-07 六种构图同样只画 payload 的真实 edges。标签、main 与开放提案保持平行，不能按发布日期补一条包含关系。preload 的常驻权重层与引擎生命周期分别呈现，回退需开启 fallback，就绪需初始化和检查通过。七道门均为计划，任一失败均返回基线。手机纵向排版不构成额外因果边。连线绕开所有节点与标签，完整说明保留在图下。

正文允许 `[标题](/radar/slug/)` 形式的站内引用，渲染时自动加入站点 base path；外部链接、协议地址、查询、锚点、路径穿越及 HTML 仍显示为转义文本。证据链接继续使用 sources，不能借正文链接声明事实依据。

语义色 `compute / kv / communication / control / danger / neutral` 分别用于计算、KV、通信、控制、风险及普通状态。分组顺序定义绘图角色，例如 request-lanes 的 D 分组顺序为生成循环、草稿、验证、提交、响应。确认图与完整 edges 的语义一致后发布；本接口不接收可执行 SVG 或绘图脚本。

新增专用图也有固定角色顺序：build-runtime 的三个泳道各为来源、产物、实际使用；causal-branches 的共同末组为参考、归因；acceptance-gates 的六门依次为来源、覆盖、正确性、稳定性、服务、放量，处置组为停止、修正。kv-zeroing 的分配器组为旧 X、新 X、未加载 Y，连接器组为旧传输、加载声明、新传输，执行器组为旧清零、条件读取、Y 清零。release-gates 依次区分四种证据，旁路没有指向已完成节点的箭头。这些构图不能用于角色不一致的泛化流程；图中短标签不改变节点详情与证据级别。

条图：`series: [{label, segments: [{label, value}]}]`，value 是有限正数；按数值比例渲染并列出完整数字。不要凭空画未测占用比例。

2026-10-05 的恢复图和常量图按固定角色分组，但实际连线只取完整 edges，不把节点列表自动画成因果链。state-lanes 前四组按时间阶段排序，每组三节点的顺序对应相同三轨；第五组独立终点不得连接回成功路径。failure-settlement 的旧句柄分组顺序为未结算、已结束、未确认 / 超时；超时没有通向安全 ACK 的边。peer-reload 的跳过状态不启动定时器，失败回退只由后续失败触发。constant-paths 的运行时张量节点与编译期入口分离；source-containment 的最后节点始终表示产物待核查，不能用日期或版本名替代包含关系。deployment-gates 四门均为计划执行，独立性能节点不能抵消数值失败。手机按阶段 / 路径拆图或使用纵向分支，不要求横向拖动；原始节点详情和所有关系仍完整保留。

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
