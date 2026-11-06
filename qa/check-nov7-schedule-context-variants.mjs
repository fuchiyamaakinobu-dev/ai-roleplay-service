import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const src=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function realSession(id,mode) {
 const s=session(id,async()=>{if(mode==='error')throw Error('offline');return null});
 s.run(src.slice(src.indexOf('function addMessage('),src.indexOf('function renderConversation(')));
 s.run('renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;var played=[];playAudio=src=>played.push(src);els.audioEnabled.checked=true;');
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
 return s;
}
const cases=[
 ['では21日はいかがでしょうか？','何時が空いていますか？',null],
 ['午後しか空いていません。お好きな時間でお取りできますが、いかがでしょうか？','午後でお願いします。',null],
 ['午前中は予約が埋まっています。午後のご都合はいかがでしょうか？','午後でお願いします。',null],
 ['午後は空いていませんが、午前中のお好きな時間ではいかがでしょうか？','午前中でお願いします。',null],
 ['午前10時にご来店ください。終了は午後4時の予定です。','では、その時間でお願いします。',10],
 ['10時は空いていません。11時はいかがでしょうか？','では、その時間でお願いします。',11],
 ['10時しか空いていませんが、いかがでしょうか？','では、その時間でお願いします。',10]
];
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery'])for(const mode of ['hold','off','error']) {
 for(const [staff,expected,hour] of cases) {
  const s=realSession(id,mode);
  await s.say('8月30日はいかがでしょうか？');await s.say(staff);
  const actual=s.run('state.transcript.at(-1)');
  assert.equal(actual.text,expected,id+' '+mode+' '+staff);
  assert.equal(actual.emergencyAudio,undefined);
  assert.equal(s.run('played.at(-1)'),actual.audioSrc);
  assert.ok(fs.existsSync(new URL('../'+actual.audioSrc,import.meta.url)));
  if(hour) {
   assert.equal(Number(s.run('state.inspectionAppointmentCandidate.hour')),hour);
   assert.equal(Number(s.run('state.inspectionAppointmentCandidate.day')),30);
   assert.equal(s.run('inspectionUnansweredQuestions().some(q=>q.key==="time")'),false);
  }
 }
 const s=realSession(id,mode);
 await s.say('8月30日はいかがでしょうか？');await s.say('午前10時はいかがでしょうか？');
 await s.say('では21日はいかがでしょうか？');
 assert.equal(s.run('state.inspectionAppointmentCandidate'),null,'旧日付の時刻を新日付に流用しない');
 assert.equal(s.run('state.scriptedPartialReplies.inspectionPickupDate.text'),'8月21日');
 await s.say('午前11時はいかがでしょうか？');
 assert.equal(Number(s.run('state.inspectionAppointmentCandidate.day')),21);
 assert.equal(Number(s.run('state.inspectionAppointmentCandidate.hour')),11);
 for(const text of ['お好きな時間で予約できます。走行距離は何キロですか？','午前中に空きがあります。代車は必要でしょうか？','午前のお好きな時間で予約できます。佐藤様ですか？','午前のお好きな時間で予約できます。今お電話よろしいでしょうか？']) {
  assert.equal(s.run(`answerInspectionTimePreference(${JSON.stringify(text)})`),false);
 }
 for(const text of ['8月21日は空いています。佐藤様ですか？','8月21日は空いています。今お電話よろしいでしょうか？','8月21日は空いています。代車は必要でしょうか？']) {
  assert.equal(s.run(`answerInspectionPartialAppointment(${JSON.stringify(text)})`),false,text);
 }
 assert.equal(s.run('answerInspectionTimePreference("午前は空いていません。午後も空いていませんが、お好きな時間はいかがでしょうか？")'),false);
 s.run('state.inspectionPickupPhase="resolved"');
 assert.equal(s.run('answerInspectionPartialAppointment("22日はいかがでしょうか？")'),false);
 s.run('state.inspectionPickupPhase="";state.inspectionPickupActive=true');
 assert.equal(s.run('answerInspectionPartialAppointment("22日はいかがでしょうか？")'),false);
}
console.log('42会話変種・6日付変更シーケンス: 本番返答確定/再生呼出/既存MP3/未回答採点/旧時刻破棄 OK');
