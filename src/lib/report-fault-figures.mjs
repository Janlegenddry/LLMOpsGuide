// Fixed roles for identifier ownership, socket failure conditions and planned
// acceptance. The payload defines every edge; no state is marked as passed.
const layouts = {
  // [lane, time]: old and repaired paths each repeat the three role lanes.
  'metadata-ownership': [[0,0],[0,2],[3,0],[3,2],[1,1],[4,1],[4,3],[2,3],[5,3]],
  'handshake-boundaries': [[0,0],[0,1],[0,2],[1,1],[2,0],[2,1],[2,2],[3,0]],
  'fault-acceptance': [[1,1],[2,1],[3,1],[4,1],[5,1],[0,0]],
};
export function renderFaultFigure(diagram, { compact, id, canvas, figurePalette }) {
  const kind = diagram.presentation.kind, layout = layouts[kind];
  if (!layout) return null;
  const W = compact ? 320 : 760, H = 104, timeline = kind === 'metadata-ownership';
  const panels = diagram.presentation.panels;
  const groups = new Map(panels.flatMap(p => p.nodeIds.map(n => [n,p])));
  const all = panels.flatMap(p => p.nodeIds.map(n => diagram.nodes.find(v => v.id === n)));
  // Mobile follows time within each path; list order creates no extra arrows.
  const order = timeline ? [0,4,1,7,2,5,3,8,6] : kind === 'fault-acceptance' ? [5,0,1,2,3,4] : all.map((_,i) => i);
  const places = (compact ? order : all.map((_,i) => i)).map((index,i) => ({node:all[index],level:compact ? i : layout[index][0],col:compact ? 0 : layout[index][1]}));
  const levels = Math.max(...places.map(p => p.level))+1;
  const positions = new Map(), rows = new Map(); let top = timeline && !compact ? 76 : 52;
  for (let level=0;level<levels;level++) {
    const here = places.filter(p => p.level===level);
    for (const p of here) positions.set(p.node.id,{...p,x:compact ? 28 : 28+p.col*(timeline ? 184 : 252),y:top,w:compact ? 264 : timeline ? 156 : 200,h:H});
    const outgoing = diagram.edges.filter(e => here.some(p => p.node.id===e.from));
    outgoing.forEach((e,i) => rows.set(e,top+H+32+i*34));
    top += H + 66 + outgoing.length*34;
  }
  const c = canvas(W,top+24,id), routes=[], paths=[], labels=[];
  c.text(W/2,25,timeline ? (compact ? '按箭头读旧 / 修复路径与重试' : '时间 → 生成 / 提交 / 刷新 / 完成') : kind==='fault-acceptance' ? '○ 全部为计划验收，尚未执行' : '输入条件分开核对；依箭头阅读',compact ? 13 : 15,'#697985');
  if (timeline && !compact) {
    for (let level=0;level<6;level++) {
      const p=[...positions.values()].find(p => p.level===level);
      c.text(28,p.y-10,`${level<3 ? '旧路径' : '修复路径'} · ${panels[level%3].title}`,12,'#697985','start');
    }
  }
  for (const p of positions.values()) {
    const group=groups.get(p.node.id), node={...p.node,subtitle:[p.node.subtitle,...(timeline && !compact ? [] : [group.title])].filter(Boolean).join(' · ')};
    const start=c.parts.length; c.card(node,p.x,p.y,p.w,p.h);
    if (kind==='fault-acceptance' && group===panels[0]) c.parts[start]=c.parts[start].replace(/fill="[^"]+"/,'fill="#fff"').replace('stroke-width="1.5"','stroke-width="1.5" stroke-dasharray="5 4"');
    if (kind==='handshake-boundaries' && p.node.id===panels[2].nodeIds[2]) {
      // A visibly open orange gate expresses the missing time-limit condition.
      c.parts[start]=`<path d="M${p.x+p.w} ${p.y}H${p.x}V${p.y+p.h}H${p.x+p.w}" fill="#fff7e6" stroke="${figurePalette.communication[1]}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    }
  }
  for (const e of diagram.edges) {
    const a=positions.get(e.from),b=positions.get(e.to),y=rows.get(e),left=compact ? 12 : a.x-14,right=compact ? 308 : b.x+b.w+14;
    const points=[[a.x-3,a.y+a.h/2],[left,a.y+a.h/2],[left,y],[right,y],[right,b.y+b.h/2],[b.x+b.w+3,b.y+b.h/2]];
    const label=e.shortLabel||e.label,labelPoint=[a.x+a.w/2,y-8];
    const tone=a.node.tone==='danger'||b.node.tone==='danger' ? 'danger' : b.node.tone||'control';
    const dashed=kind==='fault-acceptance'||tone==='danger'||b.level<a.level||/时限|预算|重试|新尝试/.test(label);
    const start=c.parts.length;c.line(points,label,tone,dashed,labelPoint);const added=c.parts.splice(start);paths.push(added[0]);labels.push(...added.slice(1));
    const lw=Math.max(30,[...label].reduce((n,ch) => n+(/[\u0000-\u007f]/.test(ch)?7:12),0)+10);
    routes.push({from:e.from,to:e.to,points,label,labelBox:{x:labelPoint[0]-lw/2,y:labelPoint[1]-13,w:lw,h:18},dashed});
  }
  c.parts.push(...paths,...labels);
  return [{svg:c.svg(diagram.title,diagram.caption),width:W,geometry:{width:W,height:top+24,nodes:[...positions.values()].map(({node,x,y,w,h}) => ({id:node.id,x,y,w,h})),routes}}];
}
