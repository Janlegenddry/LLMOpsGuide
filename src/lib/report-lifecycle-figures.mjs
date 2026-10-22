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
  const W = compact ? 320 : 760, cardW = compact ? 264 : 155;
  const labelSize = compact ? 18 : 15, subSize = compact ? 14 : 12;
  const groups = diagram.presentation.panels, byID = new Map(diagram.nodes.map(n => [n.id, n]));
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
  const positions = new Map(), edgeY = new Map(), headings = [];
  for (let level = 0; level <= Math.max(...entries.map(n => n.level)); level++) {
    const here = entries.filter(n => n.level === level), panel = here[0].panel;
    const showHeading = !compact || groups[panel].nodeIds[0] === here[0].id;
    if (showHeading) {
      const lines = wrap(groups[panel].title, W - 48, 13);
      headings.push({ x:24, y:top, w:W - 48, h:lines.length * 18, lines, tone:groups[panel].tone });
      top += lines.length * 18 + 18;
    } else top += 16;
    const h = Math.max(...here.map(n => n.h));
    for (const n of here) positions.set(n.id, { ...n, x:compact ? 28 : 28 + n.col * 183, y:top, w:cardW, h });
    const outgoing = diagram.edges.filter(e => here.some(n => n.id === e.from));
    outgoing.forEach((e, i) => edgeY.set(e, top + h + 36 + i * 32));
    top += h + 60 + outgoing.length * 32;
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
  const routes = [], paths = [], badges = [];
  for (const [i, edge] of diagram.edges.entries()) {
    const a = positions.get(edge.from), b = positions.get(edge.to), y = edgeY.get(edge);
    const tone = b.node.tone || groups[b.panel].tone;
    let points;
    if (a.level !== b.level) {
      // Cross-level routes run outside panel headings, then enter above the target.
      const outer = W - 8 + (i % 3) * 2;
      points = [[a.x+a.w+3,a.y+a.h/2],[a.x+a.w+9,a.y+a.h/2],[a.x+a.w+9,y],[outer,y],[outer,b.y-14],[b.x-9,b.y-14],[b.x-9,b.y+b.h/2],[b.x-3,b.y+b.h/2]];
    } else if (b.x > a.x) {
      points = [[a.x+a.w+3,a.y+a.h/2],[a.x+a.w+9,a.y+a.h/2],[a.x+a.w+9,y],[b.x-9,y],[b.x-9,b.y+b.h/2],[b.x-3,b.y+b.h/2]];
    } else {
      points = [[a.x-3,a.y+a.h/2],[a.x-9,a.y+a.h/2],[a.x-9,y],[b.x+b.w+9,y],[b.x+b.w+9,b.y+b.h/2],[b.x+b.w+3,b.y+b.h/2]];
    }
    const labelPoint = [a.x+a.w/2,y-8], start = c.parts.length;
    c.line(points,String(i+1),tone,b.pending,labelPoint);
    const added = c.parts.splice(start); paths.push(added[0].replace('<polyline ',`<polyline data-lifecycle-edge="${i+1}" `)); badges.push(...added.slice(1));
    routes.push({ from:edge.from, to:edge.to, label:edge.label, points, crossPanel:a.panel!==b.panel, dashed:b.pending,
      labelBox:{x:labelPoint[0]-15,y:labelPoint[1]-13,w:30,h:18} });
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
