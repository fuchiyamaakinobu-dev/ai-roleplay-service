import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validSelection,validateSelection} from '../lab/selection-core.mjs';
const questions=['店内でお待ちになりますか、それとも引取りをご希望でしょうか？','店舗で待つ方法と引取、どちらがよろしいでしょうか？','引き取りか、店内でお待ちになるか、どちらをご希望ですか？'];
for(const distance of ['30000','over60000','120000'])for(const mode of ['llm','off','failure','cooldown','rule'])for(const question of questions){
 let calls=0;
 const s=session('vehicle-inspection-pickup-delivery',async req=>{calls++;assert.ok(validSelection(req));if(mode==='failure')throw new Error('Simulated network failure');if(mode==='cooldown')return null;if(mode==='rule')return {id:'rule'};return validateSelection({id:req.candidates[0].id,kind:'question',topic:'waiting',evidence:req.text},req);});
 s.run(`state.inspectionMileageVariant=${JSON.stringify(distance)};state.inspectionMileageAsked=true;state.inspectionDurationQuestionAsked=true;`);
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false;');
 await s.say(question);
 assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_pickup_request_customer',`${distance}/${mode}/${question}`);
 assert.equal(s.run('state.inspectionPickupPhase'),'reason');
 assert.equal(s.run('state.proposedAppointment'),null);
 assert.equal(calls,mode==='off'?0:1);
 const step=s.run('state.scriptStep');
 await s.say(question);
 assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_pickup_still_requested','Confirm an existing request instead of repeating the initial request');
 assert.equal(s.run('state.inspectionPickupPhase'),'reason');
 assert.equal(s.run('state.scriptStep'),step);
}
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
// The screenshot's path starts with an earlier pickup request, before the choice question.
s.run("state.inspectionPickupActive=true;state.inspectionPickupPhase='proposal';state.inspectionPickupReason='distance';state.transcript.push({role:'customer',text:'できれば、車を取りに来てもらえませんか？',audioId:'inspection_pickup_request_customer'});");
await s.say(questions[0]);
assert.equal(s.run('state.transcript.at(-1).text'),'今回は引き取りでお願いしたいです。');
assert.equal(s.run('state.inspectionPickupPhase'),'proposal');
assert.equal(s.run('state.inspectionPickupReason'),'distance');
s.run('state.inspectionPickupActive=false;state.inspectionPickupPhase=null;');
for(const text of ['店内で待つか引取か、どちらがよろしいですか？連絡先を教えていただけますか？','店内でお待ちください。引取はできません。','店内でお待ちになりますか？'])assert.equal(s.run(`isInspectionPickupChoiceQuestion(${JSON.stringify(text)})`),false,text);
s.run('state.inspectionPickupOutcome="visit";');assert.equal(s.run(`isInspectionPickupChoiceQuestion(${JSON.stringify(questions[0])})`),false);
const upper=session('vehicle-inspection-phone-followup',async()=>null);
assert.equal(upper.run(`isInspectionPickupChoiceQuestion(${JSON.stringify(questions[0])})`),false);
console.log('店内/引取の二択: 3距離×LLM/OFF/失敗/制限/保留×3表現・再質問・他話題/確定済み保護 OK');
