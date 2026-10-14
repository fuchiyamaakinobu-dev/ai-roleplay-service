import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {session} from './check-inspection-llm-selection.mjs';
const prefix='inspection_';
const hashes=JSON.parse(fs.readFileSync(new URL('./pickup-nine-audio-hashes.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
function setup(settings={}) {
 const s=session('vehicle-inspection-pickup-delivery',async()=>null);
 s.run(`window.ROLEPLAY_INTENT_ASSIST.pickupSettings=()=>(${JSON.stringify({schedule:'accept',waiting:'store',location:'home',...settings})})`);
 return s;
}
function choose(s,text,suffix){
 const id=prefix+suffix;
 const candidates=JSON.parse(s.run(`JSON.stringify(inspectionLlmCandidates(${JSON.stringify(text)}))`));
 assert.ok(candidates.some(c=>c.id===id),id+' missing');
 assert.equal(s.run(`applyInspectionLlmSelection(${JSON.stringify(text)},{id:${JSON.stringify(id)}})`),true);
 assert.equal(s.run('state.transcript.at(-1).audioId'),id);
 const dest=s.run(`audioPath(${JSON.stringify(id)})`);
 const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 assert.equal(hash(new URL('../'+dest,import.meta.url)),hashes[id]);
}
const condition=setup(); choose(condition,'お車の調子はいかがですか？','vehicle_condition_no_concerns');
condition.run('state.transcript.push({role:"customer",text:"オイル交換もお願いします。"})');
choose(condition,'オイル交換も実施してよろしいでしょうか？','oil_change_reconfirmed');
const pickup=setup();pickup.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="reason"');
choose(pickup,'店内でお待ちいただけますか？','cannot_wait_pickup_request');
assert.equal(pickup.run('pickupExtraCandidates("店内でお待ちいただけますか？").some(c=>c.id.includes("accepted_wait"))'),false);
const wait=setup();wait.run('state.inspectionPickupOutcome="visit";state.transcript.push({role:"staff",text:"作業時間は90分です。"})');
choose(wait,'店内でお待ちいただけますか？','duration_accepted_wait_in_store');
const family=setup({waiting:'family'});family.run('state.inspectionPickupOutcome="visit"');
choose(family,'代車は必要でしょうか？','no_loaner_family_pickup');
assert.equal(family.run('handlePickupAudioMemory("店内でお待ちいただけますか？")'),true);
assert.equal(family.run('state.inspectionWaitingMethod'),'family');
const work=setup({location:'workplace'});work.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="location"');
choose(work,'引取場所はどちらですか？','pickup_workplace_request');
assert.equal(work.run('state.pickupAudioMemory.location'),'workplace');
work.run('state.inspectionPickupPhase="resolved";state.inspectionPickupActive=false');
choose(work,'返却はどちらにお届けしますか？','delivery_home_request');
assert.equal(work.run('state.pickupAudioMemory.location'),'workplace');assert.equal(work.run('state.pickupAudioMemory.delivery'),'home');
for(const [mode,suffix] of [['other_date','appointment_other_date_request'],['later_time','appointment_later_time_request']]){
 const s=setup({schedule:mode}); choose(s,'9月1日の9時半はいかがでしょうか？',suffix);
 assert.equal(s.run('state.proposedAppointment'),null);assert.equal(s.run('state.inspectionAppointmentCandidate'),null);
 assert.equal(s.run('handlePickupAudioMemory("9月1日の9時半はいかがでしょうか？")'),true);
 const next=mode==='other_date'?'9月2日の9時半はいかがでしょうか？':'9月1日の10時はいかがでしょうか？';
 assert.equal(s.run(`handlePickupAudioMemory(${JSON.stringify(next)})`),false);
 assert.equal(s.run('state.pickupAudioMemory.adjusted'),true);
 assert.ok(!s.run(`pickupExtraCandidates(${JSON.stringify(next)}).length`));
}
const upper=session('vehicle-inspection-phone-followup',async()=>null);assert.equal(upper.run('pickupExtraCandidates("お車の調子はいかがですか？").length'),0);
console.log('応用追加9音声: 全ID到達・MP3同一性・希望保持・日程再調整・上級隔離 OK');

