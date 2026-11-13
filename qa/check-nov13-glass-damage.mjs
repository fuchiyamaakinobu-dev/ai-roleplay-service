import fs from 'node:fs';
import assert from 'node:assert/strict';
import {validSelection,validateSelection} from '../lab/selection-core.mjs';
import {session} from './check-inspection-llm-selection.mjs';
const source=fs.readFileSync('app.js','utf8');
const question='フロントガラスやヘッドライト等の灯火類に飛び石などで割れたりヒビが入っていたりしていませんか？';
let count=0;
for(const scenario of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 for(const mode of ['llm','hold','off','error']) {
  const s=session(scenario,async req=>{if(mode==='error')throw Error('offline');if(mode==='hold')return null;assert.equal(validSelection(req),true);return validateSelection({id:'inspection_confirmed_booking_time_customer',kind:'question',topic:'work',evidence:question,answerTarget:question,conditions:[]},req);});
  s.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
  s.run('state.scriptStep=7;renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;');
  if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
  await s.say(question);
  assert.equal(s.run('state.transcript.at(-1).text'),'大丈夫ですよ。',scenario+mode);
  assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_confirmed_booking_time_customer');
  assert.equal(s.run('state.proposedAppointment'),null);count++;
 }
 const s=session(scenario,async()=>null);
 for(const part of ['フロントガラス','ガラス','ヘッドライト','レンズ','ランプ','ライト','灯火類'])for(const damage of ['割れ','ヒビ','ひび','亀裂','穴','損傷','カケ','欠け']) {
  assert.equal(s.run(`asksInspectionGlassDamage(${JSON.stringify(part+'に'+damage+'はありませんか？')})`),true);count++;
 }
 for(const text of ['ガラスの交換をお願いします。','ヘッドライトにヒビがあります。','車体に傷はありませんか？','オイル交換は必要ですか？','ガラスをご持参ください。穴はありませんか？']) {assert.equal(s.run(`asksInspectionGlassDamage(${JSON.stringify(text)})`),false,text);count++;}
 const compound=question+'走行距離は何キロですか？';
 assert.equal(s.run(`inspectionReplyFocus(${JSON.stringify(compound)}).topic`),'mileage');
 assert.equal(s.run(`inspectionReplyFocus(${JSON.stringify('オイル交換は必要ですか？'+question)}).topic`),'work');count+=2;
 s.run('state.analyses=scenario.scoring.map(m=>({[m.key]:true}));state.proposedAppointment={month:"9",day:"30",hour:"10",minute:0};state.transcript=[]');
 const missing=s.run('scoreScriptedRoleplay()');assert.match(missing.improve.join(' '),/損傷確認.*5点減点/);
 s.run('state.transcript='+JSON.stringify([{role:'customer',text:question}]));assert.equal(s.run('scoreScriptedRoleplay().score'),missing.score);
 s.run('state.transcript='+JSON.stringify([{role:'staff',text:compound}]));assert.equal(s.run('scoreScriptedRoleplay().score'),missing.score+5);assert.match(s.run('scoreScriptedRoleplay().judgements.join(" ")'),/損傷確認: ○/);count+=3;
}
const compoundSession=session('vehicle-inspection-phone-followup',async()=>null);
await compoundSession.say(question+'現在の走行距離は何キロですか？');
assert.match(compoundSession.run('state.transcript.at(-1).text'),/3万/);
await compoundSession.say('オイル交換は必要ですか？');
assert.match(compoundSession.run('state.transcript.at(-1).text'),/オイル/);
count+=2;
console.log(`ガラス・灯火類 ${count} 条件 OK`);

