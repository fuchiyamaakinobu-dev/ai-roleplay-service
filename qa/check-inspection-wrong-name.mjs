import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';
import {validSelection,validateSelection} from '../lab/selection-core.mjs';
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']){
 for(const introduced of [false,true])for(const mode of ['llm','failure','off']){
  let calls=0;
  const s=session(id,async req=>{calls++;assert.ok(validSelection(req));if(mode==='failure')return null;return validateSelection({kind:'question',topic:'identity',evidence:req.text,id:req.candidates[0].id},req);});
  s.run('state.scriptStep=0;');
  if(introduced)s.run("state.transcript.push({role:'staff',text:'トヨタモビリティ帯広の山田と申します。'});");
  if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false;');
  await s.say('田中様でしょうか？');
  const expected=introduced?'inspection_identity_missing_after_introduction':'inspection_confirmed_identity_retry';
  assert.equal(s.run('state.transcript.at(-1).audioId'),expected);
  assert.equal(calls,mode==='off'?0:1);
  assert.equal(s.run('state.scriptStep'),0);
  assert.equal(s.run('state.analyses.some(a=>a.stepKey==="confirmed_identity"&&a.passed)'),false);
  assert.ok(fs.existsSync(new URL('../'+s.run(`audioPath('${expected}')`),import.meta.url)));
  await s.say('失礼しました。佐藤様でしょうか？');
  assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_confirmed_identity_customer');
  assert.equal(s.run('state.analyses.some(a=>a.stepKey==="confirmed_identity"&&a.passed)'),true);
 }
 const s=session(id,async()=>null);s.run('state.scriptStep=0;');
 for(const text of ['佐藤様でしょうか？','田中と申します。','山田様からのお電話です。','代車は必要ですか？'])assert.equal(s.run(`inspectionWrongNameAudio(${JSON.stringify(text)})`),null,text);
 s.run('state.scriptStep=8;');assert.equal(s.run('inspectionWrongNameAudio("田中様でしょうか？")'),null);
}
console.log('誤名: 上級/応用・名乗り前後・LLM/失敗/OFF・訂正回復・得点/進行保護 OK');
