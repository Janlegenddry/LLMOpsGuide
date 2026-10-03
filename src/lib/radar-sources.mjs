// Curated official repositories only. Organization-wide GitHub access is not allowed.
export const githubSources = [
  { repository: 'sgl-project/sglang', name: 'SGLang' },
  { repository: 'vllm-project/vllm', name: 'vLLM' },
  { repository: 'vllm-project/vllm-ascend', name: 'vLLM Ascend' },
  { repository: 'flashinfer-ai/flashinfer', name: 'FlashInfer' },
  { repository: 'kvcache-ai/Mooncake', name: 'Mooncake' },
  { repository: 'NVIDIA/nccl', name: 'NCCL' },
  { repository: 'pytorch/pytorch', name: 'PyTorch' },
  { repository: 'triton-lang/triton', name: 'Triton' },
  { repository: 'ai-dynamo/dynamo', name: 'Dynamo' },
];

// A path matches the exact segment and its descendants, never a substring prefix.
export const webSources = [
  { hostname: 'lmsys.org', path: '/blog', name: 'LMSYS · Blog' },
  { hostname: 'www.lmsys.org', path: '/blog', name: 'LMSYS · Blog' },
  { hostname: 'docs.sglang.io', path: '/', name: 'SGLang · Docs' },
  { hostname: 'docs.vllm.ai', path: '/projects/ascend', name: 'vLLM Ascend · Docs' },
  { hostname: 'docs.vllm.ai', path: '/', name: 'vLLM · Docs' },
  { hostname: 'vllm.ai', path: '/blog', name: 'vLLM · Blog' },
  { hostname: 'blog.vllm.ai', path: '/', name: 'vLLM · Blog' },
  { hostname: 'docs.flashinfer.ai', path: '/', name: 'FlashInfer · Docs' },
  { hostname: 'kvcache-ai.github.io', path: '/Mooncake', name: 'Mooncake · Docs' },
  { hostname: 'docs.nvidia.com', path: '/deeplearning/nccl', name: 'NCCL · Docs' },
  { hostname: 'docs.nvidia.com', path: '/dynamo', name: 'Dynamo · Docs' },
  { hostname: 'developer.nvidia.com', path: '/blog', name: 'NVIDIA · Blog' },
  { hostname: 'pytorch.org', path: '/blog', name: 'PyTorch · Blog' },
  { hostname: 'triton-lang.org', path: '/', name: 'Triton · Docs' },
];

export const pathWithin = (pathname, prefix) => prefix === '/' || pathname === prefix || pathname.startsWith(`${prefix}/`);
export function officialSource(url) {
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search) return undefined;
  if (url.hostname === 'github.com') {
    const [, owner, repository] = url.pathname.split('/');
    const source = githubSources.find(s => s.repository.toLowerCase() === `${owner}/${repository}`.toLowerCase());
    return source && { name: `${source.name} · GitHub`, repository: source.repository };
  }
  return webSources.find(s => s.hostname === url.hostname && pathWithin(url.pathname, s.path));
}

export const citationCategories = { paper: '论文', community: '社区', blog: '博客', news: '新闻' };
export const peerReviewNames = { preprint: '预印本', 'peer-reviewed': '同行评审已核对', unknown: '同行评审状态未知' };
// A repository's issue/discussion or comment is community evidence, even on a registered repo.
export function communityURL(url) {
  if (url.hostname !== 'github.com') return false;
  try { return /^\/[^/]+\/[^/]+\/(?:issues|discussions)(?:\/|$)/.test(decodeURIComponent(url.pathname)) || /^(?:#issuecomment-|#discussion_r|#discussioncomment-)/.test(decodeURIComponent(url.hash)); }
  catch { return true; }
}
export function isOfficialCitation(source) {
  try { const url = new URL(source.url); return !source.review && !communityURL(url) && Boolean(officialSource(url)); }
  catch { return false; }
}
export const canAttributeCitation = source => isOfficialCitation(source) || source.review?.status === 'attributed';

export function sourceName(raw) {
  const source = typeof raw === 'string' ? { url: raw } : raw;
  if (source?.review) {
    const review = source.review;
    return `${review.publisher} · ${citationCategories[review.category]}${review.category === 'paper' ? `（${peerReviewNames[review.peerReview]}）` : ''}`;
  }
  try { const url = new URL(source.url); return !communityURL(url) && officialSource(url)?.name || '来源待核对'; }
  catch { return '来源待核对'; }
}

export const sourceReviewLabel = source => source.review?.status === 'attributed' ? '已核对原文陈述 · 未独立验证' : '待核对来源陈述';
