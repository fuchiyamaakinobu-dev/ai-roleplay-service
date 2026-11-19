import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';

const reason='ええ、お引き取りご希望ですね。ええ。ご来店が難しいご事情を伺ってもよろしいでしょうか。';
const benefit='平日はお仕事でお使いでいらっしゃいますもんね。ご来店いただければ、点検結果を実際のお車を見ながらご説明えできて、気になる点もその場でご相談できるかと思いますが、いかがでしょう。';
const s=session('service-12month-visit-promotion',async()=>null);
const source=fs.readFileSync('app.js','utf8');
const analyze=text=>s.run(`analyzeStaff(${JSON.stringify(text)})`);
assert.equal(analyze(reason).refused_pickup,false);
assert.equal(analyze(reason).asked_reason,true);
assert.equal(analyze(reason.replaceAll('。','')).refused_pickup,false);
assert.equal(analyze(benefit).explained_visit_benefit,true);
for(const text of ['引き取りはできません。','取りに伺うことは難しいです。','ご来店が難しいのですね。引取には対応できません。']) {
  assert.equal(analyze(text).refused_pickup,true,text);
}
for(const text of ['ご来店でも直接説明できません。','お車を見ながら説明できるか分かりません。','ご来店なら直接相談できるとは限りません。']) {
  assert.equal(analyze(text).explained_visit_benefit,false,text);
}
for(const mode of ['off','held','error']) {
  const r=session('service-12month-visit-promotion',async()=>{if(mode==='error') throw Error('offline');return null;});
  r.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
  r.run('renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;');
  r.run("state.currentState='PICKUP_REQUEST';state.pickupRequested=true;state.variantSeed=0;");
  if(mode==='off') r.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
  await r.say(reason);
  assert.notEqual(r.run('state.transcript.at(-1).text'),'おっしゃっていることがよく分からないんですけど。');
  assert.ok(r.run('state.pickupReason || state.currentObjection'));
  assert.ok(fs.existsSync(r.run('audioPath(state.transcript.at(-1).audioId)')));
}

const v=session('vehicle-inspection-pickup-delivery',async()=>null);
const proposal='かしこまりましたでは9月の17日朝10時からの作業で翌日の16時半にお渡しする予定でいかがでしょうか';
const match=v.run(`inspectionAppointmentProposalMatch(${JSON.stringify(proposal)})`);
assert.equal(match.month,'9');assert.equal(match.day,'17');assert.equal(match.hour,'10');
assert.equal(v.run(`hasCompleteInspectionAppointmentProposal(${JSON.stringify(proposal)})`),true);
assert.equal(v.run("inspectionAppointmentProposalMatch('9月17日10時または16時半はいかがでしょうか')"),null);
assert.equal(v.run("inspectionAppointmentProposalMatch('翌日の16時半にお渡しします')"),null);
v.run("state.inspectionPickupOutcome='pickup';state.transcript=[{role:'staff',text:'8月の20日朝10時に引き取りでもよろしいですか。'}]");
const end='その日の4時半、16時半に作業終わると思いますので、終わり次第お届けに上がります。';
v.run(`state.transcript.push({role:'staff',text:${JSON.stringify(end)}})`);
assert.equal(v.run('inspectionStorageScoringEvidence().completion'),true);
v.run('state.transcript.shift()');
assert.equal(v.run('inspectionStorageScoringEvidence().completion'),false,'その日 requires a concrete preceding appointment');
for(const text of ['その日の16時半に終了するかは未定です。','その日に作業が終わります。']) {
  v.run(`state.transcript=[{role:'staff',text:'8月20日10時に引き取りに伺います。'},{role:'staff',text:${JSON.stringify(text)}}]`);
  assert.equal(v.run('inspectionStorageScoringEvidence().completion'),false,text);
}
v.run(`state.transcript=[{role:'staff',text:${JSON.stringify(proposal)}}]`);
assert.equal(v.run('inspectionStorageScoringEvidence().completion'),true);
for(const mode of ['off','held','error']) {
  const flow=session('vehicle-inspection-pickup-delivery',async()=>{if(mode==='error') throw Error('offline');return null;});
  flow.run('state.scriptStep=0;state.variantSeed=0;state.inspectionMileageVariant="120000"');
  if(mode==='off') flow.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
  for(const text of [
    '佐藤様のお宅でしょうか',
    'トヨタモビリティ帯広本別店の寺谷と申します。日頃お世話になっております。',
    '9月30日に車検満了日を迎えるのですが、ご都合はいかがでしょうか',
    '8月1日以降で作業可能ですが、走行距離は何キロですか',
    '12万キロですと一泊お預かりできればと思いますが、乗っていて気になるところはございますか',
    '追加整備でオイル交換はいかがですか',proposal
  ]) await flow.say(text);
  assert.equal(flow.run('state.transcript.at(-1).text'),'では、その時間でお願いします。');
  assert.equal(flow.run('state.inspectionAppointmentCandidate.hour'),'10');
  assert.ok(fs.existsSync(flow.run('audioPath(state.transcript.at(-1).audioId)')));
}
console.log('11月19日: 理由確認・拒否の区別、メリット採点、入庫/返却日時、終了日時の文脈 OK');
