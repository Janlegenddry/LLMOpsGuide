import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateKnowledge } from '../src/lib/knowledge-store.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
const records = validateKnowledge(JSON.parse(readFileSync(`${root}src/content/knowledge.json`,'utf8')),{publicRoot:`${root}public`});
console.log(JSON.stringify({whitepapers:records.length,hostedFiles:'validated',publicScope:'explicit'}));
