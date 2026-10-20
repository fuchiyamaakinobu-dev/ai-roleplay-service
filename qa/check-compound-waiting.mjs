import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validateSelection} from '../lab/selection-core.mjs';
const text='90分で終わりますがよろしいでしょうか？お待ちになりますか？';
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery'])for(const mode of ['llm','rule','off','failure']){
const s=session(id,async req=>{if(mode==='failure')throw Error('offline');return mode==='rule'?{id:'rule'}:validateSelection({kind:'question',topic:'waiting',evidence:req.text,id:'inspection_duration_accepted_wait_in_store'},req)});
if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
s.run("state.inspectionPickupOutcome='visit';state.inspectionPickupPhase='resolved';state.inspectionMileageVariant='30000';");
s.run("state.inspectionMileageAsked=true;");
await s.say(text);
assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_duration_accepted_wait_in_store',id+'/'+mode);
assert.equal(s.run('state.inspectionWaitingMethod'),'store');
assert.equal(s.run('inspectionConversationMetricAchieved("confirmed_waiting")'),true);
assert.equal(s.run('state.proposedAppointment'),null);
assert.equal(s.run('inspectionConversationMetricAchieved("explained_duration_and_wait")'),true);
s.run("state.transcript=state.transcript.filter(m=>m.role!=='staff');");
assert.equal(s.run('inspectionConversationMetricAchieved("confirmed_waiting")'),false,'AI reply alone must not score');
assert.equal(s.run('inspectionConversationMetricAchieved("explained_duration_and_wait")'),false);
for(const flag of ["state.inspectionLoanerRequested=true","state.inspectionMileageVariant='over60000'","state.inspectionPickupOutcome='pickup'"]){
const t=session(id,async()=>null);t.run("state.inspectionPickupOutcome='visit';state.inspectionPickupPhase='resolved';");t.run(flag);
assert.equal(t.run(`inspectionStoreWaitingCandidate(${JSON.stringify(text)})`),null,flag);
}
const q=session(id,async()=>null);q.run("state.inspectionPickupOutcome='visit';state.inspectionPickupPhase='resolved';");
for(const t of ['90分で終わります。お待ちになりますか？他に気になるところはありますか？','120分で終わります。お待ちになりますか？','お待ちになりますか？'])assert.equal(q.run(`inspectionStoreWaitingCandidate(${JSON.stringify(t)})`),null,t);
}
console.log('複合待機確認: 上級/応用×LLM/保留/OFF/失敗・合意保持・スタッフだけ採点・引取/代車/多走行/最後の質問保護 OK');
