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

export function sourceName(raw) {
  try { return officialSource(new URL(raw))?.name ?? '来源待核对'; }
  catch { return '来源待核对'; }
}
