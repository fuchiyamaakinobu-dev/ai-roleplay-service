import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const s=session('vehicle-inspection-pickup-delivery',async()=>null);s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
for(const text of ['ありがとうございます。','ロックナットを外す工具もご用意ください。それと15分前のご来店をお願いいたします。','15分ぐらい前に来ていただけるとお手続きスムーズにできますが、お願いできますか？']){await s.say(text);assert.equal(s.run('state.transcript.at(-1).text'),text==='ありがとうございます。'?'こちらこそ。':'分かりました。');}
await s.say('ありがとうございます。代わりの出したとかは必要でしょうか？');assert.equal(s.run('state.transcript.at(-1).text'),'代車を用意してもらえますか？');
for(const [text,id] of [['ご覧いただくことって可能でしたでしょうか？','inspection_confirmed_booking_time_customer'],['9月17日の。中でいいでしょうか。','inspection_recapped_appointment_customer'],['お日にち、いつもよろしかったですか？','inspection_day_preference_answer']])assert.equal(s.run('inspectionNeutralReplyForContext('+JSON.stringify(text)+')'),id);
s.run('state.inspectionPickupActive=true;state.inspectionPickupOutcome="pickup";state.inspectionPickupPhase="location";state.proposedAppointment=null;');await s.say('15分前のご来店をお願いいたします。');assert.equal(s.run('state.transcript.at(-1).text'),'今回は引き取りでお願いしたいです。');
s.run('finishRoleplay=()=>{}');await s.say('では予約の方10時で入れておきます。本日はどうもありがとうございました。');assert.equal(s.run('state.ended'),true);assert.equal(s.run('state.proposedAppointment'),null);
console.log('ランダム再試験修正: 案内・お礼返答、質問別回答、引取経路保持、未確定を維持した終話 OK');
