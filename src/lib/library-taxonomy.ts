export const libraryDomains = [
  { id: 'ai-infra', title: 'AI Infra', description: '从模型生命周期到推理系统、硬件通信与生产诊断。' },
] as const;
export const libraryTypes = { article: '文章', report: '完整报告', whitepaper: '白皮书', note: '来源摘记' };
export const libraryStates = { organized: '已整理', unread: '待解读' };
export function knowledgeHref(url: string, base: string): string {
  return url.startsWith('/') ? `${base.replace(/\/$/, '')}${url}` : url;
}
