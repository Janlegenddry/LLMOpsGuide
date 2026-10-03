import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePayload, mergeRecords } from '../src/lib/radar-store.mjs';

export async function importPayload(payload, storePath, { dryRun = false } = {}) {
  const incoming = parsePayload(payload);
  const lock = `${storePath}.lock`;
  await mkdir(dirname(storePath), { recursive: true });
  try { await mkdir(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error('另一项内容导入正在运行；等待完成后重试。异常中断时确认无导入进程再删除 .lock 目录。');
    throw error;
  }
  const temp = `${storePath}.${process.pid}.tmp`;
  try {
    let existing = [];
    try { existing = JSON.parse(await readFile(storePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const result = mergeRecords(existing, incoming);
    if (!dryRun && (result.added || result.updated)) {
      await writeFile(temp, `${JSON.stringify(result.records, null, 2)}\n`, { flag: 'wx' });
      await rename(temp, storePath);
    }
    return { added: result.added, updated: result.updated, unchanged: result.unchanged, total: result.records.length, dryRun };
  } finally { await rm(temp, { force: true }); await rm(lock, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const input = args.find(a => !a.startsWith('--'));
    if (!input || args.some(a => a.startsWith('--') && a !== '--dry-run')) throw new Error('用法：npm run content:import -- payload.json [--dry-run]，payload.json 可为 -（stdin）');
    let content = '';
    if (input === '-') { for await (const chunk of process.stdin) content += chunk; }
    else content = await readFile(resolve(input), 'utf8');
    if (Buffer.byteLength(content) > 500000) throw new Error('payload 不得超过 500 KB');
    const storePath = fileURLToPath(new URL('../src/content/radar.json', import.meta.url));
    console.log(JSON.stringify(await importPayload(JSON.parse(content), storePath, { dryRun: args.includes('--dry-run') })));
  } catch (error) { console.error(`内容导入失败：${error.message}`); process.exitCode = 1; }
}
