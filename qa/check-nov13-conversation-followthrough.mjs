import fs from 'node:fs';import assert from 'node:assert/strict';import {session} from './check-inspection-llm-selection.mjs';import {validateSelection,validSelection} from '../lab/selection-core.mjs';
const source=fs.readFileSync('app.js','utf8');
const lines=[...fs.readFileSync('model-answer-120000.html','utf8').matchAll(/<div class="line staff"><strong>スタッフ<\/strong><p>(.*?)<\/p>/g)].map(m=>m[1]);
let count=0;const replays=[];
for(const mode of ['off','hold','error','llm']){
 let s;s=session('vehicle-inspection-pickup-delivery',async req=>{
  assert.ok(validSelection(req));if(mode==='error')throw Error('offline');if(mode!=='llm')return {id:'rule'};
  const target=s.run(`inspectionLastQuestionClause(${JSON.stringify(req.text)})`);
  const focus=s.run(`inspectionFocusedCandidates(${JSON.stringify(req.text)})`);
  let candidate=focus?.[0]|| (req.candidates.length===1?req.candidates[0]:null);
  if(!candidate)return {id:'rule'};
  const topics={inspection_identity:'identity',inspection_call_permission:'consent',inspection_booking_intent:'booking_intent',inspection_mileage:'mileage',inspection_work:'work',inspection_extra:'work',inspection_weekday:'weekday',inspection_contact:'contact',inspection_pickup_choice:'waiting',inspection_ack_consent:'consent',inspection_return_confirmation:'return_confirmation'};
  if(!topics[candidate.action])return {id:'rule'};
  return validateSelection({id:candidate.id,kind:'question',topic:topics[candidate.action],evidence:target,answerTarget:target,conditions:[]},req);
 });
 s.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
 s.run("state.scriptStep=0;state.inspectionMileageVariant='120000';state.variantSeed=6;continueSpeechInputWithoutCustomerReply=()=>{};renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;");
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
 const rows=[];
 for(let i=0;i<lines.length;i++){
  await s.say(lines[i]);const m=s.run('state.transcript.at(-1)');
  assert.equal(m.role,'customer',mode+' turn '+i+' must answer');assert.ok(m.audioId);assert.ok(!m.emergencyAudio,mode+' '+i);count++;
  rows.push({staff:lines[i],customer:m.text,audioId:m.audioId});
  const expected={2:'inspection_asked_availability_customer',3:'inspection_current_mileage_120000_customer',4:'inspection_asked_vehicle_concerns_customer',6:'inspection_confirmed_booking_time_customer',12:'inspection_nearby_store_question_customer',13:'inspection_pickup_still_requested',15:'inspection_confirmed_booking_time_customer',16:'inspection_day_preference_answer',23:'inspection_confirmed_booking_time_customer',24:'inspection_confirmed_reminder_contact_customer'};
  if(expected[i]){assert.equal(m.audioId,expected[i],mode+' '+i);count++;}
  if(i===12){assert.equal(s.run('state.inspectionPickupActive'),true);assert.notEqual(s.run('state.inspectionPickupOutcome'),'visit');assert.match(s.run('inspectionUnansweredQuestions().map(q=>q.key).join()'),/store/);count++;}
  if(i===13){assert.doesNotMatch(s.run('inspectionUnansweredQuestions().map(q=>q.key).join()'),/store/);count++;}
  if(i>=18){assert.equal(s.run('state.proposedAppointment.hour'),'9');assert.equal(s.run('state.proposedAppointment.day'),'21');count++;}
 }
 replays.push({mode,rows});
}
// Nearby-store selection may lead to a visit, but only after a named store reply.
for(const seed of [1,6]){
 const s=session('vehicle-inspection-pickup-delivery',async()=>null);
 s.run(`state.variantSeed=${seed};state.inspectionPickupActive=true;state.inspectionPickupPhase='proposal';state.inspectionPickupReason='distance';`);
 await s.say(lines[12]);assert.equal(s.run('state.inspectionPickupActive'),true);
 await s.say(lines[13]);assert.equal(s.run('state.inspectionPickupOutcome'),seed===1?'visit':'pickup');count++;
 const later=lines[12]+'現在の走行距離は何キロですか？';
 assert.equal(s.run(`inspectionNearbyStoreCandidate(${JSON.stringify(later)})`),null);count++;
}
const repeated=session('vehicle-inspection-pickup-delivery',async()=>null);
repeated.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
repeated.run("state.inspectionPickupActive=true;state.inspectionPickupReason='distance';state.inspectionPickupPhase='proposal';renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;");
await repeated.say(lines[12]);await repeated.say(lines[12]);
assert.equal(repeated.run("state.transcript.filter(m=>m.audioId==='inspection_nearby_store_question_customer').length"),1);
assert.match(repeated.run('inspectionUnansweredQuestions().map(q=>q.key).join()'),/store/);count+=2;
fs.writeFileSync('tmp/nov13-conversation-replays.json' ,JSON.stringify(replays,null,2));
console.log(`会話継続 ${count} 条件 OK（模擬LLM/保留/OFF/通信失敗、本番音声確定処理）`);
