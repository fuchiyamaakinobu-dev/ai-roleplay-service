import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';
const options={audioId:'inspection_appointment_time_missing_retry'};
for(const next of ['8月21日はいかがでしょうか？','では21日はいかがでしょうか？','8月21日に予約を変更します。']) {
 const s=session('vehicle-inspection-pickup-delivery',async()=>null);
 const put=(role,text)=>s.run(`state.transcript.push(${JSON.stringify({role,text})})`);
 put('staff','8月30日はいかがでしょうか？');put('customer','何時が空いていますか？');put('staff','10時はいかがでしょうか？');
 put('staff',next);
 assert.equal(s.run(`inspectionRepeatedQuestionReply('何時が空いていますか？',${JSON.stringify(options)}).text`),'何時が空いていますか？');
 put('customer','何時が空いていますか？');put('staff','当日16時半にはお返しします。');
 assert.ok(s.run('inspectionUnansweredQuestions().some(q=>q.key==="time")'));
 assert.equal(s.run(`inspectionRepeatedQuestionReply('何時が空いていますか？',${JSON.stringify(options)}).text`),'ええ。');
 put('staff','受付は午前9時でお願いします。');
 assert.equal(s.run('inspectionUnansweredQuestions().some(q=>q.key==="time")'),false);
}
for(const mode of ['hold','off','error'])for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 const s=session(id,async()=>{if(mode==='error')throw Error('offline');return null;});
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
 await s.say('お好きな時間でお取りできますが、ご都合いかがでしょうか。');
 assert.equal(s.run('state.transcript.at(-1).text'),'午前中でお願いします。');
 assert.ok(fs.existsSync(new URL('../'+s.run('audioPath(state.transcript.at(-1).audioId)'),import.meta.url)));
 assert.equal(s.run('inspectionEmergencyAudio(state.transcript.at(-1).text,state.transcript.at(-1).audioId)'),null);
 s.run('audioIndex.get("inspection_preferred_morning_customer").status="needed"');
 const actual=s.run('inspectionEmergencyAudio(state.transcript.at(-1).text,state.transcript.at(-1).audioId)');
 assert.equal(actual.text,'はい。');assert.equal(actual.emergencyAudio.intendedText,'午前中でお願いします。');
}
console.log('日付別の未回答採点・月省略・説明形の変更・返却時刻除外・2シナリオ3経路・音声不足 OK');
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
await s.say('午後のお好きな時間でお取りできますが、ご都合いかがでしょうか？');
assert.equal(s.run('state.transcript.at(-1).text'),'午後でお願いします。');
assert.ok(fs.existsSync(new URL('../'+s.run('audioPath(state.transcript.at(-1).audioId)'),import.meta.url)));
assert.equal(s.run('inspectionEmergencyAudio(state.transcript.at(-1).text,state.transcript.at(-1).audioId)'),null);
s.run('audioIndex.get("inspection_preferred_afternoon_customer").status="needed"');
assert.equal(s.run('inspectionEmergencyAudio(state.transcript.at(-1).text,state.transcript.at(-1).audioId).emergencyAudio.intendedAudioId'),'inspection_preferred_afternoon_customer');
assert.equal(s.run('answerInspectionTimePreference("お好きな時間で予約できます。現在の走行距離は何キロですか？")'),false);
assert.equal(s.run('answerInspectionTimePreference("お好きな時間で予約できます。代車は必要ですか？")'),false);
assert.equal(s.run('answerInspectionTimePreference("お好きな時間ですが、10時はいかがでしょうか？")'),false);
// Restore the registered recording after explicitly testing the unavailable state.
s.run('audioIndex.get("inspection_preferred_afternoon_customer").status="ready"');
assert.equal(s.run('inspectionEmergencyAudio("午後でお願いします。","inspection_preferred_afternoon_customer")'),null);
console.log('午後限定・後半質問優先・具体時刻保護・収録後の通常再生経路 OK');
