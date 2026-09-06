import { buildTrace, toyTokens, OUTPUT, probabilities, type Frame } from "../lib/inference-demo";

export function initInferenceLab() {
  const root = document.querySelector<HTMLElement>("#inference-lab");
  if (!root || root.dataset.ready) return;
  root.dataset.ready = "true";
  const el = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#lab-${id}`)!;
  const prompt = el<HTMLTextAreaElement>("prompt");
  const play = el<HTMLButtonElement>("play");
  const progress = el<HTMLInputElement>("progress");
  const speed = el<HTMLSelectElement>("speed");
  let activePrompt = prompt.value;
  let frames = buildTrace(activePrompt);
  let index = 0;
  let playing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const wide = matchMedia("(min-width: 40rem)");
  const map = root.querySelector<HTMLDetailsElement>(".lab-map")!;
  map.open = wide.matches;
  wide.addEventListener("change", () => { map.open = wide.matches; });
  const text = (id: string, value: string) => { el(id).textContent = value; };
  function node(tag: string, value: string, className = "") {
    const item = document.createElement(tag);
    item.textContent = value;
    item.className = className;
    return item;
  }
  function pills(parent: HTMLElement, values: string[]) {
    const list = node("div", "", "lab-pills");
    values.forEach((value, i) => {
      const pill = node("span", value);
      pill.style.setProperty("--item-delay", `${i * 140}ms`);
      list.append(pill);
    });
    parent.append(list);
  }
  function visualize(frame: Frame) {
    const container = el("visual-content");
    container.replaceChildren();
    const tokens = toyTokens(activePrompt);
    const S = tokens.length;
    text("visual-label", "教学示意 · 非真实模型数值");
    if (["head", "sample"].includes(frame.key)) {
      text("visual-title", "候选 token 的概率");
      const choices = [OUTPUT[frame.round] ?? "<eos>", "一个", "继续", "其他"];
      probabilities().forEach((p, i) => {
        const row = node("div", "", "lab-prob-row");
        row.append(node("span", choices[i]), node("code", `${(p * 100).toFixed(1)}%`));
        const track = node("div", "", "lab-prob-track");
        const bar = node("span", "");
        bar.style.transform = `scaleX(${p})`;
        track.append(bar); row.append(track); container.append(row);
      });
      container.append(node("p", "4 项玩具词表：softmax([3.2, 1.6, 0.8, −0.4])。贪心选择最大项；概率不是置信度保证。", "lab-small"));
    } else if (frame.key === "attention") {
      text("visual-title", frame.round === 0 ? "因果遮罩 · 左下三角可见" : "新 Q 读取所有历史 K/V");
      const rows = frame.round === 0 ? Math.min(S, 6) : 1;
      const cols = Math.min(S + frame.round, 6);
      const matrix = node("div", "", "lab-attention-matrix");
      matrix.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const masked = frame.round === 0 && c > r;
        const cell = node("span", masked ? "−∞" : "可见", masked ? "masked" : "allowed");
        cell.style.setProperty("--item-delay", `${r * 120 + c * 30}ms`);
        matrix.append(cell);
      }
      container.append(matrix, node("p", frame.round === 0 ? `截取前 ${cols} 个位置。每行是一个 Q，每列是一个 K；未来位置在 softmax 后权重为 0。` : `仅展示前 ${cols} 个历史位置；这个新 Q 实际可读取 ${S + frame.round} 个 K/V 位置（含自身）。`, "lab-small"));
    } else if (["embed", "norm", "qkv", "rope", "residual", "ffn", "layers"].includes(frame.key)) {
      text("visual-title", "张量如何变化");
      const T = frame.round === 0 ? S : 1;
      const shapes: Record<string, string[]> = {
        embed: [`IDs [1, ${T}]`, `E [Vocab, 8]`, `X [1, ${T}, 8]`],
        norm: [`X [1, ${T}, 8]`, "沿 d=8 归一化", `X̂ [1, ${T}, 8]`],
        qkv: ["Wq / Wk / Wv [8, 8]", `Q [1, 2, ${T}, 4]`, `K [1, 2, ${T}, 4]`, `V [1, 2, ${T}, 4]`],
        rope: ["Q → 旋转 Q′", "K → 旋转 K′ → 缓存", "V → 缓存（不旋转）"],
        residual: [`2 个头 × ${T} 位置 × 4 维`, `拼接 → [1, ${T}, 8]`, "乘 Wo，再 + X"],
        ffn: [`[1, ${T}, 8]`, `Gate / Up [1, ${T}, 24]`, "SiLU(Gate) ⊙ Up", `Down [1, ${T}, 8]`],
        layers: ["第 1 层 + FFN 残差", "→ 第 2 层", "→ 第 3 层", "→ 第 4 层"],
      };
      pills(container, shapes[frame.key]);
      const matrix = node("div", "", "lab-vector-matrix");
      for (let i = 0; i < 24; i++) {
        const cell = node("span", "");
        // A deterministic texture for floating point cells, not purported activations.
        cell.style.setProperty("--cell-opacity", String(0.18 + ((i * 7 + index * 3) % 11) / 14));
        cell.style.setProperty("--item-delay", `${i * 22}ms`);
        matrix.append(cell);
      }
      container.append(matrix, node("p", "色块表示浮点张量的局部切片；颜色无数值含义。形状中的顺序为 batch、序列、隐藏维，分头后为 batch、head、序列、head_dim。", "lab-small"));
    } else if (["queue", "schedule", "decode"].includes(frame.key)) {
      text("visual-title", "一个连续批处理迭代");
      const names = frame.key === "queue" ? ["A · 正在 Decode", "本请求 · Waiting", "C · Waiting"] : ["A · Decode 1 token", `本请求 · ${frame.round > 0 ? "Decode 1" : `Prefill ${S}`} token`, "C · 继续等待"];
      names.forEach((name, i) => container.append(node("div", name, `lab-queue-item ${i === 1 ? "is-selected" : ""}`)));
      container.append(node("p", "调度策略因引擎、版本和配置而异。邻居请求仅用于说明共享 token budget，不参与本页的张量计数。", "lab-small"));
    } else if (frame.key === "stream" || frame.key === "done") {
      text("visual-title", "从 ID 到可见文本");
      pills(container, frame.key === "done" ? ["EOS", "finish_reason: stop", "[DONE]", "KV 引用归零"] : [`ID ${100 + frame.round}`, `文本「${OUTPUT[frame.round]}」`, "SSE data 事件", "浏览器追加显示"]);
      container.append(node("p", "这里为每个演示 token 发送一个文本片段。真实服务可能合并事件、缓冲不完整字符，或使用其他流式协议。", "lab-small"));
    } else {
      text("visual-title", frame.key === "gateway" ? "路由到健康副本" : "文本 → 教学 token / ID");
      if (frame.key === "gateway") pills(container, ["replica A · 高负载", "replica B · 已选择", "replica C · 不健康"]);
      else if (frame.key === "request") {
        pills(container, ["用户输入", "messages: [{ role: user, content: … }]", "HTTPS 请求"]);
        container.append(node("p", "此刻还是文本与请求参数；到 Tokenizer 节点才会变为整数 ID。", "lab-small"));
      } else {
        const list = node("div", "", "lab-token-list");
        tokens.forEach(token => {
          const chip = node("span", "", "lab-token");
          chip.append(node("b", token.text.replace(/ /g, "␠").replace(/\n/g, "↵")), node("small", String(token.id)));
          list.append(chip);
        });
        container.append(list, node("p", `S = ${S} 个教学 token，包含 4 个模板边界 token。重复文本片段复用同一 ID；这不是模型词表。`, "lab-small"));
      }
    }
  }
  function render() {
    const f = frames[index];
    root!.dataset.playing = String(playing);
    root!.dataset.step = f.key;
    text("position", `${index + 1} / ${frames.length}`);
    progress.max = String(frames.length - 1); progress.value = String(index);
    progress.setAttribute("aria-valuetext", `第 ${index + 1} 步，${f.title}`);
    play.textContent = playing ? "暂停动画" : index === frames.length - 1 ? "重新播放" : "播放动画";
    play.setAttribute("aria-pressed", String(playing));
    el<HTMLButtonElement>("prev").disabled = index === 0;
    el<HTMLButtonElement>("next").disabled = index === frames.length - 1;
    text("phase", f.phase);
    text("round", f.round < 0 ? "请求生命周期" : f.round === 0 ? "处理整个 prompt → 预测第 1 个 token" : `Decode 第 ${f.round} 轮 → ${f.round === OUTPUT.length ? "预测 EOS" : `预测第 ${f.round + 1} 个 token`}`);
    text("step-label", `STEP ${String(index + 1).padStart(2, "0")} / ${f.phase.toUpperCase()}`);
    text("step-title", f.title); text("step-text", f.text); text("data-in", f.input);
    text("data-out", f.output); text("flow", f.flow); text("watch-text", f.watch);
    text("play-status", playing ? "正在播放" : index === frames.length - 1 ? "演示完成" : "已暂停，可单步查看");
    root!.querySelectorAll<HTMLElement>("[data-node]").forEach(item => {
      const active = item.dataset.node === f.node;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
    });
    root!.querySelectorAll<HTMLElement>("[data-chapter]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.chapter === f.phase)));
    const cache = el("cache-rows"); cache.replaceChildren();
    f.cache.forEach((n, layer) => {
      const row = node("div", "", "lab-cache-row");
      row.append(node("span", `L${layer + 1}`));
      const cells = node("div", "", "lab-cache-cells");
      for (let i = 0; i < Math.min(n, 18); i++) {
        const cell = node("i", "");
        if ((f.key === "rope" && layer === 0) || (f.key === "layers" && layer > 0)) {
          if (f.round === 0 || i === Math.min(n, 18) - 1) cell.className = "new-kv";
        }
        cells.append(cell);
      }
      if (n > 18) cells.append(node("small", `+${n - 18}`));
      row.append(cells, node("code", `${n} 位置`)); cache.append(row);
    });
    const slots = f.cache.reduce((a, b) => a + b, 0);
    text("cache-summary", `${slots * 2 * 2 * 4} 个浮点元素`);
    text("output", f.delivered ? OUTPUT.slice(0, f.delivered).join("") : "等待首个 token…");
    text("output-count", `${f.delivered} 个已返回 / ${f.generated} 个已选中（不含 EOS）`);
    text("stream-events", f.key === "done" ? "finish_reason: stop · data: [DONE]" : f.delivered ? `最后片段：${JSON.stringify(OUTPUT[f.delivered - 1])}` : "连接建立后保持等待，直到首个可用文本片段");
    const events = el("event-list"); events.replaceChildren();
    frames.slice(Math.max(0, index - 3), index + 1).forEach((event, n, list) => {
      const ordinal = index - list.length + n + 2;
      events.append(node("li", `${String(ordinal).padStart(2, "0")}  ${event.title}`));
    });
    visualize(f);
    if (!reduced.matches) {
      el("flow").getAnimations().forEach(a => a.cancel());
      el("flow").animate([{ opacity: 0.3, transform: "translateX(-8px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 400 });
    }
  }
  function stop() { clearTimeout(timer); playing = false; }
  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(() => {
      if (index < frames.length - 1) index++;
      if (index === frames.length - 1) stop();
      render(); schedule();
    }, 4500 / Number(speed.value));
  }
  function seek(next: number) { stop(); index = Math.max(0, Math.min(next, frames.length - 1)); render(); }
  play.addEventListener("click", () => {
    if (playing) stop(); else { if (index === frames.length - 1) index = 0; playing = true; }
    render(); schedule();
  });
  el("prev").addEventListener("click", () => seek(index - 1));
  el("next").addEventListener("click", () => seek(index + 1));
  el("reset").addEventListener("click", () => seek(0));
  progress.addEventListener("input", () => seek(Number(progress.value)));
  speed.addEventListener("change", schedule);
  el("form").addEventListener("submit", event => {
    event.preventDefault();
    if (!prompt.value.trim()) { prompt.setCustomValidity("请输入非空 prompt。"); prompt.reportValidity(); return; }
    activePrompt = prompt.value; frames = buildTrace(activePrompt); seek(0);
    text("play-status", "新请求已载入，点击播放或下一步");
  });
  prompt.addEventListener("input", () => { prompt.setCustomValidity(""); stop(); render(); text("play-status", "输入已修改，点击“载入请求”后生效"); });
  el("example").addEventListener("click", () => {
    prompt.value = prompt.value === "Why is the sky blue?" ? "用一句话解释 KV Cache。" : "Why is the sky blue?";
    prompt.setCustomValidity(""); activePrompt = prompt.value; frames = buildTrace(activePrompt); seek(0);
  });
  root.querySelectorAll<HTMLElement>("[data-chapter]").forEach(button => button.addEventListener("click", () => seek(frames.findIndex(f => f.phase === button.dataset.chapter))));
  root.querySelectorAll<HTMLElement>("[data-node]").forEach(button => button.addEventListener("click", () => {
    const round = Math.max(0, frames[index].round);
    let target = frames.findIndex(f => f.node === button.dataset.node && f.round === round);
    if (target < 0) target = frames.findIndex(f => f.node === button.dataset.node);
    if (target >= 0) {
      seek(target);
      if (!wide.matches) map.open = false;
    }
  }));
  document.addEventListener("visibilitychange", () => { if (document.hidden) { stop(); render(); } });
  window.addEventListener("pagehide", stop);
  render();
}
