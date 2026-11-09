import { jobs } from '../../jobs';
export function GET() {
  return new Response(JSON.stringify({schemaVersion:1,records:jobs}),{headers:{'Content-Type':'application/json; charset=utf-8'}});
}
