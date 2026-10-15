import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 for(const text of ['土日、もしくは平日。どちらがよろしいでしょうか。','平日か土日、どちらがよろしいでしょうか？','土日、または平日。どちらがいいですか？']) {
  const s=session(id,async()=>null);
  await s.say(text);
  assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_day_preference_answer',text);
  assert.equal(s.run('state.transcript.at(-1).text'),'土日がいいです。');
  assert.equal(s.run('state.proposedAppointment'),null);
 }
 const s=session(id,async()=>null);
 for(const text of ['土日か平日。連絡先はどちらがよろしいですか？','土日か平日。代車か店内待ち、どちらがよろしいですか？','9月12日土曜日、どちらがよろしいですか？']) {
  assert.equal(s.run(`asksInspectionDayPreference(inspectionLastQuestionClause(${JSON.stringify(text)}))`),false,text);
 }
}
console.log('曜日選択: 句点・読点・疑問符なし・別話題/具体日除外・登録音声 OK');
