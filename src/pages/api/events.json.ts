import { events } from '../../events';
export function GET() {
  return new Response(JSON.stringify({schemaVersion:1,records:events}),{headers:{'Content-Type':'application/json; charset=utf-8'}});
}
