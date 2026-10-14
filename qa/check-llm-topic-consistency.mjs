import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
let checks=0;
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 const s=session(id,async()=>null);
 s.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="location";state.inspectionPickupReason="work";');
 const cases=[
 ['荷物を降ろしておいていただけますか？',[]],
 ['現在の走行距離は何キロですか？',['inspection_mileage']],
 ['お車の調子はいかがですか？',['inspection_work']],
 ['連絡先はこの携帯でよろしいですか？',['inspection_contact']],
 ['引取場所はどちらですか？',id.includes('pickup')?['inspection_location']:[]],
 ['お持ち込みが難しい理由を教えていただけますか？',id.includes('pickup')?['inspection_reason']:[]],
 ['荷物を降ろしてご来店ください。',[]],
 ];
 for(const [text,expected] of cases) {
  assert.deepEqual(JSON.parse(s.run(`JSON.stringify(inspectionLlmCandidates(${JSON.stringify(text)}).map(c=>c.action))`)),expected,text);
  checks++;
 }
 for(const text of ['荷物を降ろしておいていただけますか？','現在の走行距離は何キロですか？']) {
  assert.equal(s.run(`applyInspectionLlmSelection(${JSON.stringify(text)},{id:'inspection_confirmed_reminder_contact_customer'})`),false);
  checks++;
 }
}
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
s.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="location";state.pickupAudioMemory={location:"workplace",settings:{location:"workplace"}};');
assert.equal(s.run('inspectionLlmCandidates("引取場所はどちらですか？").find(c=>c.action==="inspection_location").id'),'inspection_pickup_workplace_request');
assert.equal(s.run('applyInspectionLlmSelection("引取場所はどちらですか？",{id:"inspection_pickup_location_customer"})'),false);
assert.equal(s.run('applyInspectionLlmSelection("引取場所はどちらですか？",{id:"inspection_pickup_workplace_request"})'),true);
assert.match(s.run('state.transcript.at(-1).text'),/職場/);
console.log(`話題整合性: ${checks+4} assertions OK`);
