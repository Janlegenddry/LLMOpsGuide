// Original responsive technical figures. Coordinates and SVG markup are generated here,
// never imported from a payload; every payload label is XML-escaped.
export const figurePalette = {
  compute: ['#edf4fd', '#4776a8'], kv: ['#edf7f2', '#438779'],
  communication: ['#fff7e6', '#aa7d35'], control: ['#f3effa', '#8563a2'],
  danger: ['#fbefeb', '#ad6250'], neutral: ['#f5f7f8', '#697985'],
};
export const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const wrap = (value, count) => {
  const out = []; let line = '', length = 0;
  const tokens = String(value).match(/[A-Za-z0-9_/-]+|[^A-Za-z0-9_/-]/gu) || [];
  for (const token of tokens) {
    const size = [...token].reduce((n, c) => n + (/[\u0000-\u007f]/.test(c) ? .58 : 1), 0);
    if (line && length + size > count) { out.push(line.trimEnd()); line = ''; length = 0; }
    line += token; length += size;
  }
  if (line) out.push(line); return out;
};

function canvas(width, height, id) {
  const parts = [];
  const text = (x, y, value, size = 14, color = '#293c4a', anchor = 'middle') => parts.push(`<text x="${x}" y="${y}" fill="${color}" stroke="none" font-size="${size}" text-anchor="${anchor}">${xml(value)}</text>`);
  const rect = (x, y, w, h, tone = 'neutral', radius = 9, dashed = false) => {
    const [fill, stroke] = figurePalette[tone] || figurePalette.neutral;
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${dashed ? ' stroke-dasharray="5 4"' : ''}/>`);
  };
  const panel = (x, y, w, h, title, tone = 'neutral') => { rect(x, y, w, h, 'neutral', 12); const [, color] = figurePalette[tone]; text(x + 16, y + 26, title, 15, color, 'start'); };
  const line = (points, label = '', tone = 'neutral', dashed = false, labelPoint) => {
    const [, color] = figurePalette[tone] || figurePalette.neutral;
    parts.push(`<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round"${dashed ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#${id}-${tone})"/>`);
    if (label) {
      const a = points[0], b = points.at(-1), pos = labelPoint || [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 7];
      const size = 12, w = Math.max(30, [...label].reduce((n, c) => n + (/[\u0000-\u007f]/.test(c) ? 7 : 12), 0) + 10);
      parts.push(`<rect x="${pos[0] - w / 2}" y="${pos[1] - 13}" width="${w}" height="18" rx="3" fill="#fff" stroke="none"/>`); text(pos[0], pos[1], label, size, color);
    }
  };
  const card = (node, x, y, w, h = 82, tone) => {
    rect(x, y, w, h, tone || node.tone || 'compute', 8);
    const labelSize = width <= 320 ? 18 : w < 115 ? 14 : 16, subSize = width <= 320 ? 14 : 12;
    const labels = wrap(node.shortLabel || node.label, Math.floor((w - 20) / labelSize));
    const subtitles = node.subtitle ? wrap(node.subtitle, Math.floor((w - 20) / subSize)) : [];
    const total = labels.length * 20 + subtitles.length * 16;
    let baseline = y + Math.max(22, (h - total) / 2 + 15);
    labels.forEach(s => { text(x + w / 2, baseline, s, labelSize); baseline += 20; });
    subtitles.forEach(s => { text(x + w / 2, baseline, s, subSize, '#62717c'); baseline += 16; });
  };
  const svg = (title, caption) => `<svg xmlns="http://www.w3.org/2000/svg" class="technical-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" style="font-family:Arial,'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif"><title id="${id}-title">${xml(title)}</title><desc id="${id}-desc">${xml(caption)}</desc><defs>${Object.entries(figurePalette).map(([tone, [, color]]) => `<marker id="${id}-${tone}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${color}" stroke="none"/></marker>`).join('')}</defs><rect width="${width}" height="${height}" fill="#fff" stroke="none"/>${parts.join('')}</svg>`;
  return { text, rect, panel, line, card, svg, parts };
}

export function renderNumericalFigure(chart, { compact = false, id = 'numerical-figure' } = {}) {
  const W = compact ? 320 : 760;
  const finish = c => ({ svg: c.svg(chart.title, chart.caption), width: W });
  if (chart.layout === 'token-cost') {
    const cols = Math.min(3, chart.series.length), rows = Math.ceil(chart.series.length / cols);
    const c = canvas(W, compact ? chart.series.length * 146 + 14 : rows * 284 + 12, id);
    const costs = chart.series.map(s => s.segments[0].value / s.deliveredTokens), max = Math.max(...costs);
    chart.series.forEach((series, i) => {
      const elapsed = series.segments[0].value, delivered = series.deliveredTokens, cost = costs[i], display = Number(cost.toPrecision(4)).toString();
      const cardWidth = (W - 24 - (cols - 1) * 8) / cols;
      const x = compact ? 12 : 12 + (i % cols) * (cardWidth + 8), y = compact ? 12 + i * 146 : 12 + Math.floor(i / cols) * 284, w = compact ? 296 : cardWidth, h = compact ? 132 : 270;
      c.rect(x, y, w, h, i ? 'control' : 'neutral', 12); c.text(x + 16, y + 27, series.label, 15, '#293c4a', 'start');
      if (compact) {
        c.text(x + 16, y + 62, `${elapsed} ${chart.unit} ÷ ${delivered} token`, 17, '#62717c', 'start'); c.text(x + w - 22, y + 67, display, 27, '#8563a2', 'end');
        c.text(x + w - 22, y + 90, `${chart.unit}/token`, 12, '#8563a2', 'end');
        c.rect(x + 16, y + 105, (w - 32) * cost / max, 10, i ? 'control' : 'neutral', 3);
      } else {
        c.text(x + w / 2, y + 77, `${elapsed} ${chart.unit}`, 28); c.parts.push(`<line x1="${x + 46}" y1="${y + 94}" x2="${x + w - 46}" y2="${y + 94}" stroke="#697985" stroke-width="1.5"/>`);
        c.text(x + w / 2, y + 123, `${delivered} 有效 token`, 17, '#62717c'); c.text(x + w / 2, y + 180, `${display} ${chart.unit}/token`, 24, '#8563a2');
        c.rect(x + 22, y + 204, (w - 44) * cost / max, 14, i ? 'control' : 'neutral', 4); c.text(x + w / 2, y + 245, '完整轮次墙钟 / 实际提交数', 12, '#62717c');
      }
    });
    return [finish(c)];
  }
  if (chart.layout === 'rank-timeline') {
    const max = Math.max(...chart.series.map(s => s.segments[0].value + s.segments[1].value)), left = compact ? 60 : 94, plot = W - left - 28;
    const panelHeight = 136 + Math.max(...chart.series.map(s => s.rankTimes.length)) * 34;
    const render = (seriesList, identifier) => {
      const c = canvas(W, seriesList.length * panelHeight + 12, identifier);
      c.parts.push(`<defs><pattern id="${identifier}-waiting" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f5f6f7" stroke="none"/><path d="M0 6L6 0" stroke="#d5dce1" stroke-width="1"/></pattern></defs>`);
      seriesList.forEach((series, panelIndex) => {
        const top = panelIndex * panelHeight + 12, compute = series.segments[0].value, comm = series.segments[1].value;
        c.panel(12, top, W - 24, panelHeight - 12, series.label, 'compute');
        c.text(W - 25, top + 26, `${compute + comm} ${chart.unit}`, 18, '#aa7d35', 'end');
        c.text(28, top + 55, `同步 ${compute} ${chart.unit} · 通信 ${comm} ${chart.unit}`, 12, '#62717c', 'start');
        series.rankTimes.forEach((value, rank) => {
          const y = top + 80 + rank * 34, waiting = compute - value;
          c.text(left - 12, y + 18, `r${rank}`, 14, '#697985', 'end');
          c.rect(left, y, value / max * plot, 24, 'compute', 2); c.text(left + value / max * plot / 2, y + 17, String(value), 12);
          if (waiting) { c.parts.push(`<rect x="${left + value / max * plot}" y="${y}" width="${waiting / max * plot}" height="24" fill="url(#${identifier}-waiting)" stroke="#d5dce1" stroke-width="1"/>`); c.text(left + (value + waiting / 2) / max * plot, y + 17, compact ? String(waiting) : `等待 ${waiting}`, 12, '#697985'); }
          c.rect(left + compute / max * plot, y, comm / max * plot, 24, 'communication', 2); c.text(left + (compute + comm / 2) / max * plot, y + 17, String(comm), 12, '#aa7d35');
        });
        const sync = left + compute / max * plot;
        c.parts.push(`<line x1="${sync}" y1="${top + 70}" x2="${sync}" y2="${top + panelHeight - 55}" stroke="#4776a8" stroke-width="1.5" stroke-dasharray="4 3"/>`);
        [0, max / 3, max * 2 / 3, max].forEach(tick => c.text(left + tick / max * plot, top + panelHeight - 35, String(Number(tick.toPrecision(3))), 12, '#697985'));
        c.text(W / 2, top + panelHeight - 17, `相同时间尺度（${chart.unit}）· 忽略重叠`, 12, '#697985');
      });
      return finish(c);
    };
    return compact ? chart.series.map((s, i) => render([s], `${id}-${i}`)) : [render(chart.series, id)];
  }
  // Legacy bars remain supported, now fitting the reading column without a fixed-width scroll.
  const max = Math.max(...chart.series.map(s => s.segments.reduce((n, v) => n + v.value, 0))), c = canvas(W, chart.series.length * 100 + 20, id);
  chart.series.forEach((s, i) => {
    const y = 20 + i * 100, left = 22, plot = W - 72; let start = left;
    c.text(left, y, s.label, 14, '#293c4a', 'start');
    s.segments.forEach((v, j) => { const w = v.value / max * plot; c.rect(start, y + 18, w, 32, j % 2 ? 'communication' : 'compute', 2); start += w; });
    c.text(left, y + 76, s.segments.map(v => `${v.label} ${v.value}`).join(' + ') + ` ${chart.unit}`, 12, '#62717c', 'start');
  });
  return [finish(c)];
}

export function renderTechnicalFigure(diagram, { compact = false, id = 'technical-figure' } = {}) {
  const { kind, panels } = diagram.presentation;
  const nodes = new Map(diagram.nodes.map(n => [n.id, n]));
  const groups = panels.map(p => ({ ...p, nodes: p.nodeIds.map(id => nodes.get(id)) }));
  const edge = (a, b, fallback = '') => { const e = diagram.edges.find(e => e.from === a.id && e.to === b.id); return e?.shortLabel || fallback; };
  const W = compact ? 320 : 760;
  const finish = (c, suffix = '') => ({ svg: c.svg(diagram.title + suffix, diagram.caption), width: W });

  if (kind === 'build-runtime') {
    if (compact) {
      const lanes = groups.slice(0, 3).map((g, i) => {
        const c = canvas(W, 450, `${id}-lane-${i}`); c.panel(12, 12, 296, 426, g.title, g.tone);
        g.nodes.forEach((n, j) => { const y = 56 + j * 132; c.card(n, 32, y, 256, 82); if (j < 2) c.line([[86, y + 86], [86, y + 128]], j ? '核验来源 / 哈希 / 路径' : '来源 → 产物', g.tone, false, [208, y + 114]); });
        return finish(c, ` · ${g.title}`);
      });
      const c = canvas(W, 204, `${id}-base`); c.panel(12, 12, 296, 180, groups[3].title);
      c.card(groups[3].nodes[0], 32, 54, 256, 78); c.text(160, 159, '分别约束三条运行路径', 14); c.text(160, 179, '兼容性约束 ≠ 自动重写产物', 13, '#697985');
      return [...lanes, finish(c, ' · 独立基础层')];
    }
    const c = canvas(W, 592, id);
    ['构建来源', '交付产物', '进程实际使用'].forEach((s, i) => c.text(130 + i * 245, 25, s, 15));
    groups.slice(0, 3).forEach((g, i) => {
      const y = 44 + i * 142; c.panel(12, y, 736, 130, g.title, g.tone);
      g.nodes.forEach((n, j) => c.card(n, 26 + j * 245, y + 44, 208, 74));
      c.line([[238, y + 82], [267, y + 82]], '', g.tone); c.line([[483, y + 82], [512, y + 82]], '', g.tone);
      c.text(498, y + 37, '核验点', 12, figurePalette[g.tone][1]);
    });
    c.card(groups[3].nodes[0], 22, 510, 280, 66); c.text(496, 529, '分别连接三个运行节点 · 独立兼容性约束', 13);
    [0, 1, 2].forEach(i => c.line([[306, 543], [314, 543], [314, 584], [752, 584], [752, 126 + i * 142], [728, 126 + i * 142]], '', 'neutral', true));
    c.text(496, 558, '不会自动重写 wheel、扩展或缓存产物', 13, '#697985'); return [finish(c)];
  }

  if (kind === 'causal-branches') {
    if (compact) {
      const root = canvas(W, 130, `${id}-root`); root.card(groups[0].nodes[0], 20, 12, 280, 92); root.text(160, 124, '分叉：编译产物 / 库调用', 14);
      const branches = groups.slice(1, 3).map((g, i) => {
        const c = canvas(W, 406, `${id}-branch-${i}`); c.panel(12, 12, 296, 382, g.title, g.tone);
        g.nodes.forEach((n, j) => { const y = 54 + j * 110; c.card(n, 32, y, 256, 80); if (j < 2) c.line([[160, y + 84], [160, y + 106]], '', g.tone); });
        c.text(160, 380, '两条路径均汇入独立参考', 13, '#438779'); return finish(c, ` · ${g.title}`);
      });
      const join = canvas(W, 258, `${id}-join`); groups[3].nodes.forEach((n, j) => join.card(n, 32, 12 + j * 142, 256, 86)); join.line([[160, 102], [160, 150]], '归因', 'kv', false, [204, 130]);
      return [finish(root), ...branches, finish(join, ' · 汇合')];
    }
    const c = canvas(W, 686, id); c.card(groups[0].nodes[0], 242, 12, 276, 76);
    groups.slice(1, 3).forEach((g, i) => {
      const x = 16 + i * 380; c.panel(x, 140, 348, 370, g.title, g.tone);
      c.line([[380, 92], [380, 112], [x + 174, 112], [x + 174, 136]], i ? '库调用' : '编译产物', g.tone, false, [x + 174, 106]);
      g.nodes.forEach((n, j) => { const y = 190 + j * 104; c.card(n, x + 22, y, 304, 80); if (j < 2) c.line([[x + 174, y + 84], [x + 174, y + 100]], '', g.tone); });
      c.line([[x + 174, 482], [x + 174, 534], [380, 534], [380, 550]], '', 'kv');
    });
    groups[3].nodes.forEach((n, j) => c.card(n, 222 + j * 310, 554, j ? 208 : 260, 92));
    c.line([[486, 600], [528, 600]], '归因', 'kv', false, [507, 581]);
    c.text(380, 671, '红色仅标待核验环节 · 不代表全部 GPU 已触发', 13, '#697985'); return [finish(c)];
  }

  if (kind === 'kv-map') {
    const c = canvas(W, compact ? 710 : 594, id), x = compact ? 20 : 162, cell = compact ? 60 : 106, boundaryX = x + cell * 2 + 8;
    c.text(W / 2, 25, '逻辑位置 →（原创抽象，不是块数参数）', compact ? 12 : 15);
    for (let row = 0; row < 3; row++) {
      const y = 82 + row * (compact ? 134 : 110);
      c.text(compact ? 20 : 24, compact ? y - 14 : y + 32, groups[row].title, 14, '#293c4a', 'start');
      for (let col = 0; col < (row === 2 ? 1 : 4); col++) c.rect(x + col * (cell + 6), y, cell, 70, 'neutral', 4, true);
      if (row === 2) c.text(x + cell + 12, y + 20, '仅索引零保留 R', 13, '#697985', 'start');
      groups[row].nodes.forEach((n, col) => {
        const cardX = x + col * (cell + 6); c.rect(cardX, y, cell, 70, row ? 'communication' : 'compute', 4);
        c.text(cardX + cell / 2, y + 29, n.shortLabel || n.label, 22); c.text(cardX + cell / 2, y + 51, row === 2 ? '索引零' : row === 1 ? '新分配' : '复用', 12);
      });
    }
    c.parts.push(`<line x1="${boundaryX}" y1="48" x2="${boundaryX}" y2="${compact ? 447 : 384}" stroke="#697985" stroke-width="1.5" stroke-dasharray="5 4"/>`);
    c.text(boundaryX + (compact ? 0 : 68), 56, '逻辑命中边界', 12, '#697985');
    const y = compact ? 472 : 422, w = compact ? 132 : 292, right = compact ? 168 : 438;
    c.card(groups[3].nodes[0], 20, y, w, 94); c.card(groups[3].nodes[1], right, y, w, 94);
    c.line([[20 + w / 2, y - 4], [compact ? 8 : 140, y - 4], [compact ? 8 : 140, compact ? 292 : 272], [x + cell / 2, compact ? 292 : 272], [x + cell / 2, compact ? 290 : 266]], '', 'danger', true);
    const rail = compact ? 307 : 746;
    [compact ? 251 : 235, compact ? 385 : 345].forEach(target => c.line([[right + w - 4, y + 40], [rail, y + 40], [rail, target], [x + cell + 4, target]], '', 'kv'));
    c.text(W / 2, y + 128, '虚线：旧筛选可能遗漏 X', 14, '#ad6250'); c.text(W / 2, y + 151, '实线：按本次分配身份识别 X、R', 14, '#438779');
    if (compact) { c.text(160, 670, '蓝：本地复用 · 橙：传输目标', 13); c.text(160, 692, '灰：无需保留 · R 只在索引零', 13); }
    return [finish(c)];
  }

  if (kind === 'kv-zeroing') {
    const [allocator, connector, executor, risk] = groups;
    // Forks show concurrent writers. No arrow connects load X to zero X.
    const old = canvas(W, compact ? 624 : 378, `${id}-old`);
    old.text(W / 2, 28, '旧判断：两任务可交叠，箭头不保证先后', compact ? 13 : 16);
    if (compact) {
      old.card(allocator.nodes[0], 40, 54, 240, 84); old.text(160, 158, '分配器登记两项任务', 13);
      old.card(connector.nodes[0], 18, 218, 136, 114); old.card(executor.nodes[0], 166, 218, 136, 114);
      old.line([[160, 142], [160, 188], [86, 188], [86, 214]], '', 'communication'); old.line([[160, 188], [234, 188], [234, 214]], '', 'danger');
      old.text(50, 207, '连接器', 13); old.text(270, 207, '执行器', 13);
      old.line([[86, 336], [86, 378], [160, 414]], '', 'communication'); old.line([[234, 336], [234, 378], [160, 414]], '', 'danger');
      old.card(risk.nodes[0], 40, 454, 240, 88); old.text(160, 581, '传输完成 ≠ 另一任务不会覆盖', 13, '#ad6250');
    } else {
      [allocator, connector, executor].forEach((g, i) => old.panel(12 + i * 250, 48, 236, 208, g.title, g.tone));
      old.card(allocator.nodes[0], 26, 120, 208, 86); old.card(connector.nodes[0], 276, 120, 208, 86); old.card(executor.nodes[0], 526, 120, 208, 86);
      old.line([[238, 145], [250, 145], [250, 100], [380, 100], [380, 116]], '', 'communication'); old.line([[238, 181], [250, 181], [250, 86], [630, 86], [630, 116]], '', 'danger');
      old.line([[380, 210], [380, 266], [380, 284]], '', 'communication'); old.line([[630, 210], [630, 266], [384, 284]], '', 'danger'); old.card(risk.nodes[0], 226, 290, 308, 70);
    }
    const crossY = compact ? 416 : 273; old.parts.push(`<path d="M${W / 2 - 9} ${crossY - 9}l18 18m0-18l-18 18" stroke="#ad6250" stroke-width="3" fill="none"/>`);
    const newer = canvas(W, compact ? 824 : 606, `${id}-new`);
    newer.text(W / 2, 28, '新判断：声明先于本次分配 · 仅控制新块', compact ? 13 : 16);
    if (compact) {
      newer.card(connector.nodes[1], 40, 48, 240, 82); newer.text(184, 154, '连接器 → 分配器：加载组声明', 13); newer.line([[60, 134], [60, 174]], '', 'control');
      newer.panel(12, 186, 296, 356, '本次加载目标 X', 'kv'); newer.card(allocator.nodes[1], 32, 236, 256, 82); newer.card(connector.nodes[2], 32, 360, 256, 82); newer.line([[86, 322], [86, 356]], '', 'communication'); newer.text(185, 344, '不登记同一步清零', 13, '#438779');
      newer.card(executor.nodes[1], 32, 474, 256, 54); newer.line([[60, 446], [60, 470]], '', 'kv'); newer.text(184, 464, '满足实际完成条件后读取', 12, '#438779');
      newer.panel(12, 570, 296, 238, '未加载的新块 Y', 'compute'); newer.card(allocator.nodes[2], 32, 616, 256, 66); newer.card(executor.nodes[2], 32, 732, 256, 58); newer.line([[160, 686], [160, 728]], '仍清零', 'compute', false, [211, 711]);
      newer.line([[284, 89], [312, 89], [312, 649], [292, 649]], '', 'neutral', true);
    } else {
      [allocator, connector, executor].forEach((g, i) => newer.panel(12 + i * 250, 48, 236, 530, g.title, g.tone));
      newer.card(connector.nodes[1], 276, 100, 208, 82); newer.card(allocator.nodes[1], 26, 228, 208, 82); newer.card(connector.nodes[2], 276, 228, 208, 82); newer.card(executor.nodes[1], 526, 228, 208, 82);
      newer.line([[272, 141], [130, 141], [130, 224]], '先声明', 'control', false, [168, 130]); newer.line([[238, 269], [272, 269]], '', 'communication'); newer.line([[488, 269], [522, 269]], '', 'kv');
      newer.text(380, 347, 'X 不登记同一步清零；读取仍需真实完成与依赖', 14, '#438779');
      newer.card(allocator.nodes[2], 26, 426, 208, 82); newer.card(executor.nodes[2], 526, 426, 208, 82);
      newer.line([[380, 186], [252, 186], [252, 386], [130, 386], [130, 422]], '未加载组', 'neutral', true, [191, 385]); newer.line([[238, 467], [522, 467]], 'Y 仍保留必要清零', 'compute', false, [380, 453]);
      newer.text(380, 555, '组声明不是传输完成证明 · 不清除历史任务的顺序要求', 13, '#697985');
    }
    return [finish(old, ' · 潜在双写'), finish(newer, ' · 本次清零控制')];
  }

  if (kind === 'acceptance-gates' || kind === 'release-gates') {
    const acceptance = kind === 'acceptance-gates', count = groups[0].nodes.length, step = compact ? 120 : 104, bottom = 54 + count * step;
    const c = canvas(W, compact ? bottom + 286 : bottom + 32, id), x = compact ? 68 : 56, w = compact ? 238 : 396;
    c.text(W / 2, 28, acceptance ? '前五道门通过，才逐步放量' : '四种证据分别核验，不等同已交付', compact ? 13 : 16);
    groups[0].nodes.forEach((n, i) => {
      const y = 52 + i * step; c.card(n, x, y, w, 82); c.text(x - 19, y + 43, String(i + 1), 16);
      if (i < count - 1) c.line([[x + w / 2, y + 86], [x + w / 2, y + step - 4]], acceptance ? '通过' : '', acceptance ? 'kv' : 'neutral', !acceptance, [x + w / 2 + 45, y + step - 8]);
      if (acceptance && i < 5) c.line(compact ? [[x - 4, y + 63], [22, y + 63], [22, bottom + 38], [28, bottom + 38]] : [[x - 4, y + 63], [22, y + 63], [22, bottom], [492, bottom], [492, 125], [514, 125]], '', 'danger', true);
    });
    const sideX = compact ? 30 : 518, sideY = compact ? bottom + 14 : 84, sideW = compact ? 276 : 216;
    groups[1].nodes.forEach((n, i) => c.card(n, sideX, sideY + i * 116, sideW, 92));
    if (acceptance) c.line([[sideX + sideW / 2, sideY + 96], [sideX + sideW / 2, sideY + 112]], '', 'danger');
    else { c.text(sideX + sideW / 2, sideY - 12, '相邻开放 PR · 未合入', 13, '#697985'); c.text(sideX + sideW / 2, sideY + 242, '不并入已完成能力', 13, '#697985'); }
    if (!compact && acceptance) c.text(626, 363, '证据不足 / 未通过', 13, '#ad6250');
    return [finish(c)];
  }

  if (kind === 'memory-budget') {
    const c = canvas(W, compact ? 530 : 420, id), gap = compact ? 14 : 16, cols = compact ? 2 : 4, cardW = compact ? 130 : 160;
    c.panel(12, 12, W - 24, compact ? 506 : 396, groups[0].nodes[0].shortLabel || groups[0].nodes[0].label, 'kv');
    c.text(W / 2, 66, '共同扣减 · 非面积占比', 13, '#697985');
    groups[1].nodes.forEach((n, i) => { const x = (compact ? 23 : 28) + (i % cols) * (cardW + gap), y = 94 + Math.floor(i / cols) * 112; c.card(n, x, y, cardW, 92); c.text(x + cardW / 2, y - 10, '−', 19, '#697985'); });
    const y = compact ? 326 : 222;
    c.parts.push(`<path d="M28 ${y - 14}v12H${W - 28}v-12" fill="none" stroke="#697985" stroke-width="1.5"/>`);
    c.line([[W / 2, y], [W / 2, y + 36]], '扣除全部预算', 'kv', false, [W / 2 + (compact ? 69 : 84), y + 24]);
    c.card(groups[2].nodes[0], compact ? 34 : 210, y + 48, compact ? 252 : 340, 90, 'kv');
    c.text(W / 2, y + 167, 'KV余量 = 设备内存 − 四类预算', compact ? 13 : 15, '#438779');
    return [finish(c)];
  }

  if (kind === 'request-lanes') {
    if (compact) {
      const results = [];
      const a = canvas(W, 230, `${id}-intake`); a.panel(12, 12, 296, 204, groups[0].title, 'neutral');
      a.card(groups[0].nodes[0], 24, 66, 126, 92, 'neutral'); a.card(groups[0].nodes[1], 170, 66, 126, 92, 'neutral'); a.line([[152, 112], [166, 112]], '', 'neutral'); a.text(160, 193, '准入后进入 Prefill', 14); results.push(finish(a, ' · 入口'));
      const p = canvas(W, 278, `${id}-prefill`); p.panel(12, 12, 296, 252, groups[1].title, 'compute');
      p.card(groups[1].nodes[0], 32, 58, 256, 78, 'compute'); p.card(groups[1].nodes[1], 32, 180, 256, 64, 'communication'); p.line([[160, 140], [160, 176]], '生成KV', 'kv', false, [210, 162]); results.push(finish(p, ' · P实例'));
      const d = canvas(W, 640, `${id}-decode`); d.panel(12, 12, 296, 614, groups[2].title, 'compute'); d.card(groups[2].nodes[0], 40, 58, 240, 78, 'compute');
      d.text(160, 184, '投机控制回路 · 启用时', 14, '#8563a2'); d.rect(28, 202, 240, 306, 'control', 12, true);
      [1, 2, 3].forEach((index, i) => { d.card(groups[2].nodes[index], 44, 220 + i * 92, 208, 68, 'control'); if (i < 2) d.line([[148, 292 + i * 92], [148, 308 + i * 92]], '', 'control'); });
      d.line([[160, 140], [160, 196]], '候选路径', 'control', true, [216, 164]); d.line([[252, 438], [292, 438], [292, 152], [164, 152], [164, 140]], '下一轮', 'control', true, [268, 301]);
      d.card(groups[2].nodes[4], 40, 548, 240, 60, 'kv'); d.line([[40, 98], [20, 98], [20, 578], [36, 578]], '', 'kv'); d.text(160, 534, '只返回已提交的有效 token', 12, '#438779'); results.push(finish(d, ' · D实例'));
      return results;
    }
    const c = canvas(W, 564, id);
    c.panel(20, 28, 160, 330, groups[0].title, 'neutral'); c.panel(212, 28, 180, 330, groups[1].title, 'compute'); c.panel(424, 28, 316, 520, groups[2].title, 'compute');
    c.card(groups[0].nodes[0], 36, 88, 128, 82, 'neutral'); c.card(groups[0].nodes[1], 36, 236, 128, 82, 'neutral'); c.line([[100, 174], [100, 232]], '排队', 'neutral', false, [134, 207]);
    c.card(groups[1].nodes[0], 228, 88, 148, 82, 'compute'); c.card(groups[1].nodes[1], 228, 236, 148, 82, 'communication'); c.line([[302, 174], [302, 232]], '生成KV', 'kv', false, [342, 207]);
    c.line([[168, 277], [196, 277], [196, 129], [224, 129]], '准入', 'neutral', false, [196, 205]);
    c.card(groups[2].nodes[0], 460, 88, 244, 82, 'compute'); c.line([[380, 277], [410, 277], [410, 129], [456, 129]], '就绪', 'communication', false, [410, 205]);
    c.rect(440, 232, 284, 184, 'control', 12, true); c.text(582, 258, '投机控制回路', 14, '#8563a2');
    [1, 2, 3].forEach((index, i) => c.card(groups[2].nodes[index], 452 + i * 92, 280, 76, 88, 'control'));
    c.line([[532, 324], [540, 324]], '', 'control'); c.line([[624, 324], [632, 324]], '', 'control');
    c.line([[582, 174], [582, 204], [490, 204], [490, 276]], '启用时', 'control', true, [528, 198]);
    c.line([[674, 372], [674, 436], [448, 436], [448, 190], [582, 190], [582, 174]], '下一轮生成', 'control', true, [555, 436]);
    c.card(groups[2].nodes[4], 460, 466, 244, 64, 'kv'); c.line([[708, 129], [732, 129], [732, 498], [708, 498]], '流式输出', 'kv', false, [693, 455]);
    c.text(302, 340, 'KV 跨实例交接', 13, '#aa7d35'); return [finish(c)];
  }

  if (kind === 'lifecycle') {
    return groups.map((g, panelIndex) => {
      const c = canvas(W, compact ? 490 : 246, `${id}-${panelIndex}`), tone = panelIndex ? 'kv' : 'danger';
      c.panel(12, 12, W - 24, compact ? 466 : 222, g.title, tone);
      g.nodes.forEach((n, i) => {
        const x = compact ? 30 : 30 + i * 184, y = compact ? 62 + i * 96 : 74, w = compact ? 236 : 148;
        c.card(n, x, y, w, compact ? 72 : 90, i === 3 ? tone : (n.tone || 'neutral'));
        if (i < 3) c.line(compact ? [[148, y + 76], [148, y + 92]] : [[x + 152, y + 45], [x + 180, y + 45]], edge(n, g.nodes[i + 1]), tone, false, compact ? [211, y + 87] : [x + 166, y - 10]);
      });
      if (compact) { c.rect(284, 64, 8, 358, tone, 4); c.text(160, 456, panelIndex ? '确认 / 异常路径满足后释放' : '页已复用，旧写入仍可能迟到', 13, figurePalette[tone][1]); }
      else { c.rect(panelIndex ? 30 : 214, 188, panelIndex ? 514 : 516, 24, tone, 4, !panelIndex); c.text(panelIndex ? 287 : 472, 205, panelIndex ? '页和元数据暂留：不能提前复用' : '危险窗口：页面已属于 B，A 仍可能写入', 13, figurePalette[tone][1]); }
      return finish(c, ` · ${g.title}`);
    });
  }

  if (kind === 'cache-routing') {
    const c = canvas(W, compact ? 598 : 376, id), [entry, core, state] = groups;
    if (compact) {
      c.panel(12, 12, 296, 572, '缓存核心与状态所有权', 'compute');
      c.card(entry.nodes[0], 48, 56, 224, 68, 'neutral'); c.card(entry.nodes[1], 48, 164, 224, 68, 'neutral'); c.line([[160, 128], [160, 160]], '统一入口', 'neutral', false, [212, 146]);
      core.nodes.forEach((n, i) => c.card(n, 24 + i * 146, 310, 126, 84, i ? 'neutral' : 'compute'));
      c.line([[160, 236], [160, 270], [88, 270], [88, 306]], '支持', 'compute', false, [80, 261]); c.line([[160, 236], [160, 270], [232, 270], [232, 306]], '回退', 'neutral', true, [240, 261]);
      c.line([[88, 398], [88, 436], [160, 436], [160, 482]], '', 'kv'); c.line([[232, 398], [232, 436], [160, 436]], '', 'neutral'); c.card(state.nodes[0], 48, 486, 224, 72, 'kv'); c.text(160, 463, '匹配 / 淘汰 / 锁语义一致', 13, '#438779');
    } else {
      c.panel(12, 12, 220, 350, entry.title, 'neutral'); c.panel(260, 12, 224, 350, core.title, 'compute'); c.panel(512, 12, 236, 350, state.title, 'kv');
      c.card(entry.nodes[0], 30, 76, 184, 76, 'neutral'); c.card(entry.nodes[1], 30, 238, 184, 76, 'neutral'); c.line([[122, 156], [122, 234]], '统一入口', 'neutral');
      c.card(core.nodes[0], 280, 72, 184, 82, 'compute'); c.card(core.nodes[1], 280, 238, 184, 82, 'neutral'); c.card(state.nodes[0], 534, 164, 192, 90, 'kv');
      c.line([[218, 276], [246, 276], [246, 113], [276, 113]], '支持', 'compute', false, [246, 191]); c.line([[218, 276], [276, 279]], '回退', 'neutral', true, [246, 269]);
      c.line([[468, 113], [498, 113], [498, 209], [530, 209]], '', 'kv'); c.line([[468, 279], [498, 279], [498, 209]], '', 'neutral');
    }
    return [finish(c)];
  }

  if (kind === 'decision-gates') {
    const c = canvas(W, compact ? 580 : 500, id), x = compact ? 78 : 160, w = compact ? 224 : 564, step = compact ? 114 : 98;
    groups.forEach((g, i) => { const y = 24 + i * step; c.card(g.nodes[0], x, y, w, compact ? 82 : 76, g.tone); c.text(x - 18, y + 42, String(i + 1), 16, figurePalette[g.tone][1]); if (i < 3) c.line([[x + w / 2, y + (compact ? 86 : 80)], [x + w / 2, y + step - 4]], i < 2 ? '通过' : '按负载选择', 'kv', false, [compact ? 148 : 408, y + step - 8]); });
    const rail = compact ? 26 : 76;
    [0, 1].forEach(i => c.line([[x - 4, 62 + i * step], [rail, 62 + i * step], [rail, compact ? 500 : 424]], '', 'danger', true));
    c.rect(compact ? 12 : 20, compact ? 504 : 428, compact ? 296 : 720, 54, 'neutral', 8, true);
    c.text(W / 2, compact ? 536 : 460, '未达门槛 → 回到基线，定位后再测', compact ? 13 : 16, '#ad6250'); return [finish(c)];
  }

  // Separate comparison panels suit computation ownership, PP feedback, and MoE paths.
  const loop = kind === 'pipeline-loop', boundary = kind === 'boundary';
  if (boundary && !compact) {
    const c = canvas(W, 414, id);
    groups.forEach((g, panelIndex) => {
      const x = 12 + panelIndex * 378;
      c.panel(x, 12, 358, 390, g.title, g.tone);
      g.nodes.forEach((node, i) => {
        const y = 66 + i * 108;
        c.card(node, x + 18, y, 322, 80, node.tone || g.tone);
        if (i < 2) c.line([[x + 179, y + 84], [x + 179, y + 104]], edge(node, g.nodes[i + 1]), g.tone, false, [x + 246, y + 99]);
      });
    });
    return [finish(c)];
  }
  return groups.map((g, panelIndex) => {
    const n = g.nodes.length, height = compact ? n * 108 + 120 : (boundary ? 414 : 254), c = canvas(W, height, `${id}-${panelIndex}`);
    c.panel(12, 12, W - 24, height - 24, g.title, g.tone);
    g.nodes.forEach((node, i) => {
      const vertical = compact || boundary, x = vertical ? (compact ? 32 : 208) : 36 + i * (n === 3 ? 244 : 376), y = vertical ? 66 + i * 108 : 72, w = vertical ? (compact ? 242 : 344) : (n === 3 ? 200 : 304);
      c.card(node, x, y, w, 80, node.tone || g.tone);
      if (i < n - 1) c.line(vertical ? [[x + w / 2, y + 84], [x + w / 2, y + 104]] : [[x + w + 4, y + 40], [x + (n === 3 ? 240 : 372), y + 40]], edge(node, g.nodes[i + 1]), g.tone, false, vertical ? [x + w / 2 + (compact ? 62 : 82), y + 99] : [x + w + (n === 3 ? 22 : 36), y - 10]);
    });
    if (loop) {
      const label = edge(g.nodes.at(-1), g.nodes[0], '下一轮');
      if (compact) c.line([[278, 66 + (n - 1) * 108 + 40], [296, 66 + (n - 1) * 108 + 40], [296, 50], [153, 50], [153, 62]], label, 'control', true, [237, 53]);
      else c.line([[636, 156], [636, 205], [136, 205], [136, 156]], label, 'control', true, [386, 204]);
    }
    return finish(c, ` · ${g.title}`);
  });
}
