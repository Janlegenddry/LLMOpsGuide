import { buildAdvancedTrace, mechanisms, type Mechanism } from "../lib/inference-advanced";
import { OUTPUT } from "../lib/inference-demo";

export function initAdvancedInferenceLab() {
  const root = document.querySelector<HTMLElement>("#advanced-inference");
  if (!root || root.dataset.ready) return;
  root.dataset.ready = "true";
  const el = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`#advanced-${name}`)!;
  const text = (name: string, value: string) => { el(name).textContent = value; };
  const scenario = el<HTMLSelectElement>("scenario");
  const speed = el<HTMLSelectElement>("speed");
  const progress = el<HTMLInputElement>("progress");
  const play = el<HTMLButtonElement>("play");
  let mode: Mechanism = "speculative";
  let prompt = document.querySelector<HTMLTextAreaElement>("#lab-prompt")!.value;
  let frames = buildAdvancedTrace(mode, scenario.value, prompt);
  let index = 0;
  let playing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function stop() { playing = false; clearTimeout(timer); }
  function render() {
    const frame = frames[index];
    root!.dataset.playing = String(playing);
    root!.dataset.frame = frame.key;
    play.textContent = playing ? "暂停动画" : index === frames.length - 1 ? "重新播放" : "播放动画";
    play.setAttribute("aria-pressed", String(playing));
    el<HTMLButtonElement>("prev").disabled = index === 0;
    el<HTMLButtonElement>("next").disabled = index === frames.length - 1;
    progress.max = String(frames.length - 1); progress.value = String(index);
    progress.setAttribute("aria-valuetext", `${index + 1} / ${frames.length}：${frame.title}`);
    text("position", `${index + 1} / ${frames.length}`);
    text("step-label", `${mechanisms[mode].name} / STEP ${String(index + 1).padStart(2, "0")}`);
    text("title", frame.title); text("text", frame.text); text("flow", frame.flow); text("watch", frame.watch);
    text("prompt", prompt); text("kv", `${frame.kv} 个位置`);
    text("secondary-label", mode === "speculative" ? "本轮接受草稿" : mode === "prefix" ? "池中保留前缀 / 层" : "本次接收 KV");
    text("secondary", mode === "speculative" ? `${frame.accepted} / 3` : mode === "prefix" ? `${frame.retained} 个位置` : `${frame.transferred} B${frame.ready ? " · 已就绪" : " · 未就绪"}`);
    text("status", playing ? "播放中，可随时暂停" : index === frames.length - 1 ? "本段演示结束，可切换分支" : "已暂停，可单步查看");
    text("output", OUTPUT.slice(0, frame.delivered).join("") || "等待首个 token…");
    text("output-count", `${frame.delivered} 个可见 token`);
    el("read-more").setAttribute("href", `#${mode === "speculative" ? "speculative-decoding" : mode === "prefix" ? "prefix-reuse" : "pd-disaggregation"}`);
    const lanes = frame.lanes.map((row, rowIndex) => {
      const section = document.createElement("section"); section.className = "advanced-lane";
      const label = document.createElement("h4"); label.textContent = row.name;
      const detail = document.createElement("p"); detail.textContent = row.detail;
      const items = document.createElement("div"); items.className = "advanced-cells";
      row.cells.forEach((cell, i) => {
        const item = document.createElement("span"); item.dataset.state = cell.state;
        item.textContent = `${({ waiting: "·", active: "→", accepted: "✓", rejected: "×" })[cell.state]} ${cell.text}`;
        item.style.setProperty("--item-delay", `${Math.min(i, 8) * 35}ms`); items.append(item);
      });
      section.append(label, detail, items);
      if (rowIndex < frame.lanes.length - 1) { const arrow = document.createElement("span"); arrow.className = "advanced-packet"; arrow.textContent = "↓"; arrow.setAttribute("aria-hidden", "true"); section.append(arrow); }
      return section;
    });
    el("lanes").replaceChildren(...lanes);
    el("events").replaceChildren(...frames.slice(0, index + 1).map(f => { const li = document.createElement("li"); li.textContent = f.title; return li; }));
    if (!reduced.matches) el("flow").animate([{ opacity: .35, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 350 });
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(() => { if (index < frames.length - 1) index++; if (index === frames.length - 1) stop(); render(); schedule(); }, 6000 / Number(speed.value));
  }
  function seek(next: number) { stop(); index = Math.max(0, Math.min(frames.length - 1, next)); render(); }
  function rebuild() { frames = buildAdvancedTrace(mode, scenario.value, prompt); seek(0); }
  root.querySelectorAll<HTMLButtonElement>("[data-mechanism]").forEach(button => button.addEventListener("click", () => {
    mode = button.dataset.mechanism as Mechanism;
    root.querySelectorAll("[data-mechanism]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    scenario.replaceChildren(...mechanisms[mode].scenarios.map(([value, label]) => new Option(label, value)));
    rebuild();
  }));
  scenario.addEventListener("change", rebuild);
  play.addEventListener("click", () => { if (playing) stop(); else { if (index === frames.length - 1) index = 0; playing = true; } render(); schedule(); });
  el("prev").addEventListener("click", () => seek(index - 1));
  el("next").addEventListener("click", () => seek(index + 1));
  el("reset").addEventListener("click", () => seek(0));
  progress.addEventListener("input", () => seek(Number(progress.value)));
  speed.addEventListener("change", schedule);
  document.addEventListener("inference-prompt-loaded", event => { prompt = (event as CustomEvent<string>).detail; rebuild(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { stop(); render(); } });
  window.addEventListener("pagehide", stop);
  render();
}
