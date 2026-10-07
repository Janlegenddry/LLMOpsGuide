// Only explicit site paths become links. Everything else remains escaped text.
export function splitInternalLinks(value) {
  const text = String(value), parts = [], pattern = /\[([^\[\]\n]{1,150})\]\((\/(?:[a-z0-9-]+\/)+)\)/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > end) parts.push({ text: text.slice(end, match.index) });
    parts.push({ text: match[1], path: match[2] }); end = match.index + match[0].length;
  }
  if (end < text.length || !parts.length) parts.push({ text: text.slice(end) });
  return parts;
}
export const inlineText = value => splitInternalLinks(value).map(p => p.text).join('');
