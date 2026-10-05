// Narrow layouts for recovery state, scalar representation, and deployment evidence.
// The caller provides the same escaped SVG primitives as every existing figure.
const kinds = new Set(['state-lanes', 'failure-settlement', 'peer-reload', 'constant-paths', 'source-containment', 'deployment-gates']);

export function renderRecoveryFigure(diagram, { compact, id, canvas, figurePalette }) {
  const kind = diagram.presentation.kind;
  if (!kinds.has(kind)) return null;
  const byID = new Map(diagram.nodes.map(n => [n.id,n]));
  const groups = diagram.presentation.panels.map(p => ({...p,nodes:p.nodeIds.map(n => byID.get(n))}));
  const W = compact ? 320 : 760;
  const finish = (c,suffix='') => ({svg:c.svg(diagram.title+suffix,diagram.caption),width:W});
  const put = (c,positions,node,x,y,w,h=80,tone) => {
    c.card(node,x,y,w,h,tone); positions.set(node.id,{x,y,w,h,node});
  };
  const edges = (c,positions,selected=diagram.edges) => {
    for (const e of selected) {
      const a=positions.get(e.from),b=positions.get(e.to);
      if (!a || !b) continue; // Cross-panel relationships are retained in the complete legend.
      const tone = a.node.tone==='danger' || b.node.tone==='danger' ? 'danger' : a.node.tone || 'control';
      const label=e.shortLabel || '';
      if (a.y===b.y && a.x<b.x) {
        c.line([[a.x+a.w+3,a.y+a.h/2],[b.x-3,b.y+b.h/2]],label,tone,false,[(a.x+a.w+b.x)/2,a.y-7]);
      } else if (a.x===b.x && a.y<b.y && b.y-a.y<a.h+65) {
        c.line([[a.x+a.w/2,a.y+a.h+3],[b.x+b.w/2,b.y-3]],label,tone,false,[a.x+a.w/2+(compact?40:58),(a.y+a.h+b.y)/2+3]);
      } else {
        // Side rails preserve branches and backwards retries instead of inventing a chain.
        const backwards=b.y<a.y, rail=backwards ? W-9 : 9;
        const labelPoint=backwards ? [compact?W/2:W-96,(a.y+a.h+b.y)/2] : [W/2,Math.max(18,b.y-17)];
        c.line([[a.x+a.w/2,a.y+a.h+3],[a.x+a.w/2,a.y+a.h+14],[rail,a.y+a.h+14],[rail,b.y-14],[b.x+b.w/2,b.y-14],[b.x+b.w/2,b.y-3]],label,tone,true,labelPoint);
      }
    }
  };

  if (kind==='state-lanes') {
    if (compact) {
      const phases=groups.slice(0,4).map((g,i)=>{
        const c=canvas(W,382,id+'-phase-'+i),pos=new Map();
        c.panel(12,12,296,356,g.title,g.tone);
        g.nodes.forEach((n,j)=>put(c,pos,n,28,54+j*96,264,80));
        c.text(160,354,'三个状态轨道共享此阶段；不是相互替代',12,'#697985');
        return finish(c,' · '+g.title);
      });
      const c=canvas(W,152,id+'-boundary');
      c.card(groups[4].nodes[0],20,20,280,106,'danger');
      return [...phases,finish(c,' · 独立边界')];
    }
    const c=canvas(W,568,id),pos=new Map();
    groups.slice(0,4).forEach((g,col)=>{
      const x=132+col*153;
      c.text(x+64,27,g.title,14,figurePalette[g.tone][1]);
      c.parts.push('<line x1="'+(x+64)+'" y1="44" x2="'+(x+64)+'" y2="420" stroke="#d5dce1" stroke-width="1" stroke-dasharray="4 5"/>');
      g.nodes.forEach((n,row)=>{
        put(c,pos,{...n,subtitle:undefined},x,76+row*112,128,80);
        if (!col) c.text(18,121+row*112,n.subtitle || '轨道 '+(row+1),13,'#62717c','start');
      });
    });
    c.text(380,443,'同一时间线对齐观察 · 不用一个轨道为另一个轨道出具证明',13,'#697985');
    put(c,pos,groups[4].nodes[0],132,468,604,78,'danger');
    edges(c,pos,diagram.edges.map(e => ['下一阶段','记录下一事件'].includes(e.shortLabel) || e.to===groups[4].nodes[0].id ? {...e,shortLabel:''} : e));
    return [finish(c)];
  }

  if (kind==='failure-settlement') {
    const c=canvas(W,compact?1500:868,id),pos=new Map();
    if (compact) {
      const ordered=[groups[0].nodes[0],groups[0].nodes[1],groups[1].nodes[0],groups[1].nodes[1],groups[2].nodes[1],groups[1].nodes[2],groups[2].nodes[0],groups[0].nodes[2],groups[0].nodes[3],groups[3].nodes[0],groups[3].nodes[1]];
      c.text(160,26,'结算分支与恢复责任分开阅读',15);
      ordered.forEach((n,i)=>{
        const group=groups.find(g=>g.nodeIds.includes(n.id));
        put(c,pos,{...n,subtitle:group.title},26,48+i*126,268,88);
      });
    } else {
      groups.forEach((g,i)=>{c.text(101+i*185,26,g.title,14,figurePalette[g.tone][1]);c.parts.push('<line x1="'+(101+i*185)+'" y1="44" x2="'+(101+i*185)+'" y2="832" stroke="#d5dce1" stroke-dasharray="4 5"/>');});
      [[94,200,480,620],[200,320,440],[480,320],[620,754]].forEach((ys,col)=>{
        groups[col].nodes.forEach((n,i)=>put(c,pos,n,20+col*185,ys[i],162,78));
      });
    }
    edges(c,pos);
    c.text(W/2,compact?1478:855,'超时不产生安全释放证明；恢复不重放旧请求',compact?12:14,'#ad6250');
    return [finish(c)];
  }

  if (kind==='peer-reload') {
    const c=canvas(W,compact?1460:918,id),pos=new Map();
    if (compact) {
      const ordered=[...groups[0].nodes,...groups[1].nodes,...groups[2].nodes,...groups[3].nodes];
      ordered.forEach((n,i)=>put(c,pos,n,40,26+i*124,240,86));
    } else {
      [[groups[0].nodes[0],260,20,240],[groups[0].nodes[1],260,145,240],[groups[0].nodes[2],260,265,240],[groups[0].nodes[3],260,385,240],
       [groups[1].nodes[0],260,505,240],[groups[1].nodes[1],260,625,240],[groups[1].nodes[2],260,745,240],
       [groups[2].nodes[0],20,385,180],[groups[2].nodes[1],552,625,180],[groups[2].nodes[2],552,745,180],[groups[3].nodes[0],552,20,180]]
        .forEach(([n,x,y,w])=>put(c,pos,n,x,y,w,80));
    }
    edges(c,pos);
    c.text(W/2,compact?1435:887,'冷却只跳过本次；再试由后续失败触发',compact?13:15,'#ad6250');
    c.text(W/2,compact?1454:909,'一秒间隔 ≠ 后台定时器 ≠ 恢复 SLA',12,'#697985');
    return [finish(c)];
  }

  if (kind==='constant-paths') {
    if (compact) {
      const root=canvas(W,154,id+'-input');root.card(groups[0].nodes[0],20,12,280,94);root.text(160,135,'下方两条路径共享此编译期输入',13);
      const views=groups.slice(1,3).map((g,i)=>{
        const c=canvas(W,392,id+'-path-'+i),pos=new Map();c.panel(12,12,296,368,g.title,g.tone);
        g.nodes.forEach((n,j)=>put(c,pos,n,30,54+j*108,260,80));edges(c,pos);return finish(c,' · '+g.title);
      });
      const runtime=canvas(W,154,id+'-runtime');runtime.card(groups[3].nodes[0],20,12,280,116,'neutral');
      return [finish(root),...views,finish(runtime,' · 独立运行时路径')];
    }
    const c=canvas(W,674,id),pos=new Map();
    put(c,pos,groups[0].nodes[0],260,12,240,80);
    groups.slice(1,3).forEach((g,i)=>{
      c.panel(16+i*380,124,348,370,g.title,g.tone);
      g.nodes.forEach((n,j)=>put(c,pos,n,36+i*380,168+j*108,308,80));
      const input=groups[0].nodes[0],target=g.nodes[0];
      const branch=diagram.edges.find(e=>e.from===input.id && e.to===target.id);
      if (branch) c.line([[380,95],[380,108],[190+i*380,108],[190+i*380,165]],branch.shortLabel,g.tone,false,[190+i*380,110]);
    });
    edges(c,pos,diagram.edges.filter(e=>e.from!==groups[0].nodes[0].id));
    c.text(380,520,'丢失发生在 BF16 正常舍入之前；GPU 执行不能恢复旧文本丢掉的信息',13,'#697985');
    put(c,pos,groups[3].nodes[0],174,548,412,104,'neutral');
    return [finish(c)];
  }

  if (kind==='source-containment') {
    if (compact) {
      const refs=groups.slice(0,3).map((g,i)=>{
        const c=canvas(W,g.nodes.length*112+84,id+'-reference-'+i),pos=new Map();c.panel(12,12,296,g.nodes.length*112+60,g.title,g.tone);
        g.nodes.forEach((n,j)=>put(c,pos,n,30,54+j*112,260,80));edges(c,pos);
        return finish(c,' · '+g.title);
      });
      const c=canvas(W,188,id+'-installed');c.card(groups[3].nodes[0],20,12,280,114,'neutral');c.text(160,155,'上游引用关系不能证明实际安装产物',13,'#ad6250');
      return [...refs,finish(c,' · 待核对产物')];
    }
    const c=canvas(W,626,id),pos=new Map();
    groups.slice(0,3).forEach((g,i)=>{
      c.panel(16+i*248,12,232,406,g.title,g.tone);
      g.nodes.forEach((n,j)=>put(c,pos,n,28+i*248,64+j*112,208,80));
    });
    put(c,pos,groups[3].nodes[0],180,488,400,104,'neutral');
    edges(c,pos,diagram.edges.map(e=>e.to===groups[3].nodes[0].id ? {...e,shortLabel:''} : e));
    c.text(380,451,'实线是精确源码引用；进入产物的虚线是核查任务，不是包含证明',13,'#ad6250');
    c.text(380,470,'核对构建来源及修复包含关系',12,'#697985');
    c.text(380,614,'发布日期和“3.9”标题不能替代固定源码与构建标识',13,'#697985');
    return [finish(c)];
  }

  if (kind==='deployment-gates') {
    const c=canvas(W,compact?858:572,id),pos=new Map();
    c.text(W/2,25,'四道门均计划执行 · 未声称任何门已通过',compact?14:16,'#8563a2');
    groups[0].nodes.forEach((n,i)=>{
      const x=compact?40:24+i*184,y=compact?54+i*112:74;
      put(c,pos,n,x,y,compact?240:160,84,'control');
      c.text(compact?22:x+80,compact?y+46:55,String(i+1),15,'#8563a2');
    });
    put(c,pos,groups[1].nodes[0],compact?40:180,compact?536:274,compact?240:400,94,'danger');
    put(c,pos,groups[2].nodes[0],compact?40:180,compact?712:426,compact?240:400,94,'neutral');
    edges(c,pos);
    c.text(W/2,compact?837:556,'性能对比是独立检查，不抵消数值失败',compact?12:15,'#ad6250');
    return [finish(c)];
  }
}
