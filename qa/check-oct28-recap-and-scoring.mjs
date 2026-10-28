import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
s.run(`window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false;state.proposedAppointment={month:'9',day:'30',hour:'10',minute:0,period:''};state.inspectionPickupOutcome='visit';state.inspectionPickupPhase='resolved';state.scriptStep=scenario.steps.length-1;`);
for(const text of ['では最終確認です佐藤様のヤリス9月の30日10時ご来店で車検の方させていただきますのでよろしくお願いします','ありがとうございますでは最終確認です佐藤様ヤリス9月の30日10時にご来店で車検の方受け付けさせていただきますのでよろしくお願いいたします']){
 await s.say(text);assert.equal(s.run('state.transcript.at(-1).text'),'お願いします。');assert.equal(s.run('inspectionConversationMetricAchieved("recapped_appointment")'),true);assert.equal(s.run('lastInspectionRecapDateMismatch()'),false);
}
await s.say('最終確認です佐藤様9月29日10時ご来店で車検させていただきますのでよろしくお願いします');assert.equal(s.run('state.transcript.at(-1).text'),'お願いします。');assert.equal(s.run('lastInspectionRecapDateMismatch()'),true);assert.equal(s.run('state.proposedAppointment.day'),'30');
assert.equal(s.run('asksInspectionLoanerNeed("9月30日朝10時に本店にご来店いただいて代車に乗っていただくっていうのは可能でしょうか")'),true);
s.run(`state.transcript=[{role:'staff',text:'9月30日10時ご来店でお車をお預かりさせていただいて翌日10月1日の17時にお引き渡しでよろしいでしょうか'},{role:'customer',text:'大丈夫ですよ。'}]`);assert.equal(s.run('inspectionStorageScoringEvidence().completion'),true);
assert.equal(s.run('inspectionNeutralReplyForContext("9月30日朝10時にお車をお預かりさせていただく形でご来店いただければと思います")'),'inspection_explained_lock_and_arrival_customer');
console.log('10/28実発話: 最終確認2表現の返答と達成・誤日付保持・代車利用質問・翌日引渡時刻・預かり了承 OK');
