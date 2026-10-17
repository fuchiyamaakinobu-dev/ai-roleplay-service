import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const realAdd=source.slice(source.indexOf('function addMessage('),source.indexOf('\nfunction ',source.indexOf('function addMessage(')+1));
for(const mode of ['llm','off','failure','rule']) {
 const s=session('vehicle-inspection-pickup-delivery',async req=>{if(mode==='failure')throw Error('offline');return mode==='rule'?{id:'rule'}:{id:req.candidates[0].id};});
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
 s.run(realAdd);s.run("interactionDelayMs=()=>0;commitMessage=(role,text,options)=>state.transcript.push({role,text,audioId:options.audioId});");
 for(const text of ['じゃあよそで入れてください','車お願いしたくないんですけど']) {
  await s.say(text);assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_asked_availability_retry');
 }
 for(const reason of ['driving','distance','work','misunderstanding','competitor']) {
  s.run(`state.inspectionPickupActive=true;state.inspectionPickupPhase='location';state.inspectionPickupReason='${reason}';state.inspectionPickupOutcome='pickup';state.questionRepeats={};`);
  await s.say('来店いただくのは難しいですか');
  assert.equal(s.run('state.inspectionPickupOutcome'),'pickup',reason+'/'+mode);
  assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_pickup_still_requested');
 }
 s.run("state.inspectionPickupActive=true;state.inspectionPickupPhase='location';state.inspectionPickupReason='driving';state.variantSeed=1;");
 await s.say('聞き取りですか？かしこまりました。あの。ご家族の方と一緒に来ていただくのも難しいですか？');
 assert.equal(s.run('state.inspectionPickupOutcome'),'visit',mode);
 assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_pickup_visit_agreement');
}
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
const combined='かしこまりましたでは9月の30日朝10時位にお越しいただいて代車に乗っていただいて翌日の4時半ぐらいにお越しいただいてお引き渡しと言う形でよろしいでしょうか';
assert.equal(s.run(`inspectionAppointmentProposalMatch(${JSON.stringify(combined)}).hour`),'10');
s.run("state.proposedAppointment={month:'9',day:'30',hour:'10',minute:0,period:''};state.inspectionPickupPhase='resolved';state.inspectionPickupOutcome='visit';state.scriptStep=scenario.steps.findIndex(x=>x.key==='recapped_appointment');");
await s.say('1泊2日お預かりさせていただいて翌日10月の1日の16時にご来店いただいてお引き渡しと言う形でよろしいでしょうか');
assert.equal(s.run('state.proposedAppointment.month'),'9');
assert.equal(s.run('state.proposedAppointment.day'),'30');
assert.equal(s.run('lastInspectionRecapDateMismatch()'),false);
await s.say('佐藤様、最終確認です9月の30日朝10時ご来店で車検の予約です');
assert.equal(s.run('lastInspectionRecapDateMismatch()'),false);
await s.say('佐藤様、最終確認です9月の30日朝11時ご来店で車検の予約です');
assert.equal(s.run('lastInspectionRecapDateMismatch()'),true);
console.log('10/17: 不適切相づち・来店強制転換・家族同伴・入庫返却日時分離 OK');


