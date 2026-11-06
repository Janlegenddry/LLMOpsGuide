// Two declared role groups, without assumptions about KV, release or recovery.
const wrap = (value, width, size) => {
  const lines = []; let line = '', used = 0;
  for (const ch of String(value)) {
    const step = /[\u0000-\u007f]/.test(ch) ? size * .58 : size;
    if (line && used + step > width) { lines.push(line); line = ''; used = 0; }
    line += ch; used += step;
  }
  if (line) lines.push(line); return lines;
};

export function renderLifecycleFigure(diagram, { compact, id, canvas, figurePalette }) {
  if (diagram.presentation?.kind !== 'lifecycle') return null;
  const labelSize = compact ? 18 : 15, subSize = compact ? 14 : 12;
  const groups = diagram.presentation.panels, byID = new Map(diagram.nodes.map(n => [n.id, n]));
  const roles = new Map(groups.flatMap((g, panel) => g.nodeIds.map((key, col) =>
    [key, { panel, col, level:compact ? panel * 4 + col : panel }])));
  const edges = diagram.edges.map((edge, index) => {
    const from = roles.get(edge.from), to = roles.get(edge.to);
    const outside = compact ? from.panel !== to.panel || to.level !== from.level + 1 : from.level !== to.level;
    return { edge, index, from, to, outside };
  });
  const outside = edges.filter(e => e.outside);
  const W = compact ? Math.max(320, 124 + Math.max(0, outside.length - 1) * 8)
    : Math.max(760, 744 + Math.max(0, outside.length - 1) * 8);
  const outerX = new Map(outside.map((e, i) => [e.edge, W - 8 - i * 8]));
  const outerMin = outside.length ? Math.min(...outerX.values()) : W;
  const cardW = compact ? Math.min(264, outerMin - 36) : 155;
  const headerWidth = Math.min(W - 48, outerMin - 36);
  const title = wrap(diagram.title, W - 48, 15);
  const note = wrap('分组用于排版；只画声明的关系，不按相邻位置补边。', W - 48, 12);
  const entries = groups.flatMap((g, panel) => g.nodeIds.map((key, col) => {
    const n = byID.get(key), labels = wrap(n.shortLabel || n.label, cardW - 24, labelSize);
    const subtitles = wrap(n.subtitle || '', cardW - 24, subSize);
    const pending = /待验|待验证|待核|待复现|拟议/.test([n.label, n.shortLabel, n.subtitle].filter(Boolean).join(' '));
    return { id:key, node:n, panel, level:compact ? panel * 4 + col : panel, col:compact ? 0 : col, labels, subtitles, pending,
      h:Math.max(compact ? 136 : 112, labels.length * (labelSize + 5) + subtitles.length * (subSize + 4) + 34) };
  }));
  let top = 40 + title.length * 20 + note.length * 18;
  const positions = new Map(), sourceY = new Map(), targetY = new Map(), headings = [];
  for (let level = 0; level <= Math.max(...entries.map(n => n.level)); level++) {
    const here = entries.filter(n => n.level === level), panel = here[0].panel;
    const showHeading = !compact || groups[panel].nodeIds[0] === here[0].id;
    if (showHeading) {
      const lines = wrap(groups[panel].title, headerWidth, 13);
      headings.push({ x:24, y:top, w:headerWidth, h:lines.length * 18, lines, tone:groups[panel].tone });
      top += lines.length * 18 + 18;
    } else top += 16;
    const incoming = edges.filter(e => e.outside && e.to.level === level);
    if (compact && incoming.length) {
      incoming.forEach((e, i) => targetY.set(e.edge, top + 14 + i * 22));
      top += incoming.length * 22 + 18;
    }
    const h = Math.max(...here.map(n => n.h));
    for (const n of here) positions.set(n.id, { ...n, x:compact ? 28 : 28 + n.col * 183, y:top, w:cardW, h });
    const outgoing = edges.filter(e => e.from.level === level);
    outgoing.forEach((e, i) => sourceY.set(e.edge, top + h + 32 + i * 28));
    if (!compact) incoming.forEach((e, i) => targetY.set(e.edge, top + h + 32 + (outgoing.length + i) * 28));
    top += h + 60 + (outgoing.length + (compact ? 0 : incoming.length)) * 28;
  }
  const legends = diagram.edges.map((edge, i) => {
    const a = byID.get(edge.from), b = byID.get(edge.to);
    const text = `${i + 1}. ${a.shortLabel || a.label} → ${b.shortLabel || b.label}：${edge.label}`;
    return { edge, lines:wrap(text, W - 48, compact ? 14 : 12) };
  });
  const legendStep = compact ? 22 : 19;
  const height = top + 54 + legends.reduce((n, l) => n + l.lines.length * legendStep + 9, 0);
  const c = canvas(W, height, id), textBoxes = [];
  title.forEach((line, i) => c.text(W / 2, 24 + i * 20, line, 15));
  note.forEach((line, i) => c.text(24, 30 + title.length * 20 + i * 18, line, 12, '#697985', 'start'));
  for (const h of headings) h.lines.forEach((line, i) => c.text(h.x, h.y + 13 + i * 18, line, 13, figurePalette[h.tone][1], 'start'));
  for (const p of positions.values()) {
    const tone = p.node.tone || groups[p.panel].tone, begin = c.parts.length;
    c.rect(p.x, p.y, p.w, p.h, tone, 9, p.pending);
    if (p.pending) c.parts[begin] = c.parts[begin].replace(/fill="[^"]+"/, 'fill="#fff"');
    const total = p.labels.length * (labelSize + 5) + p.subtitles.length * (subSize + 4);
    let y = p.y + (p.h - total) / 2 + labelSize;
    for (const line of p.labels) { c.text(p.x + p.w / 2, y, line, labelSize); textBoxes.push({id:p.id, x:p.x+12, y:y-labelSize, w:p.w-24, h:labelSize+4}); y += labelSize + 5; }
    for (const line of p.subtitles) { c.text(p.x + p.w / 2, y, line, subSize, '#62717c'); textBoxes.push({id:p.id, x:p.x+12, y:y-subSize, w:p.w-24, h:subSize+3}); y += subSize + 4; }
  }
  // Each endpoint gets its own port. Branches cannot share a long vertical stem.
  const sourcePort = new Map(), targetPort = new Map();
  if (compact) edges.forEach(({edge}, i) => {
    const a = positions.get(edge.from), b = positions.get(edge.to), count = edges.length * 2 + 1;
    sourcePort.set(edge, a.x + 12 + (a.w - 24) * (i * 2 + 1) / count);
    targetPort.set(edge, b.x + 12 + (b.w - 24) * (i * 2 + 2) / count);
  });
  for (const p of positions.values()) {
    const incoming = edges.filter(e => e.edge.to === p.id), outgoing = edges.filter(e => e.edge.from === p.id);
    if (!compact) {
      const ports = [...incoming.map(e => ({...e, map:targetPort})), ...outgoing.map(e => ({...e, map:sourcePort}))];
      ports.forEach((e, i) => e.map.set(e.edge, p.x + 12 + (p.w - 24) * (i + 1) / (ports.length + 1)));
    }
  }
  const routes = edges.map(({edge, outside:external}) => {
    const a = positions.get(edge.from), b = positions.get(edge.to), y = sourceY.get(edge);
    const sx = sourcePort.get(edge), tx = targetPort.get(edge), end = compact ? b.y - 3 : b.y + b.h + 3;
    const points = external
      ? [[sx,a.y+a.h+3],[sx,y],[outerX.get(edge),y],[outerX.get(edge),targetY.get(edge)],[tx,targetY.get(edge)],[tx,end]]
      : [[sx,a.y+a.h+3],[sx,y],[tx,y],[tx,end]];
    return { from:edge.from, to:edge.to, label:edge.label,
      points:points.filter((p,i) => !i || p[0] !== points[i-1][0] || p[1] !== points[i-1][1]),
      crossPanel:a.panel !== b.panel, dashed:b.pending };
  });
  const crosses = (a,b,r) => a[0] === b[0]
    ? a[0] > r.x && a[0] < r.x+r.w && Math.max(a[1],b[1]) > r.y && Math.min(a[1],b[1]) < r.y+r.h
    : a[1] > r.y && a[1] < r.y+r.h && Math.max(a[0],b[0]) > r.x && Math.min(a[0],b[0]) < r.x+r.w;
  const paths = [], badges = [];
  for (const [i, edge] of diagram.edges.entries()) {
    const a = positions.get(edge.from), b = positions.get(edge.to), y = sourceY.get(edge), route = routes[i];
    const gaps = compact ? [] : [197,380,563].filter(x => route.points.slice(1).some((p,j) => {
      const q = route.points[j];
      return p[1] === y && q[1] === y && x > Math.min(p[0],q[0])+15 && x < Math.max(p[0],q[0])-15;
    })).sort((x,z) => Math.abs(x-sourcePort.get(edge))-Math.abs(z-sourcePort.get(edge)));
    const candidates = [...gaps,sourcePort.get(edge)+24,sourcePort.get(edge)-24,sourcePort.get(edge)+40,sourcePort.get(edge)-40,18];
    const x = candidates.find(x => {
      const box = {x:x-15,y:y-21,w:30,h:18};
      return box.x >= 0 && box.x+box.w <= W && routes.every(r => r.points.slice(1).every((p,j) => !crosses(r.points[j],p,box)));
    });
    const labelPoint = [x,y-8], start = c.parts.length;
    const tone = b.node.tone || groups[b.panel].tone;
    c.line(route.points,String(i+1),tone,b.pending,labelPoint);
    const added = c.parts.splice(start); paths.push(added[0].replace('<polyline ',`<polyline data-lifecycle-edge="${i+1}" `)); badges.push(...added.slice(1));
    route.labelBox = {x:labelPoint[0]-15,y:labelPoint[1]-13,w:30,h:18};
  }
  c.parts.push(...paths,...badges);
  let y = top + 10; c.text(24,y,'箭头编号与完整关系',12,'#697985','start'); y += 28;
  const legendBoxes = [];
  for (const l of legends) {
    const begin = y;
    for (const line of l.lines) { c.text(24,y,line,compact ? 14 : 12,'#293c4a','start'); y += legendStep; }
    legendBoxes.push({from:l.edge.from,to:l.edge.to,text:l.edge.label,x:24,y:begin-(compact?14:12),w:W-48,h:l.lines.length*legendStep}); y += 9;
  }
  return [{svg:c.svg(diagram.title,diagram.caption),width:W,geometry:{width:W,height,nodes:[...positions.values()].map(({node,labels,subtitles,...p})=>p),routes,legendBoxes,textBoxes,headerBoxes:headings.map(({lines,tone,...p})=>p)}}];
}
