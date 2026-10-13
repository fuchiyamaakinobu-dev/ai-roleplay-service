import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Budget } from './budget.mjs';
import { MODEL, validInput, judgeWithGroq } from './intent-core.mjs';
import { ruleBaseline } from './rule-baseline.mjs';
import { validSelection } from './selection-core.mjs';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/client.js', ['client.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
]);
const roleplayAssets = new Map([
  ['/roleplay/app.js', ['../app.js', 'text/javascript; charset=utf-8']],
  ['/roleplay/scenario.js', ['../scenario.js', 'text/javascript; charset=utf-8']],
  ['/roleplay/audio-db.js', ['../audio-db.js', 'text/javascript; charset=utf-8']],
  ['/roleplay/styles.css', ['../styles.css', 'text/css; charset=utf-8']],
  ['/roleplay/roleplay-bridge.js', ['roleplay-bridge.js', 'text/javascript; charset=utf-8']]
]);

export function createLabServer({ apiKey = '', enabled = false,
  budget = new Budget(fileURLToPath(new URL('../.llm-lab/budget.json', import.meta.url))),
  judge = judgeWithGroq } = {}) {
  let busy = false;
  const server = http.createServer(async (req, res) => {
    const json = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const host = `127.0.0.1:${server.address().port}`;
    if (req.headers.host !== host) return json(403, { error: 'host' });
    const url = new URL(req.url, `http://${host}`);
    try {
      if (req.method === 'GET' && url.pathname === '/roleplay/') {
        const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
          .replace(/<script[^>]+src="\.\/results-store\.js[^>]*><\/script>/, '')
          .replace(/<script[^>]+src="\.\/cloud-scenario\.js[^>]*><\/script>/,
            '<script src="./roleplay-bridge.js"></script><script src="./app.js"></script>')
          .replace('ローカル判定モード', 'LLM連携検証・履歴保存なし');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
      const publicAsset = roleplayAssets.get(url.pathname);
      const audioMatch = /^\/roleplay\/(audio|audio-ondoku)\/([A-Za-z0-9_-]+\.mp3)$/.exec(url.pathname);
      if (req.method === 'GET' && (publicAsset || audioMatch)) {
        const [file, type] = publicAsset || [`../${audioMatch[1]}/${audioMatch[2]}`, 'audio/mpeg'];
        const location = new URL(file, import.meta.url);
        if (!fs.existsSync(location)) return json(404, { error: 'not_found' });
        res.writeHead(200, { 'Content-Type': type });
        return res.end(fs.readFileSync(location));
      }
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        res.writeHead(200, { 'Content-Type': type });
        return res.end(fs.readFileSync(new URL(file, import.meta.url)));
      }
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const { used } = budget.status();
        return json(200, { ready: enabled && !!apiKey, model: MODEL, used, limit: budget.dailyLimit });
      }
      const selecting = url.pathname === '/api/select';
      if (req.method !== 'POST' || (!selecting && url.pathname !== '/api/compare')) return json(404, { error: 'not_found' });
      // Reject cross-site calls; serve no credential file or repository file.
      if (req.headers.origin !== `http://${host}` || req.headers['content-type'] !== 'application/json') {
        req.resume(); return json(403, { error: 'origin' });
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 24576) { json(413, { error: 'too_large' }); req.destroy(); return; }
        chunks.push(chunk);
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return json(400, { error: 'invalid_input' }); }
      if (!(selecting ? validSelection(input) : validInput(input))) return json(400, { error: 'invalid_input' });
      const baseline = ruleBaseline(input.text);
      const reply = (llm, elapsedMs = 0) => json(200, { baseline, llm, elapsedMs, mode: selecting ? 'candidate_selection' : 'comparison_only' });
      if (!input.live) return reply({ status: 'disabled' });
      if (!enabled || !apiKey) return reply({ status: 'not_configured' });
      if (busy) return reply({ status: 'busy' });
      let allowance;
      try { allowance = selecting ? budget.reserve(15000) : budget.reserve(); }
      catch { return reply({ status: 'budget_error' }); }
      if (allowance !== 'ok') return reply({ status: allowance });
      busy = true;
      const started = Date.now();
      try {
        const llm = await judge(input.text, { apiKey, selection: selecting ? input : null });
        if (llm.status === 'provider_limit') budget.block();
        return reply(llm, Date.now() - started);
      } catch { return reply({ status: 'network_error' }, Date.now() - started); }
      finally { busy = false; }
    } catch { if (!res.headersSent) json(500, { error: 'lab_error' }); else res.end(); }
  });
  server.requestTimeout = 10000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createLabServer({ apiKey: process.env.GROQ_API_KEY,
    enabled: process.env.LLM_LAB_FREE_PLAN_CONFIRMED === 'true' });
  server.on('error', () => { console.error('検証サーバーを起動できません。ポート4318の使用状況を確認してください。'); process.exitCode = 1; });
  server.listen(4318, '127.0.0.1', () => console.log('LLM判定比較: http://127.0.0.1:4318'));
}
