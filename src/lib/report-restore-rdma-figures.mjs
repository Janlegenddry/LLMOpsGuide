// Fixed teaching roles: slot consensus, two budget ledgers, and per-QP
// retirement. Layout order never creates an edge or a measured result.
const layouts = {
  'restore-consensus': [[0,1],[1,0],[1,1],[1,2],[1,3],[2,1],[3,1],[4,0],[4,1],[4,2],[4,3]],
  'restore-budget-ledger': [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,2],[2,3]],
  'rdma-retirement': [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2],[3,2],[1,4],[3,4]],
  'rdma-partial-post': [[0,1],[1,1],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[7,1],[2,3],[8,1]],
  'storage-worker-liveness': [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,1],[1,2],[1,3],[1,4],[2,1],[2,4]],
};
const headings = {
  'restore-consensus': '同序请求前提下统一控制结果',
  'restore-budget-ledger': '真实分配与失败预留分别记账',
  'rdma-retirement': '一个 CQE · 三项退休 · 后缀仍保留',
  'rdma-partial-post': '本次尝试与请求终态分开',
  'storage-worker-liveness': '逐批 ACK、最终通知与持久化分别记账',
};
const futureRoles = {
  'restore-consensus': [10], 'restore-budget-ledger': [8],
  'rdma-retirement': [], 'rdma-partial-post': [5,10],
  'storage-worker-liveness': [11],
};
const wrapLegend = (text, width) => {
  const lines = []; let line = '', used = 0;
  for (const ch of text) {
    const advance = /[\u0000-\u007f]/.test(ch) ? 7 : 12;
    if (used + advance > width) { lines.push(line); line = ''; used = 0; }
    line += ch; used += advance;
  }
  if (line) lines.push(line);
  return lines;
};
export function renderRestoreRdmaFigure(diagram, { compact, id, canvas }) {
  const kind = diagram.presentation.kind, layout = layouts[kind];
  if (!layout) return null;
  const W = compact ? 320 : 760, H = 116;
  const five = ['rdma-retirement','storage-worker-liveness'].includes(kind), cardW = compact ? 264 : five ? 136 : 156;
  const step = five ? 148 : 184, inset = five ? 20 : 28, gutter = five ? 8 : 14;
  const panels = diagram.presentation.panels;
  const groups = new Map(panels.flatMap(p => p.nodeIds.map(n => [n, p])));
  const roles = panels.flatMap(p => p.nodeIds.map(n => diagram.nodes.find(node => node.id === n)));
  const entries = roles.map((node, index) => ({ node, index, level: layout[index][0], col: layout[index][1] }));
  // Mobile keeps each panel's roles together, including the independent notes.
  const mobileOrder = kind === 'storage-worker-liveness' ? [0,1,2,3,4,5,6,7,10,8,9,11] : entries.map(p=>p.index);
  const places = compact ? mobileOrder.map((index, i) => ({ ...entries[index], level: i, col: 0 })) : entries;
  const positions = new Map(), rows = new Map(); let top = 68;
  for (let level = 0; level <= Math.max(...places.map(p => p.level)); level++) {
    const here = places.filter(p => p.level === level);
    for (const p of here) positions.set(p.node.id, { ...p, x: compact ? 28 : inset + p.col * step, y: top, w: cardW, h: H });
    const outgoing = diagram.edges.filter(e => here.some(p => p.node.id === e.from));
    outgoing.forEach((e, i) => rows.set(e, top + H + 32 + i * 30));
    top += H + 70 + outgoing.length * 30;
  }
  // Short numbered arrow labels avoid long text intersecting the five-column
  // rails. The full, unchanged relationship is always visible in the legend.
  const legend = diagram.edges.map((edge, i) => ({ edge, number: String(i + 1), lines: wrapLegend(`${i + 1}. ${edge.label}`, W - 48) }));
  const height = top + 46 + legend.reduce((n, item) => n + item.lines.length * 19 + 7, 0);
  const c = canvas(W, height, id), paths = [], labels = [], routes = [];
  c.text(W / 2, 25, headings[kind], compact ? 13 : 15, '#697985');
  for (const p of positions.values()) {
    const group = groups.get(p.node.id), first = group.nodeIds[0] === p.node.id;
    if (first) c.text(p.x, p.y - 16, group.title, compact ? 13 : 12, '#697985', 'start');
    const signal = kind === 'rdma-retirement' && p.index < 5 ? p.node.label.split('：')[1] : '';
    const workerNotes = { 1: '本批新增 0 · 累计前缀保留', 3: '最终通知 · 非逐批 ACK', 7: '操作交回 · 非全量持久化', 10: '已返回批次 · 非精确落盘量' };
    const workerNote = kind === 'storage-worker-liveness' ? workerNotes[p.index] : '';
    const node = { ...p.node, subtitle: [p.node.subtitle, workerNote || signal || group.title].filter(Boolean).join(' · ') };
    const start = c.parts.length; c.card(node, p.x, p.y, p.w, p.h);
    if (futureRoles[kind].includes(p.index)) c.parts[start] = c.parts[start].replace(/fill="[^"]+"/, 'fill="#fff"').replace('stroke-width="1.5"', 'stroke-width="1.5" stroke-dasharray="5 4"');
  }
  for (const [i, edge] of diagram.edges.entries()) {
    const a = positions.get(edge.from), b = positions.get(edge.to), y = rows.get(edge);
    const left = compact ? 12 : a.x - gutter, right = compact ? 308 : b.x + b.w + gutter;
    const points = [[a.x-3,a.y+a.h/2],[left,a.y+a.h/2],[left,y],[right,y],[right,b.y+b.h/2],[b.x+b.w+3,b.y+b.h/2]];
    const tone = a.node.tone === 'danger' || b.node.tone === 'danger' ? 'danger' : b.node.tone || 'control';
    const dashed = tone === 'danger' || futureRoles[kind].includes(b.index) || /前提|未提交|尚未|等待/.test(edge.label);
    const labelPoint = [a.x + a.w / 2, y - 8], start = c.parts.length;
    c.line(points, legend[i].number, tone, dashed, labelPoint);
    const added = c.parts.splice(start); paths.push(added[0]); labels.push(...added.slice(1));
    routes.push({ from: edge.from, to: edge.to, points, label: edge.label, number: legend[i].number, labelBox: { x: labelPoint[0]-15, y: labelPoint[1]-13, w: 30, h: 18 }, dashed });
  }
  c.parts.push(...paths, ...labels);
  let legendY = top + 6;
  c.text(24, legendY, compact ? '箭头编号仅作对照，完整关系见下' : '箭头关系（编号仅用于对照，不表示时间或额外步骤）', compact ? 11 : 12, '#697985', 'start');
  legendY += 26;
  const legendBoxes = [];
  for (const item of legend) {
    const y = legendY;
    for (const line of item.lines) { c.text(24, legendY, line, 12, '#62717c', 'start'); legendY += 19; }
    legendBoxes.push({ from: item.edge.from, to: item.edge.to, text: item.edge.label, x: 24, y: y-14, w: W-48, h: item.lines.length*19 });
    legendY += 7;
  }
  return [{ svg: c.svg(diagram.title, diagram.caption), width: W, geometry: { width: W, height, nodes: [...positions.values()].map(({ node, index, x, y, w, h }) => ({ id: node.id, role: index, x, y, w, h, pending: futureRoles[kind].includes(index) })), routes, legendBoxes } }];
}
