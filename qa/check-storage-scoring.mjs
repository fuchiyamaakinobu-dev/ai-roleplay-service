import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
const put=(role,text)=>s.run(`state.transcript.push(${JSON.stringify({role,text})})`);
put('staff','一日お預かりで車検をさせていただきますが、よろしいですか？');put('customer','はい。');
assert.equal(s.run('inspectionStorageScoringEvidence().storage'),true);
assert.equal(s.run('inspectionStorageScoringEvidence().loaner'),false);
assert.match(s.run('scoreScriptedRoleplay().improve.join(" ")'),/予定終了日/);
put('staff','代車は必要ですか？');put('customer','不要です。');
assert.equal(s.run('inspectionStorageScoringEvidence().loaner'),true);
put('staff','翌日の17時に作業が完了する予定です。');
assert.equal(s.run('inspectionStorageScoringEvidence().completion'),true);
s.run('state.inspectionPickupOutcome="pickup";state.analyses.push({scripted:true,stepKey:"explained_lock_and_arrival",notApplicable:true});');
put('staff','ロックナットを外す専用工具をご用意ください。');
assert.match(s.run('scoreScriptedRoleplay().judgements.join(" ")'),/早め|15分前来店案内: 対象外/);
assert.doesNotMatch(s.run('scoreScriptedRoleplay().improve.join(" ")'),/ロックナット/);
s.run('state.transcript=[];state.inspectionPickupOutcome=null;state.inspectionWaitingMethod="store";');
put('staff','90分で店内でお待ちいただく車検です。');put('customer','はい。');
assert.equal(s.run('inspectionStorageScoringEvidence().nonWaiting'),false);
s.run('state.inspectionPickupOutcome="pickup"');
for(const text of ['作業は17時に終わります。','明日には終わります。','翌日の終了時刻は未定です。','9月5日10時にご来店ください。作業完了後ご連絡します。']){
 s.run('state.transcript=[]');put('staff',text);assert.equal(s.run('inspectionStorageScoringEvidence().completion'),false,text);
}
console.log('預かり代車確認・不要回答・引取時の工具のみ判定・終了日時必須・待ち対象外 OK');

// Verify actual score differences, not only text detection.
s.run('scenario.scoring=[{key:"explained_loaner",points:6,label:"代車",action:"確認する"},{key:"explained_lock_and_arrival",points:94,label:"工具",action:"案内する"}];state.transcript=[];state.analyses=[{explained_loaner:true,explained_lock_and_arrival:true}];state.inspectionPickupOutcome=null;state.inspectionWaitingMethod=null;');
put('staff','一日お預かりでよろしいですか？');put('customer','はい。');
assert.equal(s.run('scoreScriptedRoleplay().score'),89,'代車6点と終了日時5点が未達');
assert.match(s.run('scoreScriptedRoleplay().improve.join(" ")'),/代車確認項目は未達/);
put('staff','翌日17時に作業が終わる予定です。');
assert.equal(s.run('scoreScriptedRoleplay().score'),94,'終了日時の案内で5点回復');
put('staff','代車は必要ですか？');put('customer','不要です。');
assert.equal(s.run('scoreScriptedRoleplay().score'),100,'不要でも代車確認を達成');
console.log('採点差分: 89 → 94 → 100 OK');
