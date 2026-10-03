import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { importPayload } from './import-radar.mjs';

try {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const payload = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    ? JSON.parse(event.inputs.payload)
    : { records: event.client_payload.records };
  if (Buffer.byteLength(JSON.stringify(payload)) > 500000) throw new Error('payload 过大');
  console.log(JSON.stringify(await importPayload(payload, fileURLToPath(new URL('../src/content/radar.json', import.meta.url)))));
} catch (error) { console.error(`内容导入失败：${error.message}`); process.exitCode = 1; }
