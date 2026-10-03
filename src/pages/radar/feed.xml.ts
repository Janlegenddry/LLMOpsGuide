import { radar, radarHref } from '../../radar';
import { withBase } from '../../paths';
const xml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
export function GET({ site }: { site: URL }) {
  const home = new URL(withBase('/'), site).href;
  const body = radar.map(record => {
    const url = new URL(withBase(radarHref(record.id)), site).href;
    return `<item><title>${xml(record.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(`${record.summary} 原文：${record.sources[0].url}；原文日期：${record.publishedAt}；核对：${record.reviewedAt}`)}</description><pubDate>${new Date(`${record.publishedAt}T00:00:00Z`).toUTCString()}</pubDate></item>`;
  }).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>观志 · AI Infra 动态与解读</title><link>${xml(home)}</link><description>公开资料原创摘要、证据与验证问题</description><language>zh-CN</language>${body}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
