export const reportSectionIDs = ['conclusion', 'background', 'mechanism', 'evidence', 'tradeoffs', 'production', 'experiments', 'acceptance', 'pending'];
export const basisNames = { official: '官方事实', author: '作者报告结果', inference: '推导 / 教学示例', pending: '待验证' };

// Only structured text and graph coordinates enter the renderer; no HTML or SVG payloads.
export function validateReport(raw, sources, { keys, str, array, fail }) {
  keys(raw, ['version', 'scope', 'sections'], 'report');
  if (raw.version !== 1) fail('report.version 必须为 1');
  const provenance = (block, name) => {
    if (!Object.hasOwn(basisNames, block.basis)) fail(`${name}.basis 必须是 official、author、inference 或 pending`);
    const indices = [...new Set(array(block.sourceIndices, `${name}.sourceIndices`, ['official', 'author'].includes(block.basis) ? 1 : 0, 30))];
    if (indices.some(i => !Number.isInteger(i) || i < 0 || i >= sources.length)) fail(`${name} 引用了不存在的来源`);
    return { basis: block.basis, sourceIndices: indices };
  };
  const sections = array(raw.sections, 'report.sections', 9, 9).map((section, index) => {
    const name = `report.sections[${index}]`;
    keys(section, ['id', 'title', 'blocks'], name);
    if (!reportSectionIDs.includes(section.id)) fail(`${name}.id 必须是已约定的报告章节`);
    const blocks = array(section.blocks, `${name}.blocks`, 1, 40).map((block, i) => {
      const b = `${name}.blocks[${i}]`;
      if (!block || typeof block !== 'object') fail(`${b} 必须是对象`);
      if (['paragraph', 'callout', 'code'].includes(block.type)) {
        keys(block, ['type', 'basis', 'sourceIndices', 'text', ...(block.type === 'callout' ? ['title'] : []), ...(block.type === 'code' ? ['language'] : [])], b);
        const out = { type: block.type, ...provenance(block, b), text: str(block.text, `${b}.text`, 20000) };
        if (block.type === 'callout') out.title = str(block.title, `${b}.title`, 160);
        if (block.type === 'code') {
          if (!['text', 'bash', 'python', 'json', 'promql'].includes(block.language)) fail(`${b}.language 不支持`);
          out.language = block.language;
        }
        return out;
      }
      if (block.type === 'list') {
        keys(block, ['type', 'basis', 'sourceIndices', 'items'], b);
        return { type: 'list', ...provenance(block, b), items: array(block.items, `${b}.items`, 1, 30).map(t => str(t, `${b}.item`, 4000)) };
      }
      if (block.type === 'table') {
        keys(block, ['type', 'caption', 'columns', 'rows'], b);
        const columns = array(block.columns, `${b}.columns`, 2, 6).map(t => str(t, `${b}.column`, 100));
        const rows = array(block.rows, `${b}.rows`, 1, 40).map((row, j) => {
          keys(row, ['cells', 'basis', 'sourceIndices'], `${b}.rows[${j}]`);
          return { cells: array(row.cells, `${b}.cells`, columns.length, columns.length).map(t => str(t, `${b}.cell`, 4000)), ...provenance(row, `${b}.rows[${j}]`) };
        });
        return { type: 'table', caption: str(block.caption, `${b}.caption`, 300), columns, rows };
      }
      if (block.type === 'diagram') {
        keys(block, ['type', 'title', 'caption', 'basis', 'sourceIndices', 'nodes', 'edges'], b);
        const occupied = new Set();
        const ids = new Set();
        const nodes = array(block.nodes, `${b}.nodes`, 2, 16).map(node => {
          keys(node, ['id', 'label', 'detail', 'column', 'row'], `${b}.node`);
          if (typeof node.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(node.id) || ids.has(node.id)) fail(`${b} 的图节点 ID 必须唯一`);
          if (![node.column, node.row].every(n => Number.isInteger(n) && n >= 0 && n <= 3)) fail(`${b} 图坐标必须是 0–3 的整数`);
          const position = `${node.column}:${node.row}`;
          if (occupied.has(position)) fail(`${b} 图节点不能重叠`);
          occupied.add(position); ids.add(node.id);
          return { id: node.id, label: str(node.label, `${b}.label`, 40), detail: str(node.detail, `${b}.detail`, 2000), column: node.column, row: node.row };
        });
        const edges = array(block.edges, `${b}.edges`, 1, 30).map(edge => {
          keys(edge, ['from', 'to', 'label'], `${b}.edge`);
          if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) fail(`${b} 图连线必须连接不同的现有节点`);
          return { from: edge.from, to: edge.to, label: str(edge.label, `${b}.edge.label`, 120) };
        });
        return { type: 'diagram', title: str(block.title, `${b}.title`, 160), caption: str(block.caption, `${b}.caption`, 1500), ...provenance(block, b), nodes, edges };
      }
      if (block.type === 'bars') {
        keys(block, ['type', 'title', 'caption', 'unit', 'basis', 'sourceIndices', 'series'], b);
        const series = array(block.series, `${b}.series`, 2, 12).map(series => {
          keys(series, ['label', 'segments'], `${b}.series`);
          return { label: str(series.label, `${b}.series.label`, 100), segments: array(series.segments, `${b}.segments`, 1, 6).map(segment => {
            keys(segment, ['label', 'value'], `${b}.segment`);
            if (typeof segment.value !== 'number' || !Number.isFinite(segment.value) || segment.value <= 0 || segment.value > 100000) fail(`${b} 条图数值必须为有限正数`);
            return { label: str(segment.label, `${b}.segment.label`, 80), value: segment.value };
          }) };
        });
        return { type: 'bars', title: str(block.title, `${b}.title`, 160), caption: str(block.caption, `${b}.caption`, 1500), unit: str(block.unit, `${b}.unit`, 20), ...provenance(block, b), series };
      }
      fail(`${b}.type 不支持；不会静默丢弃正文块`);
    });
    return { id: section.id, title: str(section.title, `${name}.title`, 160), blocks };
  });
  if (new Set(sections.map(s => s.id)).size !== reportSectionIDs.length) fail('完整报告必须包含九个不同章节');
  const has = (id, type) => sections.find(s => s.id === id).blocks.some(b => b.type === type);
  if (!has('mechanism', 'diagram')) fail('机制章节必须包含机制图');
  for (const id of ['evidence', 'experiments', 'acceptance']) if (!has(id, 'table')) fail(`${id} 章节必须包含证据或验证表格`);
  const report = { version: 1, scope: str(raw.scope, 'report.scope', 3000), sections };
  // Reject oversized inputs rather than truncate any prose, table or diagram.
  if (Buffer.byteLength(JSON.stringify(report)) > 200000) fail('完整报告超过 200000 字节；请拆分或通过仓库内容文件发布，不会截断正文');
  return report;
}
