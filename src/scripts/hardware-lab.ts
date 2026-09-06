import { cards, cardParts, rforkParts, cardTour, rforkTour } from "../lib/hardware-lab";
import type { HardwareScene } from "./hardware-scene";

export function initHardwareLabs() {
  document.querySelectorAll<HTMLElement>("[data-hardware-mode]").forEach(root => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = "true";
    const mode = root.dataset.hardwareMode as "card" | "rfork";
    const isCard = mode === "card";
    const el = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector<T>(`[data-hw="${name}"]`)!;
    const text = (name: string, value: string) => { const target = el(name); if (target) target.textContent = value; };
    const select = el<HTMLSelectElement>("model");
    const slider = el<HTMLInputElement>("step");
    const explode = el<HTMLInputElement>("explode");
    const play = el<HTMLButtonElement>("play");
    const speed = el<HTMLSelectElement>("speed");
    const parts = isCard ? cardParts : rforkParts;
    let card = cards[0];
    let steps = isCard ? cardTour(card) : rforkTour();
    let index = 0, playing = false, loading = false, disposed = false;
    let engine: HardwareScene | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = false;
    function stop() { playing = false; clearTimeout(timer); if (engine) engine.playing = false; }
    function showPart(id: string, pause = true) {
      const part = parts.find(p => p.id === id);
      if (!part) return;
      if (pause) {
        stop(); updatePlayback();
        if (isCard && ["die", "hbm", "package", "cooler"].includes(id)) {
          const level = id === "cooler" ? 100 : 75;
          explode.value = String(level); text("explode-value", `${level}%`); engine?.setExplosion(level);
        }
      }
      text("part-title", part.name); text("part-text", part.text); text("watch", part.watch);
      root.querySelectorAll<HTMLButtonElement>("[data-part]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.part === id)));
      engine?.highlight(id);
    }
    function updatePlayback() {
      play.textContent = playing ? "暂停导览" : index === steps.length - 1 ? "重新播放" : "播放导览";
      play.setAttribute("aria-pressed", String(playing));
      text("status", playing ? "播放中；可暂停、单步或拖动" : index === steps.length - 1 ? "导览结束，可切换卡型 / 场景" : "已暂停，可以单步查看");
    }
    function render() {
      const step = steps[index];
      root.dataset.step = String(index); root.dataset.kind = step.kind;
      slider.max = String(steps.length - 1); slider.value = String(index);
      slider.setAttribute("aria-valuetext", `${index + 1} / ${steps.length}，${step.title}`);
      text("position", `${index + 1} / ${steps.length}`);
      text("step-title", step.title); text("step-text", step.text);
      text("step-kicker", `${isCard ? card.name : "R-Fork"} / STEP ${String(index + 1).padStart(2, "0")}`);
      explode.value = String(step.explode); text("explode-value", `${step.explode}%`);
      text("bytes", `${step.progress}%`); text("mr", step.mr); text("ready", step.ready ? "Ready · 可接收推理" : "未就绪 · 不放行请求");
      el<HTMLButtonElement>("prev").disabled = index === 0;
      el<HTMLButtonElement>("next").disabled = index === steps.length - 1;
      engine?.setStep(step); if (engine) engine.playing = playing;
      showPart(step.part, false);
      text("part-title", step.title); text("part-text", step.text);
      updatePlayback();
    }
    function schedule() {
      clearTimeout(timer);
      if (!playing) return;
      timer = setTimeout(() => { index++; if (index >= steps.length - 1) { index = steps.length - 1; stop(); } render(); schedule(); }, 7000 / Number(speed.value));
    }
    function seek(next: number) { stop(); index = Math.max(0, Math.min(steps.length - 1, next)); render(); }
    async function start() {
      if (engine || loading || disposed) return;
      loading = true; el<HTMLButtonElement>("start").disabled = true; text("start", "正在载入…");
      try {
        const { HardwareScene } = await import("./hardware-scene");
        if (disposed) return;
        engine = new HardwareScene(el("canvas"), mode, id => showPart(id));
        if (isCard) engine.buildCard(card); else engine.buildRFork();
        engine.visible = visible; engine.showLabels(el<HTMLInputElement>("labels").checked);
        el("load").hidden = true; root.dataset.webgl = "ready"; render();
      } catch (error) {
        engine?.dispose(); engine = undefined;
        root.dataset.webgl = "unavailable"; text("start", "重试 3D");
        text("load-note", "当前浏览器无法载入 WebGL 场景。可重试，或继续使用部件说明与逐步导览；尝试开启硬件加速后刷新页面。");
        el<HTMLButtonElement>("start").disabled = false;
        console.warn("Hardware 3D initialization unavailable", error);
      } finally { loading = false; }
    }
    select.addEventListener("change", () => {
      stop(); index = 0;
      if (isCard) {
        card = cards.find(c => c.id === select.value)!; steps = cardTour(card);
        text("family", card.family); text("memory", card.memory); text("evidence", card.evidence);
        engine?.buildCard(card);
      } else steps = rforkTour(select.value === "failure");
      engine?.showLabels(el<HTMLInputElement>("labels").checked);
      render();
    });
    play.addEventListener("click", () => {
      if (playing) stop(); else { if (index === steps.length - 1) index = 0; playing = true; }
      render(); schedule(); void start();
    });
    el("prev").addEventListener("click", () => seek(index - 1));
    el("next").addEventListener("click", () => seek(index + 1));
    el("reset").addEventListener("click", () => { seek(0); engine?.preset("iso"); });
    el("start").addEventListener("click", start);
    slider.addEventListener("input", () => seek(Number(slider.value)));
    speed.addEventListener("change", schedule);
    explode.addEventListener("input", () => { stop(); text("explode-value", `${explode.value}%`); engine?.setExplosion(Number(explode.value)); updatePlayback(); });
    root.querySelectorAll<HTMLButtonElement>("[data-part]").forEach(b => b.addEventListener("click", () => showPart(b.dataset.part!)));
    root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b => b.addEventListener("click", () => engine?.preset(b.dataset.view!)));
    el("zoom-in").addEventListener("click", () => engine?.zoom(1.15));
    el("zoom-out").addEventListener("click", () => engine?.zoom(.85));
    el<HTMLInputElement>("labels").addEventListener("change", e => engine?.showLabels((e.target as HTMLInputElement).checked));
    el("canvas").addEventListener("hardware-context-lost", () => {
      stop(); updatePlayback(); engine?.dispose(); engine = undefined;
      root.dataset.webgl = "unavailable"; el("load").hidden = false;
      text("load-note", "3D 图形上下文已中断。可重新载入；文字导览仍可使用。");
      text("start", "重新载入 3D"); el<HTMLButtonElement>("start").disabled = false;
    });
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (engine) engine.visible = visible;
      if (visible) void start(); else { stop(); updatePlayback(); }
    }, { threshold: 0 });
    observer.observe(root);
    document.addEventListener("visibilitychange", () => { if (document.hidden) { stop(); updatePlayback(); } });
    window.addEventListener("pagehide", event => {
      stop(); updatePlayback();
      if (!event.persisted) { disposed = true; observer.disconnect(); engine?.dispose(); }
    });
    render();
  });
}
