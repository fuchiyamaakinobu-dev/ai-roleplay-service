import assert from 'node:assert/strict';
import {handle,RoleplayBudget} from '../deploy/cloudflare/worker.mjs';
const data = new Map();
const storage = {get:async k=>data.get(k),put:async(k,v)=>data.set(k,v),transaction:async fn=>fn(storage)};
const budget = new RoleplayBudget({storage},{});
const env = {ALLOWED_ORIGIN:'https://example.com',LLM_ENABLED:'true',GROQ_API_KEY:'test-secret',
  BUDGET:{idFromName:()=> 'global',get:()=>({fetch:(url,init)=>budget.fetch(new Request(url,init))})}};
const input={text:'何キロですか？',live:true,history:[],context:{phase:'inspection:test',additionalAnswered:false,timeExplained:true},
  candidates:[{id:'distance',action:'inspection_mileage',text:'3万キロです'}]};
const request=(body=input,origin=env.ALLOWED_ORIGIN)=>new Request('https://api.example.com/api/select',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
let calls=0;
const judge=async()=>{calls++;return {status:'ok',judgement:{id:'distance'}};};
assert.equal((await handle(request(input,'https://other.example'),env,judge)).status,403);
assert.equal((await handle(request({}),env,judge)).status,400);
assert.equal((await handle(request({text:'x'.repeat(25000)}),env,judge)).status,413);
assert.equal(calls,0);
const result=await handle(request(),env,judge);
assert.equal(result.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGIN);
assert.equal((await result.json()).llm.status,'ok');
assert.equal((await (await handle(request(),env,judge)).json()).llm.status,'cooldown');
assert.equal(calls,1);
const now=Date.now(),day=new Date(now+9*3600000).toISOString().slice(0,10);
data.set('budget',{day,used:50,last:0,blockedUntil:0});
assert.equal((await (await handle(request(),env,judge)).json()).llm.status,'daily_limit');
data.set('budget',{day:'2000-01-01',used:50,last:0,blockedUntil:0});
assert.equal((await (await handle(request(),env,judge)).json()).llm.status,'ok');
await budget.fetch(new Request('https://budget/block',{method:'POST'}));
assert.equal((await (await handle(request(),env,judge)).json()).llm.status,'provider_limit');
assert.equal((await (await handle(request(),{...env,LLM_ENABLED:'false'},judge)).json()).llm.status,'not_configured');
assert.ok(!JSON.stringify([...data.values()]).includes('何キロ'));
assert.ok(!JSON.stringify([...data.values()]).includes('test-secret'));
console.log('公開API準備: Origin・入力上限・日次上限・間隔・日付更新・429停止・秘密非保存 OK');
