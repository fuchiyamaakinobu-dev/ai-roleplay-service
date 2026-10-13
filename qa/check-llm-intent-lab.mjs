import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import http from 'node:http';
import { validInput, validateJudgement, judgeWithGroq, MODEL } from '../lab/intent-core.mjs';
import { ruleBaseline } from '../lab/rule-baseline.mjs';
import { Budget } from '../lab/budget.mjs';
import { createLabServer } from '../lab/server.mjs';

const input = '点検以外のご用命や、お車で気になる点はございませんか？';
const judgement = { service_request: { verdict: 'yes', evidence: '点検以外のご用命' }, vehicle_concern: { verdict: 'yes', evidence: 'お車で気になる点' } };
assert.ok(validInput({ text: input, live: true }));
for (const value of [null, {}, { text: '', live: true }, { text: ' '.repeat(5), live: false }, { text: 'あ'.repeat(401), live: true }, { text: input, live: 'true' }, { text: input, live: true, model: 'other' }]) assert.ok(!validInput(value));
assert.deepEqual(validateJudgement(judgement, input), judgement);
for (const value of [{}, { ...judgement, extra: true }, { ...judgement, service_request: { verdict: true, evidence: '' } }, { ...judgement, service_request: { verdict: 'yes', evidence: '原文にない根拠' } }, { ...judgement, service_request: { verdict: 'no', evidence: '点検' } }]) assert.throws(() => validateJudgement(value, input));
assert.deepEqual(ruleBaseline(input), { service_request: true, vehicle_concern: true });
assert.deepEqual(ruleBaseline('お車で気になるところはございますか？'), { service_request: false, vehicle_concern: true });
assert.deepEqual(ruleBaseline('追加整備と気になる点は後で確認します。'), { service_request: false, vehicle_concern: false });
// A fresh context per request prevents earlier evidence influencing the comparison.
assert.deepEqual(ruleBaseline('ありがとうございます。'), { service_request: false, vehicle_concern: false });

let calls = 0;
const successFetch = async (url, options) => {
  calls++;
  assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
  const body = JSON.parse(options.body);
  assert.equal(body.model, MODEL);
  assert.equal(body.reasoning_effort, 'none');
  assert.deepEqual(JSON.parse(body.messages[1].content), { text: input });
  assert.equal(body.max_completion_tokens, 320);
  return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(judgement) } }] }) };
};
assert.equal((await judgeWithGroq(input, { apiKey: 'test-only', fetchImpl: successFetch })).status, 'ok');
assert.equal(calls, 1);
for (const [code, expected] of [[429, 'provider_limit'], [401, 'provider_error'], [503, 'provider_error']]) {
  let attempts = 0;
  const result = await judgeWithGroq(input, { fetchImpl: async () => { attempts++; return { ok: false, status: code }; } });
  assert.equal(result.status, expected); assert.equal(attempts, 1);
}
assert.equal((await judgeWithGroq(input, { fetchImpl: async () => { throw new Error('secret must not escape'); } })).status, 'network_error');
assert.equal((await judgeWithGroq(input, { timeoutMs: 10, fetchImpl: (_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('abort')))) })).status, 'timeout');
for (const choice of [{ finish_reason: 'length', message: { content: JSON.stringify(judgement) } }, { finish_reason: 'stop', message: { content: '{bad' } }, { finish_reason: 'stop', message: { content: '{}' } }]) {
  assert.equal((await judgeWithGroq(input, { fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [choice] }) }) })).status, 'invalid_output');
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roleplay-llm-test-'));
let server;
try {
  let now = Date.parse('2026-10-13T14:59:00Z');
  const file = path.join(dir, 'budget.json');
  const budget = new Budget(file, { now: () => now, dailyLimit: 2 });
  assert.equal(budget.reserve(), 'ok');
  assert.equal(budget.reserve(), 'cooldown');
  now += 30000;
  assert.equal(budget.reserve(), 'ok');
  now += 30000; // Midnight JST resets the daily lab allowance.
  assert.equal(budget.reserve(), 'ok');
  assert.equal(new Budget(file, { now: () => now }).status().used, 1);
  now += 30000;
  assert.equal(budget.reserve(), 'ok');
  now += 30000;
  assert.equal(budget.reserve(), 'daily_limit');
  budget.block();
  assert.equal(budget.reserve(), 'provider_limit');
  now += 86400001;
  assert.equal(budget.reserve(), 'ok');
  fs.writeFileSync(file, 'broken');
  assert.throws(() => budget.reserve());

  let providerCalls = 0;
  const freshBudget = new Budget(path.join(dir, 'http-budget.json'), { intervalMs: 0, dailyLimit: 2 });
  server = createLabServer({ enabled: true, apiKey: 'test-only-key', budget: freshBudget,
    judge: async () => { providerCalls++; return { status: 'ok', judgement }; } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  let origin = `http://127.0.0.1:${server.address().port}`;
  const post = (body, extra = {}) => fetch(origin + '/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...extra }, body: JSON.stringify(body) });
  assert.equal((await fetch(origin + '/')).status, 200);
  const roleplayPage = await (await fetch(origin + '/roleplay/')).text();
  assert.ok(roleplayPage.includes('roleplay-bridge.js'));
  assert.ok(!roleplayPage.includes('results-store.js'));
  assert.ok(!roleplayPage.includes('cloud-scenario.js'));
  assert.equal((await fetch(origin + '/roleplay/app.js')).status, 200);
  assert.equal((await fetch(origin + '/roleplay/audio/customer_additional_service_request.mp3')).status, 200);
  assert.equal((await fetch(origin + '/roleplay/.env.local')).status, 404);
  for (const route of ['/.env.local', '/.llm-lab/budget.json', '/app.js', '/server.mjs', '/%2e%2e/.env.local']) assert.equal((await fetch(origin + route)).status, 404);
  const config = await (await fetch(origin + '/api/status')).text();
  assert.ok(!config.includes('test-only-key'));
  assert.equal((await post({ text: input, live: true }, { Origin: 'https://evil.example' })).status, 403);
  const badHostStatus = await new Promise((resolve, reject) => {
    http.get(origin + '/api/status', { headers: { Host: 'evil.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(badHostStatus, 403);
  assert.equal((await post({ text: input, live: true, apiKey: 'override' })).status, 400);
  let data = await (await post({ text: input, live: false })).json();
  assert.equal(data.llm.status, 'disabled'); assert.equal(providerCalls, 0);
  data = await (await post({ text: input, live: true })).json();
  assert.equal(data.llm.status, 'ok'); assert.equal(data.mode, 'comparison_only');
  assert.deepEqual(data.baseline, ruleBaseline(input));
  await post({ text: input, live: true });
  data = await (await post({ text: input, live: true })).json();
  assert.equal(data.llm.status, 'daily_limit'); assert.equal(providerCalls, 2);
  await new Promise(resolve => server.close(resolve));
  server = createLabServer({ budget: freshBudget, judge: async () => { throw new Error('must not call'); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  data = await (await post({ text: input, live: true })).json();
  assert.equal(data.llm.status, 'not_configured');
  assert.deepEqual(data.baseline, ruleBaseline(input));
} finally {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('LLM比較: 原文根拠・入力検証・既存判定・未接続・上限・日付更新・失敗・秘密非公開 OK（外部API未使用）');
