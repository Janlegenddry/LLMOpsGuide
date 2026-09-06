/** A deterministic teaching trace, not a tokenizer or a trained language model. */
export const OUTPUT = ["模型", "逐个", "生成", " token", "。"];
export const D = 8;
export const HEADS = 2;
export const LAYERS = 4;

export const modules = [
  ["embed", "Embedding", "ID → 向量"],
  ["norm", "RMSNorm", "归一化"],
  ["qkv", "Q / K / V", "三组投影"],
  ["rope", "RoPE", "旋转 Q、K"],
  ["attention", "Causal Attention", "读取上下文"],
  ["residual", "输出投影 + 残差", "合并信息"],
  ["ffn", "Norm + SwiGLU", "逐位置变换"],
  ["layers", "残差 → 其余层", "重复至第 4 层"],
  ["head", "Final Norm + LM Head", "向量 → logits"],
  ["sample", "选择下一个 token", "Greedy / argmax"],
] as const;

export type Frame = {
  key: string; title: string; phase: "请求" | "Prefill" | "Decode" | "结束";
  round: number; node: string; text: string; input: string; output: string;
  watch: string; flow: string; generated: number; delivered: number; cache: number[];
};

export function toyTokens(prompt: string) {
  // Match short Latin pieces, individual CJK code points and punctuation; whitespace is preserved.
  const pieces = prompt.match(/[A-Za-z0-9]{1,4}|[^A-Za-z0-9]/gu) || [];
  const vocab = new Map<string, number>();
  const body = pieces.map(text => {
    if (!vocab.has(text)) vocab.set(text, vocab.size + 1000);
    return { text, id: vocab.get(text)! };
  });
  return [{ text: "<bos>", id: 1 }, { text: "<user>", id: 2 }, ...body,
    { text: "<end>", id: 3 }, { text: "<assistant>", id: 4 }];
}

export function buildTrace(prompt: string): Frame[] {
  const tokens = toyTokens(prompt);
  const S = tokens.length;
  const frames: Frame[] = [];
  let cache = [0, 0, 0, 0];
  let generated = 0;
  let delivered = 0;
  const add = (key: string, title: string, node: string, text: string, input: string, output: string, watch: string, flow: string, round = -1) => {
    frames.push({ key, title, node, text, input, output, watch, flow, round,
      phase: round < 0 ? (key === "done" ? "结束" : "请求") : round === 0 ? "Prefill" : "Decode",
      generated, delivered, cache: [...cache] });
  };
  add("request", "把对话封装成请求", "client", "客户端将用户消息、模型名、输出上限和 stream 参数编码为 JSON，经 HTTPS 送入服务。模型权重已在服务启动时加载到设备；每条请求不会重新加载一次权重。", prompt, 'POST /v1/chat/completions\n{ messages: […], stream: true, max_tokens: 32 }', "客户端记录请求开始时间，生成关联 ID；prompt 只用于本地演示，不发送到服务。", "用户 → HTTPS / JSON → 网关");
  add("gateway", "校验请求，选择模型副本", "gateway", "网关检查认证、配额和请求结构，再按模型版本、健康状态和路由策略选择一个推理副本。多副本是多个服务实例，不等同于单个模型的多 GPU 张量并行。", "JSON / model = demo-decoder", "rid = demo-request\nroute → replica B（示意）", "网关耗时、拒绝率、路由目标；用 trace_id 关联下游，而不是用 prompt 做指标标签。", "网关 → 服务发现 → replica B");
  add("tokenize", "套用对话模板，再分词", "tokenizer", "角色和轮次边界先序列化为模型支持的 chat template，Tokenizer 再将文本编码为离散整数 ID。这里用简化切分和临时词表，ID 不是任何真实模型的 token ID；真实分词不保证一个汉字或单词对应一个 token。", `<user>\n${prompt}\n<end><assistant>`, `input_ids: int64 [1, ${S}]\nposition_ids: 0 … ${S - 1}`, "记录模板后输入 token 数和分词耗时，区分原始字符数与 token 数。", "UTF-8 文本 → 模板 → 整数 ID");
  add("queue", "进入等待队列", "scheduler", "请求进入目标副本的等待队列。调度器根据可用 KV 页、token budget 和当前运行请求决定何时接纳它；即使 GPU 正忙，队列中的请求也还没有执行本次前向计算。", `waiting: A, 本请求, C\n本请求输入长度 S = ${S}`, "本请求：Waiting\n其他请求：Decode 中", "排队时间、waiting/running 请求数。排队变长可以让 TTFT 变差，而模型计算本身未必变慢。", "副本 B → Waiting 队列");
  add("schedule", "分配 KV 空间，组成执行批次", "scheduler", "调度器为请求分配可用 KV Cache 块并打包 token。连续批处理按迭代接纳新请求、移除已完成请求；长 prompt 可以分块 Prefill。本动画展示无前缀命中的单次完整 Prefill，聚焦 batch 中的一条请求。", `本请求：${S} 个输入 token\n邻居请求：各 1 个 Decode token`, "Waiting → Running\n打包 token / 块表 → model runner", "本轮 scheduled tokens、KV 可用块、抢占次数；逻辑 batch 的请求数与 token 数是不同口径。", "Scheduler → model runner → GPU");
  for (let round = 0; round <= OUTPUT.length; round++) {
    const prefill = round === 0;
    const T = prefill ? S : 1;
    const N = S + round;
    const next = OUTPUT[round] ?? "<eos>";
    const inputToken = prefill ? "所有 prompt ID" : `上轮 token「${OUTPUT[round - 1]}」`;
    const push = (key: string, title: string, node: string, text: string, input: string, output: string, watch: string, flow: string) => add(key, title, node, text, input, output, watch, flow, round);
    if (!prefill) push("decode", `Decode ${round}：把上轮 token 喂回模型`, "scheduler", "上一个 token 已被选出并发往客户端；现在把它的 ID 作为本轮唯一的新输入。调度器可以重新组合 batch。权重保持不变，各层旧 K/V 继续保留，先前 token 的隐藏状态无需全部重算。", `${inputToken}\nposition = ${N - 1}`, "input_ids: [1, 1]\n本轮将预测下一个 token", "每轮调度等待、Decode 耗时和 inter-token latency；本动画顺序展示，实际网络发送可与后续计算重叠。", "上轮 token ID ↺ Scheduler → GPU");
    push("embed", "Embedding：整数查表变成向量", "embed", "用 token ID 索引训练好的嵌入矩阵。文本的离散符号变成连续的隐藏向量，随后在每一层更新。玩具配置 d_model = 8、2 个注意力头、4 层，仅用于看清张量维度；不运行真实模型。", `${inputToken}\nIDs [1, ${T}]`, `X = E[IDs]\n[1, ${T}, 8] 浮点向量`, "H2D 拷贝、embedding kernel；ID 是整数，隐藏向量通常使用 BF16/FP16 等计算精度。", `ID [1, ${T}] → X [1, ${T}, 8]`);
    push("norm", "第 1 层：RMSNorm 稳定数值尺度", "norm", "每个位置的向量沿隐藏维度归一化，并乘以学习到的缩放系数。这里采用 LLaMA 风格的 pre-norm 结构；并非所有 Transformer 都采用同一种归一化或层顺序。", `X [1, ${T}, 8]`, "X̂ = X / √(mean(X²) + ε) ⊙ γ\n张量形状不变", "归一化只改数值，不改 token 数；实际执行可能与邻近算子融合。", "隐藏向量 → 归一化隐藏向量");
    push("qkv", "Q / K / V：同一输入，三组投影", "qkv", "X̂ 分别乘以 Wq、Wk、Wv。Q 表示当前位置要检索什么，K 用于匹配，V 提供聚合的信息。演示采用普通多头注意力 MHA，每头 d_head = 4；GQA 的 KV 头数会更少。", `X̂ [1, ${T}, 8]`, `Q, K, V = X̂ Wq, X̂ Wk, X̂ Wv\n各为 [1, 2, ${T}, 4]（分头后）`, "QKV GEMM 耗时和设备带宽；这是线性代数运算，不是三个存放自然语言问题的数据库。", "X̂ → Q ∥ K ∥ V");
    cache[0] = N;
    push("rope", "RoPE 与 KV 写入：加入位置信息", "rope", "按绝对位置旋转 Q 和 K 的成对维度，点积因此能反映相对位置；V 不做 RoPE。第 1 层将当前 token 的旋转后 K 和 V 写入本层缓存。其余层在各自执行时写入自己的 K/V。", `position = ${prefill ? `0 … ${N - 1}` : N - 1}\nQ / K / V`, `Q′, K′ = RoPE(Q, K)\n第 1 层 KV 长度 → ${N}`, "观察 KV 写入、分配失败和占用；这里显示逻辑长度，真实页式缓存还有块大小与碎片开销。", "Q → RoPE；K → RoPE → Cache；V → Cache");
    push("attention", "因果注意力：从允许的历史中聚合信息", "attention", prefill ? "所有 prompt 位置可在一次前向中计算，但第 i 个位置只能看到自己和更早的 token。先求 QKᵀ / √d_head，将未来位置设为 −∞，逐行 softmax，再与 V 相乘。并行处理输入不意味着能看到未来。" : "本轮只有一个新的 Q，它读取本层所有历史 K 和当前 K，对历史 V 与当前 V 加权求和。缓存避免重算旧 K/V，但长上下文仍需读取更大的缓存；Decode 不是只看上一个 token。", `Q [1, 2, ${T}, 4]\nK/V [1, 2, ${N}, 4]`, `A = softmax(QKᵀ / √4 + causal_mask)\nA [1, 2, ${T}, ${N}] → AV [1, 2, ${T}, 4]`, "关注 attention kernel 时长与 KV 读带宽。图里的注意力热图是因果可见性示意，不是模型解释或真实注意力权重。", "Q × Kᵀ → 因果遮罩 → softmax → × V");
    push("residual", "合并注意力头，接回残差路径", "residual", "将各头输出拼接，经 Wo 输出投影回 d_model，再加上进入注意力子层前的 X。残差提供信息和梯度的直接路径；推理只执行前向，不计算梯度或更新权重。", `Concat(heads) [1, ${T}, 8]`, "H = X + Concat(heads) Wo\n保留原信息并加入上下文信息", "输出投影 GEMM；若采用张量并行，部分子层还会发生集合通信，这里未展开多 GPU。", "Attention → Wo → + X");
    push("ffn", "前馈网络：每个位置独立做非线性变换", "ffn", "H 先做 RMSNorm，再经过门控前馈网络 SwiGLU：一条支路经 SiLU 激活，与另一条支路逐元素相乘，最后投影回隐藏维度。该模块不跨 token 做注意力，而是转换每个位置已汇聚的信息。", `U = RMSNorm(H)\n[1, ${T}, 8]`, "MLP(U) = [SiLU(U Wg) ⊙ (U Wu)] Wd\n8 → 24 → 8（演示维度）", "FFN GEMM 与激活耗时。本页为稠密模型；MoE 会在此加入专家路由与可能的跨卡通信。", "Norm → Gate ∥ Up → ⊙ → Down");
    cache = [N, N, N, N];
    push("layers", "残差相加，再依次通过剩余层", "layers", "先得到第 1 层输出 H + MLP(U)，随后第 2～4 层各自重复 Norm、Attention、残差、FFN、残差。每层有独立权重和独立 KV。动画合并展示后三层，不代表模型跳过它们，也不代表它们在同一条请求上同时执行。", "第 1 层输出 [1, T, 8]", `第 4 层输出 [1, ${T}, 8]\n4 层 KV 均包含 ${N} 个位置`, "用 GPU profiler 分解 kernel 和通信，服务级 Trace 不应默认为每个 token 的每一层建立高成本 span。", "第 1 层 → 第 2 层 → 第 3 层 → 第 4 层");
    push("head", "LM Head：最后位置变成词表分数", "head", "最终 RMSNorm 后，把最后一个输入位置的隐藏向量投影到词表维度，得到每个候选 token 的 logit。Prefill 的最后位置就可预测第一个输出 token；不需要先额外跑一轮 Decode。", `最后位置 h [1, 8]\n不是整段答案`, "logits = FinalNorm(h) W_vocab\n[1, Vocab]（展示 4 个玩具候选）", "logit 是未归一化分数。真实词表通常更大，图中分数由教学脚本指定，不来自 prompt 的语义计算。", "最后位置向量 → 全词表 logits");
    if (round < OUTPUT.length) generated++;
    push("sample", next === "<eos>" ? "选择 EOS：满足停止条件" : `选择 token「${next}」`, "sample", next === "<eos>" ? "这一轮 EOS 得分最高，结束生成，不把 EOS 作为普通文本发给用户。真实服务还会检查 max_tokens、停止串、上下文上限及客户端取消；不是所有结束都由 EOS 触发。" : "演示使用贪心策略，选择 logit 最大的 ID；softmax 条形图帮助理解相对概率，贪心本身不必先计算 softmax。随机采样可使用 temperature、top-k 或 top-p；模型做的是条件预测，没有检索一个预先存好的完整答案。", "示意 logits [3.2, 1.6, 0.8, −0.4]", `${next === "<eos>" ? "eos_id = 5" : `next_token_id = ${100 + round}`}\n选中：${next}`, "采样耗时、生成 token 数、停止原因。为了稳定讲解，本页的回答由脚本预设，不随自定义 prompt 生成真实答案。", "logits → argmax → 一个 token ID");
    if (round < OUTPUT.length) {
      delivered++;
      push("stream", round === 0 ? "首个 token 返回：用户开始看到文字" : `第 ${round + 1} 个片段返回客户端`, "client", "Detokenizer 把 token ID 增量解码成文本，服务将可发送的文本放进流式事件，网关转发，客户端持续追加显示。真实 token 可能只是字节或子词，需要缓冲后才能显示；一个网络 chunk 不一定对应一个 token。", `token_id = ${100 + round}`, `data: ${JSON.stringify({ delta: { content: next } })}\n\n`, round === 0 ? "客户端从请求开始到首个可用输出的时间是 TTFT；服务端首 token 与客户端首字的测量边界可能不同。" : "客户端相邻可用输出的间隔是 ITL；网络缓冲会改变观测到的节奏，不能把动画播放时间当作推理性能。", "token ID → Detokenizer → SSE → 网关 → 用户");
    }
  }
  cache = [0, 0, 0, 0];
  add("done", "关闭响应，释放请求资源", "client", "服务发送结束事件和使用量信息，关闭流，将该请求从 running 集合移除并释放引用的 KV 块。启用前缀缓存时，部分块可能作为可复用前缀保留；本演示关闭前缀缓存并显示完全释放。", 'finish_reason = "stop"\nEOS 已选中', `data: [DONE]\n可见文本：${OUTPUT.join("")}`, "记录总时延、输入/输出 token 数和结束原因，结束请求 span。不同服务对特殊 token 的 usage 计数可能不同。", "完成信号 → 用户；KV 引用 → 回收");
  return frames;
}

export function probabilities(logits = [3.2, 1.6, 0.8, -0.4]) {
  const max = Math.max(...logits);
  const exp = logits.map(x => Math.exp(x - max));
  const total = exp.reduce((a, b) => a + b, 0);
  return exp.map(x => x / total);
}
