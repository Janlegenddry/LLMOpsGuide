// Narrow ownership and KV teaching figures. Only declared edges are drawn.
const supported = new Set(['ascend-receive-completion-lifecycle-before', 'ascend-receive-completion-lifecycle-fixed', 'bidirectional-kv-eligibility', 'task-pointer-lifetime']);
const pointerPlaces = { publish:[0,0], fifo:[1,0], load:[0,1], count:[0,2], free:[2,1], business:[2,2] };
const wrap = (value, width, size=12) => {
  const lines=[];let line='',used=0;
  for(const ch of value){const advance=/[\u0000-\u007f]/.test(ch)?size*.58:size;if(line&&used+advance>width){lines.push(line);line='';used=0;}line+=ch;used+=advance;}
  if(line)lines.push(line);return lines;
};
export function ownershipEdgeStyle(kind, edge) {
  const pair=edge.from+'→'+edge.to;
  if(kind==='bidirectional-kv-eligibility'){
    if(['d-serve→p-pull','p-compute→d-pull'].includes(pair))return {tone:'communication',dashed:false,width:3.4,category:'data',badge:pair.startsWith('d-serve')?'D→P数据':'P→D数据'};
    if(['d-retain→router-metadata','router-metadata→router-gate','p-export→d-pull','d-generate→router-metadata'].includes(pair))return {tone:'control',dashed:true,width:1.7,category:'metadata'};
    if(edge.to==='router-fallback')return {tone:'danger',dashed:true,width:1.7,category:'conditional'};
  }
  if(kind==='task-pointer-lifetime'&&(edge.from==='free'||edge.to==='business'))return {tone:'neutral',dashed:true,width:1.7,category:'pending'};
  if(kind.endsWith('-before')&&edge.from==='worker-filter')return {tone:'danger',dashed:true,width:1.7,category:'missing-notification'};
  return {tone:kind.endsWith('-before')&&['reg-drop','worker-filter'].includes(edge.to)?'danger':'control',dashed:false,width:1.7,category:'control'};
}
export function renderOwnershipKvFigure(diagram,{compact,id,canvas,figurePalette}) {
  const kind=diagram.presentation.kind;if(!supported.has(kind))return null;
  const pointer=kind==='task-pointer-lifetime',bidirectional=kind==='bidirectional-kv-eligibility',W=compact?320:760,H=124,cardW=compact?264:pointer?200:150;
  const panels=diagram.presentation.panels,groupOf=new Map(panels.flatMap(p=>p.nodeIds.map(n=>[n,p])));
  const mobileIds=pointer?['publish','fifo','load','count','free','business']:panels.flatMap(p=>p.nodeIds);
  const entries=diagram.nodes.map(n=>({node:n,level:compact?mobileIds.indexOf(n.id):pointer?pointerPlaces[n.id][0]:n.row,col:compact?0:pointer?pointerPlaces[n.id][1]:n.column}));
  const titleLines=wrap(diagram.title,W-48,compact?14:15);
  const note=pointer?'原子性≠所有权 · 原创非实测':bidirectional?'虚线是位置/期限/身份元数据，KV不经路由器；资格门为拟议。':'职责与逻辑阶段示意 · 非等比例时间轴；登记集合不是KV所有者。';
  const noteLines=wrap(note,W-48,12),headerY=24+titleLines.length*19+noteLines.length*17+12;
  const headerLines=pointer||compact?[]:panels.map(p=>wrap(p.title,cardW,12));
  let top=headerY+(headerLines.length?Math.max(...headerLines.map(x=>x.length))*16+22:34);
  const positions=new Map(),edgeY=new Map(),stageStart=top;
  for(let level=0;level<=Math.max(...entries.map(p=>p.level));level++){
    const here=entries.filter(p=>p.level===level);
    for(const p of here)positions.set(p.node.id,{...p,x:compact?28:pointer?20+p.col*240:22+p.col*186,y:top,w:cardW,h:H});
    const outgoing=diagram.edges.filter(e=>here.some(p=>p.node.id===e.from));
    outgoing.forEach((edge,i)=>edgeY.set(edge,top+H+32+i*30));
    top+=H+76+outgoing.length*30;
  }
  const legend=diagram.edges.map((e,i)=>({edge:e,style:ownershipEdgeStyle(kind,e),number:String(i+1),lines:wrap((i+1)+'. '+e.label,W-48)}));
  const height=top+62+legend.reduce((sum,l)=>sum+l.lines.length*19+7,0),c=canvas(W,height,id);
  titleLines.forEach((s,i)=>c.text(W/2,24+i*19,s,compact?14:15,'#293c4a'));
  noteLines.forEach((s,i)=>c.text(24,24+titleLines.length*19+i*17,s,12,'#697985','start'));
  if(headerLines.length)headerLines.forEach((lines,col)=>lines.forEach((s,i)=>c.text(22+col*186,headerY+i*16,s,12,figurePalette[panels[col].tone][1],'start')));
  for(const p of positions.values()){
    const group=groupOf.get(p.node.id);
    if((compact||pointer)&&group.nodeIds[0]===p.node.id)wrap(group.title,p.w,12).forEach((s,i,all)=>c.text(p.x,p.y-15-(all.length-1-i)*15,s,12,'#697985','start'));
    const pending=(pointer&&['free','business'].includes(p.node.id))||(bidirectional&&p.node.id==='router-gate');
    const subtitle=bidirectional&&p.node.id==='d-retain'?'容量占用 · 有期限':pending?(pointer?'待验':'拟议生产验收，非proxy已有保证'):p.node.subtitle;
    const node={...p.node,subtitle,tone:bidirectional&&p.node.id==='p-compute'?'compute':p.node.tone};
    const start=c.parts.length;c.card(node,p.x,p.y,p.w,p.h);
    if(pending)c.parts[start]=c.parts[start].replace(/fill="[^"]+"/,'fill="#fff"').replace('stroke-width="1.5"','stroke-width="1.5" stroke-dasharray="5 4"');
    if(bidirectional&&p.node.id==='router-gate'){c.rect(p.x+p.w-42,p.y+6,34,17,'control',3,true);c.text(p.x+p.w-25,p.y+18,'拟议',10,figurePalette.control[1]);}
    p.pending=pending;
  }
  const paths=[],labels=[],routes=[];
  for(const [i,edge] of diagram.edges.entries()){
    const a=positions.get(edge.from),b=positions.get(edge.to),y=edgeY.get(edge),style=legend[i].style;
    const left=compact?12:a.x-8;
    // Separate pending return rails: sharing a spine could suggest free→business.
    const pendingOffset=pointer?(edge.from==='free'?(compact?-6:8):edge.to==='business'?(compact?4:16):0):0;
    const right=(compact?308:b.x+b.w+8)+pendingOffset;
    const points=[[a.x-3,a.y+H/2],[left,a.y+H/2],[left,y],[right,y],[right,b.y+H/2],[b.x+b.w+3,b.y+H/2]];
    const badge=legend[i].number+(style.badge?' '+style.badge:''),labelPoint=[a.x+a.w/2,y-8],start=c.parts.length;c.line(points,badge,style.tone,style.dashed,labelPoint);
    const added=c.parts.splice(start);paths.push(added[0].replace('stroke-width="1.7"','stroke-width="'+style.width+'"'));labels.push(...added.slice(1));
    const labelW=Math.max(30,[...badge].reduce((n,ch)=>n+(/[\u0000-\u007f]/.test(ch)?7:12),0)+10);
    routes.push({from:edge.from,to:edge.to,label:edge.label,points,...style,labelBox:{x:labelPoint[0]-labelW/2,y:labelPoint[1]-13,w:labelW,h:18}});
  }
  c.parts.push(...paths,...labels);
  let legendY=top+8;c.text(24,legendY,'箭头编号仅作对照，完整关系如下',12,'#697985','start');legendY+=26;
  const legendBoxes=[];
  for(const item of legend){const y=legendY;for(const line of item.lines){c.text(24,legendY,line,12,figurePalette[item.style.tone][1],'start');legendY+=19;}legendBoxes.push({from:item.edge.from,to:item.edge.to,text:item.edge.label,x:24,y:y-14,w:W-48,h:item.lines.length*19});legendY+=7;}
  return [{svg:c.svg(diagram.title,diagram.caption),width:W,geometry:{width:W,height,stageStart,nodes:[...positions.values()].map(p=>({id:p.node.id,x:p.x,y:p.y,w:p.w,h:p.h,pending:p.pending})),routes,legendBoxes}}];
}
