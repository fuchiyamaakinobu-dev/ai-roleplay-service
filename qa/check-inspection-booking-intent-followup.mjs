import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 for(const enabled of [true,false]) {
  for(const text of ['当社へご入庫いただけますでしょうか？','ぜひご入庫いただけないかと思いまして、お電話させていただきました。','当店で車検をお願いしてもよろしいでしょうか？']) {
   const s=session(id,async()=>{throw Error('Simulated API failure: verify deterministic fallback')});
   s.run(`window.ROLEPLAY_INTENT_ASSIST.enabled=()=>${enabled};state.transcript.push({role:'customer',text:'案内のはがきが来ていましたよ。',audioId:'inspection_explained_inspection_notice_customer'});`);
   await s.say(text);
   assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_asked_availability_customer',text);
   assert.equal(s.run('state.proposedAppointment'),null);
   assert.equal(s.run(`shouldAnswerInspectionBookingIntent(${JSON.stringify(text)})`),false,'Do not repeat');
  }
 }
 const s=session(id,async()=>null);
 assert.equal(s.run('shouldAnswerInspectionBookingIntent("ご入庫いただけますでしょうか？")'),false,'No postcard context');
 s.run("state.transcript.push({role:'customer',text:'案内のはがきが来ていましたよ。'});");
 for(const text of ['ご入庫ありがとうございます。','荷物を降ろしていただけますか？','ご入庫いただけますか？連絡先はこの携帯でよろしいですか？','9月1日の10時にご入庫いただけますか？']) assert.equal(s.run(`shouldAnswerInspectionBookingIntent(${JSON.stringify(text)})`),false,text);
 s.run('state.inspectionAppointmentCandidate={month:9,day:1,hour:10,minute:0};');
 assert.equal(s.run('shouldAnswerInspectionBookingIntent("ご入庫いただけますでしょうか？")'),false,'Date discussion must not rewind');
}
console.log('入庫意思再確認: 上級/応用・LLM ON/OFF・既存音声・重複/日程後退防止 OK');
