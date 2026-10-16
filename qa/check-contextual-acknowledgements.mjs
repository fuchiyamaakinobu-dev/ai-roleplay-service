import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';
import {validSelection,validateSelection} from '../lab/selection-core.mjs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const addMessage=source.slice(source.indexOf('function addMessage('),source.indexOf('\nfunction ',source.indexOf('function addMessage(')+1));
function ackSession(id,mode){
 let calls=0;
 const s=session(id,async req=>{
  calls++;assert.ok(validSelection(req));if(mode==='failure')throw Error('network');if(mode==='rule')return {id:'rule'};
  const c=req.candidates[0],topic={inspection_ack_understood:'instruction',inspection_ack_listening:'listening',inspection_ack_consent:'consent'}[c.action];
  return validateSelection({kind:topic==='consent'?'question':topic==='instruction'?'request':'explanation',topic,evidence:req.text,id:c.id},req);
 });
 // Use the real response entry point; bypass only timers/playback, not response selection.
 s.run(addMessage);
 s.run("interactionDelayMs=()=>0;commitMessage=(role,text,options)=>{state.transcript.push({role,text,audioId:options.audioId});options.onCommitted?.();};");
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false;');
 return {...s,calls:()=>calls};
}
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery'])for(const mode of ['llm','off','failure','rule']){
 const s=ackSession(id,mode);
 await s.say('当日はトランクの荷物を降ろし、車検証と納税証明書をお持ちください。');
 assert.equal(s.run('state.transcript.at(-1).text'),'分かりました。',id+'/'+mode);
 assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_explained_lock_and_arrival_customer');
 assert.equal(s.calls(),mode==='off'?0:1);
 assert.equal(s.run('state.proposedAppointment'),null);
 const consent=ackSession(id,mode);
 consent.run("state.scriptStep=scenario.steps.findIndex(s=>s.key==='confirmed_booking_time');state.proposedAppointment={month:'8',day:'30',hour:'10',minute:0};state.inspectionPickupPhase='resolved';state.inspectionPickupOutcome='visit';");
 await consent.say('予約のお手続きをこのまま進めてもよろしいでしょうか？');
 assert.match(consent.run('state.transcript.at(-1).text'),/^(はい、)?お願いします。$/);
 // When both listening replies fit, choose an alternative rather than repeating.
 s.run("state.transcript.push({role:'staff',text:'受付内容をご案内いたします。'});addMessage('customer','はい。',{audioId:'inspection_thanked_customer_retry',immediate:true});");
 assert.equal(s.run('state.transcript.at(-1).text'),'はい。');
 s.run("state.transcript.push({role:'staff',text:'受付内容をご案内いたします。'});addMessage('customer','はい。',{audioId:'inspection_thanked_customer_retry',immediate:true});");
 assert.equal(s.run('state.transcript.at(-1).text'),'分かりました。');
 const before=s.run('state.transcript.length');
 s.run("state.transcript.push({role:'staff',text:'現在の走行距離は何キロですか？'});addMessage('customer','今、3万キロくらいです。',{audioId:'inspection_current_mileage_customer',immediate:true});");
 assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_current_mileage_customer');
 assert.equal(s.run('state.transcript.length'),before+2);
}
const s=ackSession('vehicle-inspection-pickup-delivery','llm');
for(const q of ['店内で待つか引取か、どちらですか？','代車は必要ですか？','現在の走行距離は何キロですか？','8月30日午前10時でよろしいでしょうか？','佐藤様でしょうか？','はい。','ありがとうございました。'])assert.equal(s.run(`inspectionAcknowledgementCandidates(${JSON.stringify(q)}).length`),0,q);
const input={text:'荷物を降ろしてください。',candidates:[{id:'ack',action:'inspection_ack_understood'}]};
assert.equal(validateSelection({kind:'question',topic:'instruction',id:'ack',evidence:input.text},input).id,'rule');
assert.equal(validateSelection({kind:'request',topic:'instruction',id:'ack',evidence:input.text},input).id,'ack');
console.log('相づち: 上級/応用・LLM/OFF/失敗/保留・荷物案内/理解・同文反復回避・具体的回答/二択/予約保護 OK');
