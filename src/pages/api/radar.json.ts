import { radar } from '../../radar';
export function GET() {
  return new Response(JSON.stringify({ schemaVersion: 1, records: radar }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
