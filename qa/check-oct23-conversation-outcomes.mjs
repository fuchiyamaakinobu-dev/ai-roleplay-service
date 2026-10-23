import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const create=()=>{const s=session('vehicle-inspection-pickup-delivery',async()=>null);s.run('state.inspectionMileageVariant="120000";state.variantSeed=0');return s;};
const s=create();
await s.say('今の走行距離は何キロですか？');
await s.say('12万キロですと一泊2日お預かりさせていただきたかったのですが、よろしいでしょうか。');
assert.equal(s.run('state.transcript.at(-1).text'),'はい。');
await s.say('もしよろしければ当社の方にご来店いただいて、お預かりさせていただいて、翌日終わりましたら取りに来ていただければと思うのですが、いかがでしょうか？');
assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_pickup_request_customer');
s.run('state.inspectionPickupPhase="location";state.inspectionPickupReason="competitor"');
for(const text of ['では札内のお店ではご来店可能でしょうか','ご来店無理ですか','できればご来店いただいて実際の車の状況を確認していただきたかったんですがいかがでしょうか']) {
 await s.say(text);assert.equal(s.run('state.transcript.at(-1).role'),'customer',text);
}
for(const text of ['じゃあ他の店紹介してもいいですか','他のお店でさしてもらっていいですか']) {
 await s.say(text);assert.equal(s.run('state.transcript.at(-1).text'),'お願いします。',text);
 assert.equal(s.run('state.proposedAppointment'),null);
}
await s.say('なので予約は無しということでお願いします');
assert.equal(s.run('state.inspectionBookingCancelled'),true);
assert.equal(s.run('state.transcript.at(-1).text'),'分かりました。');
await s.say('ありがとうございました');
assert.equal(s.run('state.transcript.at(-1).text'),'ありがとうございました。');
assert.equal(s.run('state.ended'),true);
const r=create();
r.run('state.inspectionPickupOutcome="pickup";state.inspectionPickupPhase="resolved";state.proposedAppointment={month:"9",day:"29",hour:"10",minute:0};');
const before=r.run('JSON.stringify(state.proposedAppointment)');
await r.say('翌日の17時ぐらいにお届けにできると思うんですが、いかがですか？');
assert.equal(r.run('JSON.stringify(state.proposedAppointment)'),before);
assert.match(r.run('state.pickupAudioMemory.returnSchedule.text'),/17時/);
const neg=create();await neg.say('予約はキャンセルしません');assert.equal(neg.run('state.inspectionBookingCancelled'),false);
console.log('10月23日: 来店依頼・反復質問への返答・他店紹介・取消終話・返却時刻の分離 OK');
