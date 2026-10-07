// Six fixed-role layouts for release evidence and conditional recovery paths.
// Every arrow comes from the payload. Dedicated gutters keep routes out of cards
// and dedicate one row to each label, including backwards and failure edges.
const layouts = {
  'overload-sources': [[0,0],[1,0],[0,2],[1,2],[2,2],[2,0],[3,2]],
  'choice-cleanup': [[0,1],[1,0],[1,1],[1,2],[2,0],[2,1],[3,0],[3,2],[4,1],[4,2],[5,1]],
  'deployment-paths': [[0,1],[1,0],[2,0],[1,1],[2,1],[1,2],[2,2],[3,2],[4,2],[6,1],[5,1]],
  'release-evidence': [[0,0],[1,0],[2,0],[3,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2],[4,1]],
  'preload-restart': [[0,0],[0,1],[0,2],[1,0],[1,1],[2,1],[2,2],[3,2],[4,1],[5,1],[3,0],[6,1]],
  'rollout-checks': [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[3,2],[0,0],[1,0]],
};

export function renderReleaseFigure(diagram, { compact, id, canvas, figurePalette }) {
  const layout = layouts[diagram.presentation.kind];
  if (!layout) return null;
  const W = compact ? 320 : 760, H = 104, pitch = 34;
  const groups = new Map(diagram.presentation.panels.flatMap(p => p.nodeIds.map(n => [n,p])));
  const allNodes = diagram.presentation.panels.flatMap(p => p.nodeIds.map(n => diagram.nodes.find(v => v.id === n)));
  const nodes = compact && diagram.presentation.kind === 'preload-restart'
    ? [...allNodes.slice(0,8),allNodes[10],...allNodes.slice(8,10),allNodes[11]] : allNodes;
  const places = nodes.map((n,i) => ({node:n,level:compact ? i : layout[i][0],col:compact ? 0 : layout[i][1]}));
  const levelCount = Math.max(...places.map(p => p.level))+1;
  const positions = new Map(), rows = new Map(); let top = 52;
  for (let level=0;level<levelCount;level++) {
    const atLevel = places.filter(p => p.level === level);
    for (const p of atLevel) positions.set(p.node.id,{...p,x:compact ? 28 : 28+p.col*252,y:top,w:compact ? 264 : 200,h:H});
    const outgoing = diagram.edges.filter(e => atLevel.some(p => p.node.id === e.from));
    outgoing.forEach((e,i) => rows.set(e,top+H+32+i*pitch));
    top += H + 58 + outgoing.length*pitch;
  }
  const c = canvas(W,top+18,id), paths=[], labels=[], routes=[];
  c.text(W/2,25,compact ? '依箭头阅读；上下排列不代表因果' : '固定角色与条件分支；只绘制原始关系',compact ? 13 : 15,'#697985');
  for (const p of positions.values()) {
    const group=groups.get(p.node.id), subtitle=[p.node.subtitle,group.title].filter(Boolean).join(' · ');
    c.card({...p.node,subtitle},p.x,p.y,p.w,p.h);
  }
  for (const e of diagram.edges) {
    const a=positions.get(e.from),b=positions.get(e.to),y=rows.get(e);
    // Each column has an outside rail on both sides. The horizontal segment
    // crosses only its own empty level gutter, never another node's interior.
    const left=compact ? 12 : a.x-14, right=compact ? 308 : b.x+b.w+14;
    const points=[[a.x-3,a.y+a.h/2],[left,a.y+a.h/2],[left,y],[right,y],[right,b.y+b.h/2],[b.x+b.w+3,b.y+b.h/2]];
    const label=e.shortLabel || e.label, labelPoint=[a.x+a.w/2,y-8];
    const tone=a.node.tone==='danger' || b.node.tone==='danger' ? 'danger' : a.node.tone || 'control';
    const dashed=diagram.presentation.kind==='release-evidence'
      ? e.to===allNodes.at(-1).id
      : b.level<a.level || /待|实测|不满足|回基线|重验/.test(label);
    const start=c.parts.length;
    c.line(points,label,tone,dashed,labelPoint);
    const added=c.parts.splice(start);
    paths.push(added[0]);labels.push(...added.slice(1));
    const lw=Math.max(30,[...label].reduce((n,ch)=>n+(/[\u0000-\u007f]/.test(ch)?7:12),0)+10);
    routes.push({from:e.from,to:e.to,points,label,labelBox:{x:labelPoint[0]-lw/2,y:labelPoint[1]-13,w:lw,h:18}});
  }
  c.parts.push(...paths,...labels);
  return [{svg:c.svg(diagram.title,diagram.caption),width:W,geometry:{width:W,height:top+18,nodes:[...positions.values()].map(({node,x,y,w,h})=>({id:node.id,x,y,w,h})),routes}}];
}
