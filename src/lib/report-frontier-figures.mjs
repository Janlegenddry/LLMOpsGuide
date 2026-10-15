// Original mechanism drawings. A shared connector router does not add edges;
// each kind supplies its own topology and visual vocabulary.
import { frontierContracts } from './report-frontier-contracts.mjs';

const wrap = (value, width, size = 12) => {
  const out = []; let line = '', used = 0;
  for (const ch of value) {
    const advance = /[\u0000-\u007f]/.test(ch) ? size * .58 : size;
    if (line && used + advance > width) { out.push(line); line = ''; used = 0; }
    line += ch; used += advance;
  }
  if (line) out.push(line); return out;
};
const layouts = {
  'lookup-rpc-failure-boundaries': {
    cols: 4, places: { req:[0,0], recv:[0,1], handler:[0,2], miss:[0,3], timeout:[1,0], close:[1,1], next:[1,2], recverr:[1,3] },
    mobile: ['req','recv','handler','miss','recverr','timeout','close','next'],
    note: '三种失败边界 · 1000 ms 仅指客户端接收等待；finally 清理与 join 警告不保证线程结束。',
    tags: { req:'查询入口', handler:'处理错误 → 零命中', recverr:'收发错误 → 退出', timeout:'接收错误 → 失效结算', next:'条件能力，非服务重启' },
  },
  'conv-checkpoint-window': {
    cols: 3, places: { prefix:[0,1], 'old-write':[1,0], 'old-state':[1,1], 'old-read':[1,2], 'new-write':[2,0], 'new-state':[2,1], 'new-read':[2,2] },
    mobile: ['prefix','old-write','old-state','old-read','new-write','new-state','new-read'],
    note: '原创示意，非实测 · 只讨论首读起点 0 · x_t 是激活位置，不是 token ID。',
    tags: { prefix:'K=4 · S=3 · W=3 · P=6 · q=0 · p=40', 'old-write':'旧路径：[34,40)', 'new-write':'独立修复路径：[37,40) · 真实 strides', 'new-read':'仅窗口身份吻合，业务验收仍待验证' },
  },
  'verify-plan-dispatch': {
    cols: 2, places: { batch:[0,0], promise:[1,0], stockplan:[2,0], hintplan:[2,1], gates:[3,1], stock:[4,0], split:[4,1], merge:[5,1], replay:[6,0] },
    mobile: ['batch','promise','stockplan','hintplan','gates','stock','split','merge','replay'],
    note: '仅 CUDA Graph 的 plan/capture，排除 eager · SGLang EAGLE 接线待验；无性能比例含义。',
    tags: { batch:'CPU plan/capture · 服务语义', promise:'CPU · 等长承诺分支', stock:'GPU execution · 通用旁路', split:'GPU execution · 专用分条计算', replay:'已捕获图：重放不重验 Python 环境 / kill switch' },
  },
  'gpu-fractioning-boundaries': {
    cols: 3, places: { request:[0,1], parse:[1,1], 'memory-error':[2,0], 'compute-error':[2,2], 'no-adjust':[3,0], reject:[3,1], fallback:[3,2], adjust:[4,2], mapping:[5,0], runtime:[5,2], metrics:[6,0], driver:[6,2], application:[7,2], slo:[8,2], verify:[9,1] },
    mobile: ['request','parse','memory-error','compute-error','reject','no-adjust','fallback','adjust','runtime','mapping','driver','metrics','application','slo','verify'],
    note: '上部：创建分支；下部：执行与独立异步观测。空调整放行 ≠ 驱动限制生效；映射不是前置闸门。',
    tags: { request:'① 请求 / 解析', reject:'fail-closed · 拒绝创建', 'no-adjust':'fail-open · 空调整', fallback:'fail-open · 回退后继续调整', runtime:'② 执行边界', mapping:'③ 异步尝试，非前置条件', verify:'④ 独立验收 · 待验证' },
  },
  'gpu-fractioning-acceptance': {
    cols: 2, places: { identity:[0,0], limit:[0,1], observability:[1,0], business:[1,1], stop:[2,0], cost:[2,1] },
    mobile: ['identity','limit','observability','business','stop','cost'],
    note: '四项空心证据面板均待验；任一未满足就停止诊断。业务门满足后才独立比较成本。',
    tags: { identity:'① 栈与版本证据', limit:'② 限制反例证据', observability:'③ 指标解释证据', business:'④ 双方客户端证据', stop:'未满足：停止 / 诊断', cost:'满足业务门：比较成本' },
  },
  'token-id-frontier': {
    cols: 3, places: { text:[0,0], candidate:[1,0], guard:[2,0], reference:[0,1], apply:[2,1], compare:[3,1], admit:[3,2], serve:[4,2], stop:[5,0] },
    mobile: ['text','candidate','guard','reference','apply','compare','admit','serve','stop'],
    note: '原创拟议接入验收，非论文架构或已有保证；参考与修补针对同一最终输入，不代表生产逐请求双算。',
    tags: { text:'输入身份', reference:'隔离验收支路：参考 ID', apply:'隔离验收支路：修补 ID', admit:'模型准入，仍需服务验收', stop:'停止 / 回退，不直接接入模型' },
  },
};

export function frontierEdgeStyle(kind, edge) {
  if (edge.to === 'stop' || edge.to === 'reject' || edge.to === 'recverr') return { tone:'danger', dashed:false };
  if (kind === 'lookup-rpc-failure-boundaries') return { tone:edge.from === 'handler' ? 'communication' : 'control', dashed:edge.to === 'next' };
  if (kind === 'gpu-fractioning-boundaries') return { tone:['no-adjust','fallback'].includes(edge.to) ? 'communication' : 'control', dashed:['mapping','metrics','verify'].includes(edge.to) || edge.to === 'driver' };
  if (kind === 'gpu-fractioning-acceptance' || kind === 'token-id-frontier') return { tone:'control', dashed:true };
  return { tone:kind === 'conv-checkpoint-window' && (edge.to.startsWith('old') || edge.from.startsWith('old')) ? 'danger' : 'compute', dashed:false };
}

export function renderFrontierFigure(diagram, { compact, id, canvas, figurePalette }) {
  const kind = diagram.presentation?.kind;
  if (!frontierContracts[kind]) return null;
  const spec = layouts[kind], W = compact ? 320 : 760, slots = kind === 'conv-checkpoint-window';
  const cardW = compact ? 264 : slots ? 212 : (W - 64 - (spec.cols - 1) * 30) / spec.cols;
  const H = slots ? 168 : 144, positions = new Map(), edgeY = new Map();
  const title = wrap(diagram.title, W - 48, 15), notes = wrap(spec.note, W - 48, 12);
  let top = 38 + title.length * 20 + notes.length * 18;
  const places = compact ? Object.fromEntries(spec.mobile.map((key, i) => [key, [i,0]])) : spec.places;
  const stageStart = top;
  for (let level = 0; level <= Math.max(...Object.values(places).map(p => p[0])); level++) {
    const here = diagram.nodes.filter(n => places[n.id][0] === level);
    const tags = here.map(n => wrap(spec.tags[n.id] || '', cardW, 11));
    top += Math.max(1, ...tags.map(t => t.length)) * 17 + 8;
    for (const n of here) positions.set(n.id, { id:n.id, node:n, x:compact ? 28 : 24 + places[n.id][1] * (cardW + 30), y:top, w:cardW, h:H, pending:['driver','verify','next','identity','limit','observability','business','admit'].includes(n.id) });
    const outgoing = diagram.edges.filter(e => here.some(n => n.id === e.from));
    outgoing.forEach((e, i) => edgeY.set(e, top + H + 32 + i * 28));
    top += H + 70 + outgoing.length * 28;
  }
  const legends = diagram.edges.map((e, i) => ({ e, lines:wrap(`${i + 1}. ${e.label}`, W - 48), style:frontierEdgeStyle(kind,e) }));
  const height = top + 52 + legends.reduce((n, l) => n + l.lines.length * 19 + 8, 0), c = canvas(W, height, id);
  title.forEach((s, i) => c.text(W/2, 24 + i*20, s, 15));
  notes.forEach((s, i) => c.text(24, 30 + title.length*20 + i*18, s, 12, '#697985', 'start'));
  if(kind === 'verify-plan-dispatch') {
    const a=positions.get('batch'),b=positions.get('gates'),d=positions.get('stock'),e=positions.get('replay');
    c.parts.push(`<path d="M16 ${a.y}H8V${b.y+b.h}H16 M${W-16} ${d.y}H${W-8}V${e.y+e.h}H${W-16}" fill="none" stroke="#8563a2" stroke-width="1.5"/>`);
    const merge=positions.get('merge');
    c.parts.push(`<rect x="18" y="${d.y-32}" width="${W-36}" height="${merge.y+merge.h-d.y+44}" rx="22" fill="none" stroke="#697985" stroke-dasharray="7 5"/>`);
  }
  const slotRows = [], glyphs = [];
  for (const p of positions.values()) {
    wrap(spec.tags[p.id] || '', p.w, 11).forEach((s,i,all) => c.text(p.x, p.y - 10 - (all.length-1-i)*17, s, 11, '#697985', 'start'));
    if (slots && p.id.endsWith('-state')) {
      const newer = p.id.startsWith('new'), cell = p.w / 6, sy = p.y + 54;
      c.text(p.x+p.w/2, p.y+18, newer ? '新物理行 · P=6' : '旧物理行 · P=6', 14);
      const pattern = `${id}-retained`;
      if (newer) c.parts.push(`<defs><pattern id="${pattern}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#eef0f2"/><path d="M0 6L6 0" stroke="#c5cdd3"/></pattern></defs>`);
      const cells = [];
      for (let j=0;j<6;j++) {
        const x=p.x+j*cell, value=newer ? j<3 ? String(37+j) : '原值' : String(34+j);
        c.rect(x,sy,cell,42,j<3 ? newer ? 'kv' : 'danger' : 'neutral',0);
        if(newer&&j>=3)c.parts[c.parts.length-1]=c.parts.at(-1).replace(/fill="[^"]+"/,`fill="url(#${pattern})"`);
        c.text(x+cell/2,sy-8,String(j),12,'#697985');c.text(x+cell/2,sy+27,value,j>=3&&newer?11:15);
        cells.push({index:j,value,x,y:sy,w:cell,h:42,retained:newer&&j>=3});
      }
      // Brackets have no arrowheads and do not create slot-to-slot edges.
      const bracket=(x,w,y,label)=>{c.parts.push(`<path d="M${x} ${y-5}V${y}H${x+w}V${y-5}" fill="none" stroke="#697985"/>`);c.text(x+w/2,y+17,label,11);};
      bracket(p.x,cell*3,sy+49,'W=3 · 首读 0…2');bracket(p.x+cell*3,cell*3,sy+49,'S=3 预留');
      c.text(p.x+p.w/2,sy+92,newer?'尾部本次不写，保留原值':'首窗口读到偏旧 3 步',12,newer?'#697985':'#ad6250');
      slotRows.push({id:p.id,physical:6,logical:3,cells,firstRead:[0,1,2]});continue;
    }
    const start=c.parts.length;
    let label=p.node.shortLabel||p.node.label, subtitle=p.node.subtitle;
    if(kind==='verify-plan-dispatch') {
      label=({stock:'通用执行',split:'分条注意力计算',merge:'同流合并',hintplan:'等长专用规划',stockplan:'通用规划'})[p.id]||label;
      if(['stockplan','hintplan','split','merge','replay'].includes(p.id)) {
        const type=({stockplan:'ragged-query-tiles',hintplan:'uniform-query-tiles',split:'partial-strips',merge:'merge-operator',replay:'frozen-graph-capsule'})[p.id];glyphs.push({id:p.id,type});
        c.rect(p.x,p.y,p.w,p.h,p.id==='replay'?'neutral':'compute',p.id==='replay'?32:8,p.id==='replay');
        c.text(p.x+p.w/2,p.y+28,label,15);
        if(p.id==='stockplan'||p.id==='hintplan')for(let j=0;j<3;j++)c.rect(p.x+22,p.y+46+j*23,p.id==='hintplan'?p.w-44:(p.w-44)*[.55,1,.74][j],14,'control',2);
        if(p.id==='split')for(let j=0;j<3;j++)c.rect(p.x+22,p.y+49+j*23,p.w-44,12,'compute',1);
        if(p.id==='merge'){c.text(p.x+p.w/2,p.y+82,'Σ',32,'#4776a8');c.text(p.x+p.w/2,p.y+119,'同流依赖，非独立并行',11);}
        if(p.id==='replay'){c.text(p.x+p.w/2,p.y+73,'〔已冻结的 GPU 操作〕',14);c.text(p.x+p.w/2,p.y+111,'重放 ≠ 重新执行 Python 闸门',11);}continue;
      }
      if(p.id==='gates'){c.rect(p.x,p.y,p.w,p.h,'communication',28,true);c.text(p.x+p.w/2,p.y+49,'条件开关',16);c.text(p.x+p.w/2,p.y+81,'任一不满足 → 通用旁路',12);c.text(p.x+p.w/2,p.y+113,'全部满足 → 分条计算',12);glyphs.push({id:p.id,type:'eligibility-switch'});continue;}
    }
    const tone = p.id==='recverr'||p.id==='stop'||p.id==='reject'?'danger':['no-adjust','fallback','handler'].includes(p.id)?'communication':p.node.tone;
    c.card({...p.node,shortLabel:label,subtitle},p.x,p.y,p.w,p.h,tone);
    if(p.pending)c.parts[start]=c.parts[start].replace(/fill="[^"]+"/,'fill="#fff"').replace('stroke-width="1.5"','stroke-width="1.5" stroke-dasharray="5 4"');
    if(kind==='gpu-fractioning-acceptance'&&!['stop','cost'].includes(p.id)) {
      const icon=({identity:'版本 / 栈',limit:'反例 ×',observability:'指标 ≋',business:'双方 SLO'})[p.id];
      c.rect(p.x+8,p.y+6,p.w-16,23,'neutral',3,true);c.text(p.x+p.w/2,p.y+22,icon,11);glyphs.push({id:p.id,type:'evidence-'+p.id});
    }
  }
  const routes=[],paths=[],labels=[];
  for(const [i,e] of diagram.edges.entries()) {
    const a=positions.get(e.from),b=positions.get(e.to),y=edgeY.get(e),style=frontierEdgeStyle(kind,e);
    let points=[[a.x-3,a.y+a.h/2],[a.x-10,a.y+a.h/2],[a.x-10,y],[b.x+b.w+10,y],[b.x+b.w+10,b.y+b.h/2],[b.x+b.w+3,b.y+b.h/2]];
    if(slots&&a.id.endsWith('-state')) points=[[a.x+a.w/4,a.y+97],[a.x+a.w/4,y],[b.x+b.w+10,y],[b.x+b.w+10,b.y+b.h/2],[b.x+b.w+3,b.y+b.h/2]];
    const labelPoint=[a.x+a.w/2,y-8],begin=c.parts.length;c.line(points,String(i+1),style.tone,style.dashed,labelPoint);
    const added=c.parts.splice(begin);paths.push(added[0]);labels.push(...added.slice(1));
    routes.push({from:e.from,to:e.to,label:e.label,points,...style,labelBox:{x:labelPoint[0]-15,y:labelPoint[1]-13,w:30,h:18}});
  }
  // Connections outside cards, then labels above connections.
  c.parts.push(...paths,...labels);
  let y=top+6;c.text(24,y,'仅绘制声明关系；编号对照完整文字',12,'#697985','start');y+=28;
  const legendBoxes=[];
  for(const l of legends){const start=y;for(const text of l.lines){c.text(24,y,text,12,figurePalette[l.style.tone][1],'start');y+=19;}legendBoxes.push({from:l.e.from,to:l.e.to,text:l.e.label,x:24,y:start-14,w:W-48,h:l.lines.length*19});y+=8;}
  return [{svg:c.svg(diagram.title,diagram.caption),width:W,geometry:{width:W,height,stageStart,nodes:[...positions.values()].map(({node,...p})=>p),routes,legendBoxes,slotRows,glyphs,kind}}];
}
