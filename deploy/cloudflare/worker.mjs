import { judgeWithGroq, MODEL } from '../../lab/intent-core.mjs';
import { validSelection } from '../../lab/selection-core.mjs';

const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
const dayAt = now => new Date(now + 9 * 3600000).toISOString().slice(0,10);

// All callers share a single durable counter. Only usage metadata is persisted.
export class RoleplayBudget {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    const now = Date.now();
    const path = new URL(request.url).pathname;
    if (path === '/status') {
      const value = await this.state.storage.get('budget');
      return json({used:value?.day === dayAt(now) ? value.used : 0, limit:50});
    }
    if (path !== '/reserve' && path !== '/block') return json({error:'not_found'},404);
    const result = await this.state.storage.transaction(async storage => {
      const value = await storage.get('budget') || {day:'',used:0,last:0,blockedUntil:0};
      if (path === '/block') {
        await storage.put('budget',{...value,blockedUntil:now+86400000});
        return 'provider_limit';
      }
      const used = value.day === dayAt(now) ? value.used : 0;
      if (now < value.blockedUntil) return 'provider_limit';
      if (used >= 50) return 'daily_limit';
      if (value.last && now - value.last < 15000) return 'cooldown';
      await storage.put('budget',{day:dayAt(now),used:used+1,last:now,blockedUntil:value.blockedUntil});
      return 'ok';
    });
    return json({status:result});
  }
}

export async function handle(request, env, judge = judgeWithGroq) {
  const origin = request.headers.get('Origin');
  // CORS is a browser restriction, not authentication. Global budget bounds public usage.
  if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return json({error:'origin'},403);
  const cors = response => {
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin',env.ALLOWED_ORIGIN);
    headers.set('Vary','Origin');
    headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers','Content-Type');
    return new Response(response.body,{status:response.status,headers});
  };
  if (request.method === 'OPTIONS') return cors(new Response(null,{status:204}));
  try {
    const path = new URL(request.url).pathname;
    const budget = env.BUDGET.get(env.BUDGET.idFromName('global'));
    const ready = env.LLM_ENABLED === 'true' && !!env.GROQ_API_KEY;
    if (request.method === 'GET' && path === '/api/status') {
      const usage = await budget.fetch('https://budget/status').then(r=>r.json());
      return cors(json({ready,model:MODEL,...usage}));
    }
    if (request.method !== 'POST' || path !== '/api/select') return cors(json({error:'not_found'},404));
    if (request.headers.get('Content-Type') !== 'application/json') return cors(json({error:'content_type'},415));
    const reader = request.body?.getReader();
    if (!reader) return cors(json({error:'invalid_input'},400));
    let bytes = 0, body = '';
    const decoder = new TextDecoder();
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 24576) { await reader.cancel(); return cors(json({error:'too_large'},413)); }
      body += decoder.decode(value,{stream:true});
    }
    body += decoder.decode();
    let input;
    try { input = JSON.parse(body); } catch { return cors(json({error:'invalid_input'},400)); }
    if (!validSelection(input)) return cors(json({error:'invalid_input'},400));
    const reply = (llm, elapsedMs=0) => cors(json({llm,elapsedMs,mode:'candidate_selection'}));
    if (!ready) return reply({status:'not_configured'});
    const allowance = await budget.fetch('https://budget/reserve',{method:'POST'}).then(r=>r.json());
    if (allowance.status !== 'ok') return reply({status:allowance.status});
    const started = Date.now();
    const llm = await judge(input.text,{apiKey:env.GROQ_API_KEY,selection:input});
    if (llm.status === 'provider_limit') await budget.fetch('https://budget/block',{method:'POST'});
    return reply(llm,Date.now()-started);
  } catch { return cors(json({llm:{status:'service_error'}},503)); }
}

export default { fetch(request, env) { return handle(request, env); } };
