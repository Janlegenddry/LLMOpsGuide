// These layouts have fixed semantic roles. A Python owner, a device buffer,
// a captured address, a drainable request and an observed result stay distinct.
// Only payload edges are rendered; layout order creates no transitions.
const layouts = {
  'graph-buffer-identity': [[0,0],[0,1],[1,1],[0,2],[1,2],[0,3],[1,3],[2,0],[3,0],[3,1],[3,2],[3,3],[4,3]],
  'pause-kv-drain': [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[1,3],[2,3],[0,3],[2,2]],
  'test-start-barrier': [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[1,3]],
  'tcp-idle-probe': [[0,0],[0,1],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],[2,3]],
};
const headings = {
  'graph-buffer-identity': '对象拥有设备张量；CUDA graph 固化设备地址',
  'pause-kv-drain': '分开排空、队列与流式会话',
  'test-start-barrier': '首输出仅用于测试同步',
  'tcp-idle-probe': 'peek 结果与后续重连分开',
};
export function renderStateBoundaryFigure(diagram, { compact, id, canvas }) {
  const kind=diagram.presentation.kind, layout=layouts[kind];
  if (!layout) return null;
  const W=compact?320:760,H=116,panels=diagram.presentation.panels;
  const all=panels.flatMap(p=>p.nodeIds.map(n=>diagram.nodes.find(v=>v.id===n)));
  const groups=new Map(panels.flatMap(p=>p.nodeIds.map(n=>[n,p])));
  // Mobile orders the roles spatially, while the declared arrows retain the
  // actual references and branches (including references pointing backwards).
  const order=all.map((node,i)=>({node,index:i,level:layout[i][0],col:layout[i][1]}))
    .sort((a,b)=>a.level-b.level||a.col-b.col);
  const places=compact?order.map((p,i)=>({...p,level:i,col:0})):order;
  const positions=new Map(),rows=new Map();let top=kind==='graph-buffer-identity'&&!compact?82:56;
  const levels=Math.max(...places.map(p=>p.level))+1;
  for(let level=0;level<levels;level++){
    const here=places.filter(p=>p.level===level);
    for(const p of here)positions.set(p.node.id,{...p,x:compact?28:28+p.col*184,y:top,w:compact?264:156,h:H});
    const outgoing=diagram.edges.filter(e=>here.some(p=>p.node.id===e.from));
    outgoing.forEach((e,i)=>rows.set(e,top+H+32+i*34));
    top+=H+66+outgoing.length*34;
  }
  const c=canvas(W,top+24,id),routes=[],paths=[],labels=[];
  c.text(W/2,25,compact&&kind==='graph-buffer-identity'?'对象持有张量，图捕获地址':headings[kind],compact?13:15,'#697985');
  if(kind==='graph-buffer-identity'&&!compact){
    ['tier 注册','Python 布局对象','设备张量缓冲','CUDA graph'].forEach((t,i)=>c.text(106+i*184,57,t,12,'#697985'));
  }
  for(const p of positions.values()){
    const group=groups.get(p.node.id),node={...p.node,subtitle:[p.node.subtitle,group.title].filter(Boolean).join(' · ')};
    const start=c.parts.length;c.card(node,p.x,p.y,p.w,p.h);
    if(['finished','reset','request-result'].includes(p.node.id)){
      // A future observation is visibly unfilled, never a passed gate.
      c.parts[start]=c.parts[start].replace(/fill="[^"]+"/,'fill="#fff"').replace('stroke-width="1.5"','stroke-width="1.5" stroke-dasharray="5 4"');
    }
  }
  for(const e of diagram.edges){
    const a=positions.get(e.from),b=positions.get(e.to),y=rows.get(e);
    const left=compact?12:a.x-14,right=compact?308:b.x+b.w+14;
    const points=[[a.x-3,a.y+a.h/2],[left,a.y+a.h/2],[left,y],[right,y],[right,b.y+b.h/2],[b.x+b.w+3,b.y+b.h/2]];
    const label=e.shortLabel||e.label,labelPoint=[a.x+a.w/2,y-8];
    const tone=a.node.tone==='danger'||b.node.tone==='danger'?'danger':b.node.tone||'control';
    const dashed=tone==='danger'||b.level<a.level||/若|后续|另验|恢复/.test(label);
    const start=c.parts.length;c.line(points,label,tone,dashed,labelPoint);
    const added=c.parts.splice(start);paths.push(added[0]);labels.push(...added.slice(1));
    const lw=Math.max(30,[...label].reduce((n,ch)=>n+(/[\u0000-\u007f]/.test(ch)?7:12),0)+10);
    routes.push({from:e.from,to:e.to,points,label,labelBox:{x:labelPoint[0]-lw/2,y:labelPoint[1]-13,w:lw,h:18},dashed});
  }
  c.parts.push(...paths,...labels);
  return [{svg:c.svg(diagram.title,diagram.caption),width:W,geometry:{width:W,height:top+24,nodes:[...positions.values()].map(({node,x,y,w,h})=>({id:node.id,x,y,w,h})),routes}}];
}
