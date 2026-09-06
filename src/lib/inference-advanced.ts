import { OUTPUT, toyTokens } from "./inference-demo.ts";

export type Mechanism = "speculative" | "prefix" | "pd";
export type CellState = "waiting" | "active" | "accepted" | "rejected";
export type Cell = { text: string; state: CellState };
export type Lane = { name: string; detail: string; cells: Cell[] };
export type AdvancedFrame = {
  key: string; title: string; text: string; flow: string; watch: string;
  lanes: Lane[]; delivered: number; kv: number; retained: number;
  accepted: number; transferred: number; ready: boolean;
};
export const mechanisms = {
  speculative: { name: "投机解码", subtitle: "少走几轮目标模型，而非跳过验证", scenarios: [["partial", "接受 2 个，第 3 个回退"], ["all", "草稿全部接受 + 额外 token"], ["reject", "第 1 个就不匹配"]] },
  prefix: { name: "前缀复用", subtitle: "复用已算过的 K/V，而非复用答案", scenarios: [["hit", "同一 prompt · 缓存命中"], ["miss", "模型版本变化 · 不可复用"], ["evicted", "缓存已淘汰 · 重新计算"]] },
  pd: { name: "Prefill / Decode 分离", subtitle: "计算分工之后，谁来搬运上下文？", scenarios: [["success", "KV 交接成功"], ["retry", "传输中断 · 清理后重试"]] },
} as const;

const cells = (texts: readonly string[], state: CellState = "waiting"): Cell[] => texts.map(text => ({ text, state }));
const lane = (name: string, detail: string, items: Cell[] = []): Lane => ({ name, detail, cells: items });

export function buildAdvancedTrace(mode: Mechanism, scenario: string, prompt: string): AdvancedFrame[] {
  const tokens = toyTokens(prompt);
  const s = tokens.length;
  const frames: AdvancedFrame[] = [];
  let current: AdvancedFrame = { key: "start", title: "", text: "", flow: "", watch: "", lanes: [], delivered: 0, kv: 0, retained: 0, accepted: 0, transferred: 0, ready: false };
  const add = (patch: Partial<AdvancedFrame> & Pick<AdvancedFrame, "key" | "title" | "text" | "flow">) => {
    current = { ...current, ...patch };
    frames.push(structuredClone(current));
  };
  if (mode === "speculative") {
    const accepted = scenario === "all" ? 3 : scenario === "reject" ? 0 : 2;
    const draft = scenario === "all" ? OUTPUT.slice(0, 3) : scenario === "reject" ? ["知识", "可以", "回答"] : ["模型", "逐个", "检索"];
    const watch = "观测草稿长度、接受 token 数 / 提议 token 数、目标模型验证耗时与草稿开销；高接受率也不保证端到端更快。";
    const draftCells = (n: number, checked = false) => draft.map((text, i): Cell => ({ text: `y${i + 1} · ${text}`, state: checked ? i < accepted ? "accepted" : "rejected" : i < n ? "active" : "waiting" }));
    add({ key: "spec-ready", title: "目标模型已完成 Prefill", text: `从同一段 ${s} token 的上下文开始。目标模型已有最后位置的 logits；草稿模型也先建立自己的上下文状态，两者的 KV 不能混用。本演示使用贪心验证。`, flow: "同一上下文 → 草稿模型 + 目标模型", watch, kv: s, lanes: [lane("草稿模型", "准备连续提出 3 个候选", draftCells(0)), lane("目标模型", `每层 KV = ${s}；首位置预测可用`)] });
    for (let n = 1; n <= 3; n++) add({ key: `draft-${n}`, title: `草稿模型提出第 ${n} 个候选`, text: "较小的草稿模型自回归运行：后一个候选依赖前一个候选。此时还没有经过目标模型确认，不能发给用户。候选内容为预设示例。", flow: `草稿：上下文 → ${draft.slice(0, n).join(" → ")} → 暂存`, lanes: [lane("草稿模型", `已提出 ${n} / 3 个候选，尚未确认`, draftCells(n)), lane("目标模型", `等待验证；每层 KV = ${s}`)] });
    add({ key: "verify", title: "目标模型一次前向验证整段草稿", text: "将 3 个候选按因果遮罩送入目标模型，在一次多位置前向中得到后续预测；结合已有的首位置 logits，按顺序验证。并行计算不意味着候选之间没有依赖：首次不匹配之后的预测属于错误分支。", flow: "草稿 ID [1, 3] → Transformer → 多位置 logits → 按顺序比对", kv: s + 3, lanes: [lane("草稿序列", "全部写入临时目标 KV，尚未提交", draftCells(3)), lane("目标验证", "首位置 logits 来自 Prefill；其余来自本轮前向", cells(["比较 y1", "比较 y2", "比较 y3", "预测 y4"], "active"))] });
    add({ key: "decision", title: accepted === 3 ? "连续 3 个候选全部接受" : `接受前 ${accepted} 个；从首次不匹配处截断`, text: accepted === 3 ? "草稿与目标模型贪心选择全部一致。最后一个草稿位置的 logits 还能选出一个额外 token；这颗额外 token 尚未作为输入计算 K/V。" : "只保留连续匹配的前缀。首次不匹配的 token 以及它后面的所有草稿都被丢弃，不能越过错误位置继续接受。目标模型在该位置给出替代 token。", flow: accepted === 3 ? "3 个接受 → 额外选出 y4" : `前 ${accepted} 个接受 → 第 ${accepted + 1} 个替换 → 后缀丢弃`, accepted, lanes: [lane("草稿判定", "✓ 接受 / × 丢弃；文字与颜色共同标识", draftCells(3, true)), lane("目标确认", "仅展示有效上下文上的目标选择", cells(OUTPUT.slice(0, accepted + 1), "accepted"))] });
    add({ key: "rollback", title: accepted === 3 ? "保留已验证 KV，等待额外 token 回送" : "回滚错误分支的 KV", text: `目标模型每层只保留 prompt 与 ${accepted} 个已接受草稿的 K/V，长度为 ${s + accepted}。新选出的“${OUTPUT[accepted]}”还没有自己的 K/V。草稿侧也要同步到确认后的序列，不能沿着旧分支继续。`, flow: `目标 KV：${s + 3} → ${s + accepted}；下一输入：${OUTPUT[accepted]}`, kv: s + accepted });
    add({ key: "spec-stream", title: "确认后的 token 才能流式返回", text: `这轮一次提交 ${accepted + 1} 个 token。流式协议可把它们合并成一个 chunk，也可拆开；chunk 数不等于验证轮数。`, flow: `已确认序列 → Detokenize → SSE → 用户`, delivered: accepted + 1 });
    for (let n = accepted + 1; n < OUTPUT.length; n++) add({ key: `spec-tail-${n}`, title: "回到普通 Decode，完成剩余示例", text: `为了聚焦一轮投机验证，后续切回普通贪心 Decode：输入“${OUTPUT[n - 1]}”，写入它的 K/V，再选出“${OUTPUT[n]}”。真实系统可以继续下一轮投机。`, flow: `Decode(${OUTPUT[n - 1]}) → ${OUTPUT[n]} → SSE`, kv: s + n, delivered: n + 1, lanes: [lane("目标模型", `每层 KV = ${s + n}`, cells(OUTPUT.slice(0, n + 1), "accepted"))] });
    add({ key: "spec-eos", title: "选出 EOS，结束请求", text: "最后一个可见 token 回送后选出 EOS；EOS 不显示为正文。本例未启用前缀保留，释放请求 KV。不同分支得到相同的预设目标序列，但开销不同。", flow: "最后 token → EOS → 释放请求 KV", kv: 0, lanes: [lane("用户", "确认后的完整回答", cells(OUTPUT, "accepted"))] });
  } else if (mode === "prefix") {
    const blockSize = 4;
    // Leave at least one uncached position to obtain fresh final-position logits.
    const reusable = Math.floor((s - 1) / blockSize) * blockSize;
    const hit = scenario === "hit" ? reusable : 0;
    const blocks = Array.from({ length: Math.ceil(s / blockSize) }, (_, i) => tokens.slice(i * blockSize, (i + 1) * blockSize).map(t => t.text).join(""));
    const showBlocks = (matched: number, computed = false): Cell[] => blocks.map((text, i) => ({ text: `B${i + 1} · ${text}`, state: i * blockSize < matched ? "accepted" : computed ? "active" : "waiting" }));
    const watch = "观测前缀查询 / 命中的 token 数、重算 token 数、缓存淘汰、KV 占用和 TTFT；区分请求命中率与 token 命中率。";
    add({ key: "prefix-cold", title: "请求 A：先把完整 prompt 算一遍", text: `本地教学分词得到 ${s} 个位置。A 是冷请求，正常 Prefill 计算所有层的 K/V。下面每格是一块，教学块大小为 4 token；ID 的显示词表是局部的，匹配以同一 tokenizer 的完整 token 前缀及上下文身份为准。`, flow: `A：${s} 个输入 → Prefill → 各层 KV`, watch, kv: s, lanes: [lane("请求 A", "模型 v1 / 同一租户缓存域", showBlocks(0, true)), lane("共享前缀池", "首次请求还没有可复用块")] });
    add({ key: "prefix-retain", title: "A 结束：解除引用，不等于立即抹掉缓存", text: `本例保留前 ${reusable} 个位置的完整块，供随后请求复用；活动请求 KV 已释放引用。保留块占用缓存容量，内存压力下可以被淘汰。为了获得最终位置 logits，本例至少重算最后一个位置所在的块。`, flow: `活动请求释放 → 缓存池保留 ${reusable / blockSize} 个完整块`, kv: 0, retained: reusable, lanes: [lane("请求 A", "已结束；不缓存完整回答"), lane("共享前缀池", `${reusable} token × 4 层的 K/V`, showBlocks(reusable))] });
    add({ key: "prefix-query", title: "请求 B：同一段 prompt，再查一次缓存", text: scenario === "miss" ? "文字相同，但 B 改用模型 v2。即使 token ID 恰好相同，权重不同也不能复用 v1 的 K/V。模型、适配器、位置配置与租户隔离等必须由实现正确纳入缓存身份或命名空间。" : scenario === "evicted" ? "B 到达前，A 留下的缓存块已因容量压力淘汰。曾经算过不代表现在命中；没有可用数据就必须重新计算。" : "B 与 A 使用完全相同的输入和兼容上下文。逐块匹配时也依赖前面的 token 前缀；只是中间一段文字相同，不能脱离其上文复用 K/V。", flow: `B：相同 prompt / ${scenario === "miss" ? "模型 v2" : "模型 v1"} → 前缀查询`, retained: scenario === "evicted" ? 0 : reusable, lanes: [lane("请求 B", scenario === "miss" ? "模型版本不同" : "token 前缀相同", showBlocks(0)), lane("缓存池", scenario === "evicted" ? "块已淘汰" : "等待身份与前缀匹配", scenario === "evicted" ? [] : showBlocks(reusable))] });
    add({ key: "prefix-hit", title: hit ? `命中 ${hit} 个位置，跳过它们的前向计算` : "未命中：不能绕过 Prefill", text: hit ? `直接引用或加载各层已有 K/V。命中部分不重跑 Embedding、Attention 和 FFN；未命中的 ${s - hit} 个位置仍要经过全部层，其 Attention 仍需读取缓存前缀。命中不是把前缀从上下文删除。` : `这次复用 0 个位置，${s} 个输入都需要前向计算。演示显示的是当前请求可复用量，而不是字符串的相似程度。`, flow: `复用 H = ${hit}；新算 T = S − H = ${s - hit}；可见上下文 N = ${s}`, kv: hit, lanes: [lane("B 的输入块", "✓ 复用 / · 待计算", showBlocks(hit)), lane("各层 KV", `已可用 ${hit} 个位置；后缀尚未写入`)] });
    add({ key: "prefix-suffix", title: "后缀 Prefill：Q 变短，K/V 仍覆盖完整上下文", text: `处理未缓存后缀，新增 Q 的逻辑形状为 [1, 2, ${s - hit}, 4]。每层把后缀 K/V 接到缓存前缀，得到完整 ${s} 个位置。后缀内部继续使用因果遮罩。`, flow: `后缀 Q → 前缀 K/V + 后缀 K/V → 最后位置 logits`, kv: s, lanes: [lane("B 的输入块", "✓ 复用 / → 本轮新算", showBlocks(hit, true)), lane("每层完整 KV", `H ${hit} + T ${s - hit} = S ${s}`)] });
    add({ key: "prefix-first", title: "从新 logits 选出首 token，不是取出缓存答案", text: "缓存的是 K/V 中间状态，不是答案字符串。首 token 仍经目标模型最终位置、LM Head 和选择策略产生；随后继续正常 Decode。", flow: "Final Norm → LM Head → y1 → SSE", delivered: 1 });
    add({ key: "prefix-decode", title: "Decode 依然逐步读取历史 KV", text: "把首 token 作为输入，写入它的各层 K/V，再预测第二个 token。前缀复用主要节省重复输入的 Prefill，不能消除生成阶段对长上下文的读取。此处完成机制演示，后续按上方基础循环继续。", flow: `Decode(y1) → KV ${s + 1} → y2 → SSE`, kv: s + 1, delivered: 2 });
  } else {
    const totalBytes = s * 2 * 4 * 2 * 4 * 2;
    const watch = "用同一请求 ID 关联 P/D 两侧：P 排队与 Prefill、KV 字节数 / 传输时长 / 失败重试、D 等待 KV 与排队、首到第二 token 间隔。";
    const workers = (p: string, transfer: string, d: string, layerCount = 0): Lane[] => [lane("P · Prefill worker", p, cells(["模型权重已就绪"], "accepted")), lane("KV 传输通道", transfer, Array.from({ length: 4 }, (_, i) => ({ text: `L${i + 1} · K + V`, state: i < layerCount ? "accepted" : "waiting" }))), lane("D · Decode worker", d, cells(["模型权重已就绪"], "accepted"))];
    add({ key: "pd-route", title: "路由器为一个请求选择 P 与 D", text: "两个独立实例均已加载兼容的模型权重。P 负责输入阶段，D 负责后续增量生成；这不是把 Transformer 的前几层放 P、后几层放 D。", flow: "网关 → P 池 / D 池 → 建立关联请求", watch, lanes: workers("已接纳，等待 Prefill", "尚未传输", "预留接收资源，等待 KV") });
    add({ key: "pd-prefill", title: "P 跑完整模型，建立所有层 KV", text: `P 对 ${s} 个输入完成全部 4 层 Prefill。BF16 玩具 MHA 的逻辑 KV 字节量是 2(K/V) × 4层 × 2头 × ${s}位置 × 4维 × 2字节 = ${totalBytes} B，不含协议与分配开销。`, flow: `P：prompt → 所有 Transformer 层 → KV + 最后位置 logits`, kv: s, lanes: workers(`各层 KV = ${s}；logits 就绪`, `待交接 ${totalBytes} B`, "仍不可 Decode") });
    add({ key: "pd-first", title: "本例由 P 选出并返回首 token", text: "这里选择一种具体协议：P 先发送 y1，再将请求身份、位置、y1、生成配置和 KV 交给 D。也有实现选择不同的首 token 返回边界，不能据此假定所有 P/D 服务行为一致。", flow: "P logits → y1 → 网关 → 用户；D 等待 KV", delivered: 1, lanes: workers("首 token 已交给网关；KV 尚需保留", "开始交接元数据与 KV", "已知下一输入 y1，但 KV 未齐") });
    add({ key: "pd-transfer", title: "逐层传输 K/V，D 暂不能执行", text: "动画用逐层到达表示传输进度。本例采用完整 KV 就绪后再启动 Decode 的协议，不使用逐层传输与计算重叠；收到一部分不能当作整个上下文已就绪。传输的是中间状态，不是整份模型权重。", flow: "P 内存 → 传输通道 → D 接收缓冲区", transferred: totalBytes / 2, lanes: workers("保留源 KV，等待确认", `已到达 ${totalBytes / 2} / ${totalBytes} B`, "仅收到 L1、L2；等待 L3、L4", 2) });
    if (scenario === "retry") {
      add({ key: "pd-failed", title: "传输中断：丢弃未完成的接收状态", text: "不能拿半份 KV 继续生成。本示例选择释放 D 的部分接收缓冲区，保持 P 的源数据，用新的传输尝试重发；还可按系统策略回退为重算或报错。重试不能再次向用户发送 y1。", flow: "交接失败 → D 清理部分 KV → 等待重试", transferred: 0, lanes: workers("源 KV 仍保留", "本次失败；接收进度清零", "Decode 被阻塞；不输出重复 token") });
      add({ key: "pd-retry", title: "重新传输，沿用同一请求身份", text: "重试需要受超时、重试预算和幂等规则约束。这里仅演示一次重试成功，不模拟耗时，也不承诺任一连接器都自动提供该恢复策略。", flow: "新的传输尝试 → 关联原请求 → KV 重发", transferred: totalBytes / 2, lanes: workers("继续持有源 KV", `重试已到达 ${totalBytes / 2} / ${totalBytes} B`, "等待完整状态，不重复 Prefill 或 y1", 2) });
    }
    add({ key: "pd-ack", title: "完整接收并确认，D 才变为可运行", text: "D 校验请求身份、模型 / KV 布局兼容性、位置和完整性，确认各层数据已可用。完成交接握手后，本例允许 P 释放该请求的源 KV。若两端并行分片布局不同，还需要连接器支持对应重排。", flow: "D 校验完整 KV → ACK → P 释放源引用 → D 入队", transferred: totalBytes, ready: true, lanes: workers("交接确认，可释放本请求源 KV", `${totalBytes} / ${totalBytes} B · 已确认`, `每层 KV = ${s}，可进入调度`, 4) });
    add({ key: "pd-decode", title: "D 从 y1 开始增量计算", text: `D 不必重算 prompt；输入已返回的 y1，在全部层追加它的 K/V，长度变为 ${s + 1}，然后选出 y2。KV 传输或 D 排队过慢，会表现为首 token 后的一段停顿。`, flow: `D：Embedding(y1) → 全部层 + 历史 KV → logits → y2`, kv: s + 1, lanes: workers("已结束本请求 Prefill 工作", "交接完成", `本轮输入 y1；每层 KV = ${s + 1}`, 4) });
    add({ key: "pd-stream", title: "用户的同一条流，由 D 继续推进", text: "网关把 D 的第二个 token 接到原响应流，保持顺序与请求身份。本段演示到接管完成；D 后续继续 Decode，直至 EOS、取消或输出上限，再回收资源。", flow: "D 的 y2 → 网关合并原响应 → 用户；继续 Decode", delivered: 2 });
  }
  return frames;
}
