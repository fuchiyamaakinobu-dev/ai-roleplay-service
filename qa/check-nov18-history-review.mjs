import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';
import {validSelection, validateSelection} from '../lab/selection-core.mjs';
import {judgeWithGroq} from '../lab/intent-core.mjs';
const source=fs.readFileSync('app.js','utf8');

const waiting = 'はい。点検は作業時間一時間程度となりますが、ええ、お待ちいただけるという形でよろしかったでしょうか。';
for (const mode of ['selected','held','off','error']) {
  const s = session('service-12month-visit-promotion', async request => {
    assert.ok(validSelection(request));
    if (mode === 'error') throw Error('unavailable');
    if (mode === 'held') return null;
    const candidate = request.candidates.find(c => c.action === 'waiting_confirmation');
    assert.ok(candidate);
    return validateSelection({id:candidate.id,kind:'question',topic:'waiting',evidence:waiting}, request);
  });
  s.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
  s.run('renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;');
  s.run("state.currentState='ALTERNATIVE_PROPOSAL';state.pickupRequested=true;state.resolutionType='visitBenefit';");
  if (mode === 'off') s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
  await s.say(waiting);
  assert.equal(s.run('state.transcript.at(-1).text'), 'はい、お願いします。');
  assert.equal(s.run('state.currentState'), 'ALTERNATIVE_PROPOSAL');
  assert.equal(s.run('state.appointmentDateConfirmed'), false);
  assert.equal(s.run('state.ended'), false);
  assert.ok(fs.existsSync(s.run('audioPath(state.transcript.at(-1).audioId)')));
  for (const text of ['お待ちいただく間に、気になる点はありますか？','代車と店内待ちのどちらがよろしいでしょうか？','お待ちいただけません。','今週の土曜日はいかがでしょうか？']) {
    s.run(`state.transcript.push({role:'staff',text:${JSON.stringify(text)}})`);
    assert.equal(s.run('branchingWaitingCandidate()'),null,text);
  }
}
const score = session('service-12month-visit-promotion',async()=>null);
score.run("state.serviceRequestAsked=true;state.vehicleConcernAsked=true;state.analyses=[Object.fromEntries(scenario.scoring.map(m=>[m.key,true]))];state.analyses[0].proposed_weekend=false;state.analyses[0].proposed_other_store=false;");
for (const [reason,weekend,store] of [[null,false,false],['work',true,false],['distance',false,true],['drivingConfidence',false,true],['competitor',false,false]]) {
  score.run(`state.pickupReason=${JSON.stringify(reason)};state.currentObjection=null;`);
  const result = score.run('scoreRoleplay()');
  assert.equal(result.improve.some(t=>t.includes('土日')),weekend,JSON.stringify(result));
  assert.equal(result.improve.some(t=>t.includes('他店舗')),store,JSON.stringify(result));
  if (!weekend && !store) assert.equal(result.score,100);
}
const input={text:'日頃はお世話になっております。',candidates:[]};
for (const reason of ['work','distance','driving','competitor']) {
  const s=session('vehicle-inspection-pickup-delivery',async()=>null);
  s.run(`state.inspectionPickupActive=true;state.inspectionPickupPhase='proposal';state.inspectionPickupReason='${reason}';state.variantSeed=0;`);
  for (let i=0;i<4;i++) {
    await s.say('実際にお店にお越しいただいて、工場の方から直接お車について説明をさせていただければと思ったのですが、いかがでしょうか？');
    assert.equal(s.run('state.inspectionPickupReason'),reason);
    assert.notEqual(s.run('state.inspectionPickupPhase'),'reason');
    assert.notEqual(s.run('state.inspectionPickupOutcome'),'visit','Repeated invitation must not force consent');
  }
}
const value={id:'rule',kind:'explanation',topic:'other',evidence:input.text,answerTarget:input.text,conditions:[]};
async function output(content,finish='stop') {
  return judgeWithGroq(input.text,{apiKey:'test',selection:input,fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:finish,message:{content}}]})})});
}
assert.equal((await output('```json\n'+JSON.stringify(value)+'\n```')).status,'ok');
assert.equal((await output('説明'+JSON.stringify(value))).detail,'json_syntax');
assert.equal((await output(JSON.stringify({...value,evidence:'存在しない原文'}))).detail,'validation');
assert.equal((await output(JSON.stringify({...value,answerTarget:'存在しない質問'}))).detail,'invalid_focus');
assert.equal((await output('{','length')).detail,'truncated');
const limited=await judgeWithGroq('test',{apiKey:'test',fetchImpl:async()=>({ok:false,status:429,headers:new Headers({'retry-after':'42'})})});
assert.equal(limited.retryAfterSeconds,42);
console.log('11月18日: 待ち方への回答・質問優先・音声・理由別採点・厳密JSON・429待機時間 OK');
