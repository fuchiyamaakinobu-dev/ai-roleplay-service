import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
for (const mode of ['hold','off','error']) {
  const s=session('vehicle-inspection-pickup-delivery',async()=>{if(mode==='error')throw Error('offline');return null;});
  if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
  s.run('state.inspectionMileageVariant="over60000"');
  await s.say('現在の走行距離などわかりますでしょうか？');
  assert.match(s.run('state.transcript.at(-1).text'),/6万/);
  s.run('state.inspectionPickupActive=true;state.inspectionPickupOutcome="pickup";state.inspectionPickupPhase="location"');
  await s.say('引き取りでさせていただきますね。9月17日10時に。お車をお預かりに行ってもよろしいでしょうか。');
  assert.equal(s.run('state.proposedAppointment'),null,'場所未確認では確定しない');
  assert.equal(s.run('state.inspectionAppointmentCandidate.pickupAccepted'),true);
  await s.say('一日で終わると思いますので、16時半ぐらいには届けられるかと思います。');
  assert.equal(s.run('inspectionStorageScoringEvidence().completion'),true);
  await s.say('引き続き車検の件でご説明がありますので、このままお電話よろしいでしょうか？');
  assert.equal(s.run('state.transcript.at(-1).text'),'大丈夫ですよ。');
  assert.equal(s.run('inspectionConversationMetricAchieved("confirmed_booking_time")'),true);
  await s.say('17日10時に私の方がご自宅の方にお伺いしますので、よろしくお願いします。');
  assert.equal(s.run('state.proposedAppointment.month'),'9');
  assert.equal(s.run('state.proposedAppointment.day'),'17');
  assert.equal(s.run('state.proposedAppointment.hour'),'10');
  assert.equal(s.run('state.pickupAudioMemory.location'),'home');
  assert.equal(s.run('state.inspectionPickupActive'),false);
  assert.doesNotMatch(s.run('scoreScriptedRoleplay().improve.join(" ")'),/最低条件未達|予定終了日|予約手続きを続ける/);
}
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
for(const text of ['一日で終わり16時半には届けられます。','16時半に届けられます。','終了日は未定ですが16時半に届けられます。']) {
  s.run(`state.transcript=[{role:'staff',text:${JSON.stringify(text)}}]`);
  assert.equal(s.run('inspectionStorageScoringEvidence().completion'),false,'日付根拠なし: '+text);
}
assert.equal(s.run('hasExplicitBookingContinuationConfirmation("今お電話よろしいでしょうか？")'),false);
s.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="location"');
assert.equal(s.run('recordInspectionPickupCommitment("9月17日10時または11時にご自宅に伺います。")'),false);
assert.equal(s.run('state.proposedAppointment'),null);
console.log('予約了承・場所の後出し・月省略・通話継続採点・終了予定・未確定保護 OK');
