import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 const s=session(id,async()=>null);
 s.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
 s.run('renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;');
 for(const [staff,expected] of [
 ['8月1日以降、いつでも作業が可能なんですが。8月30日はいかがでしょうか？','何時が空いていますか？'],
 ['今のところさほど混み合っておりませんので、お好きな時間でお取りできますが、ご都合いかがでしょうか。','午前中でお願いします。'],
 ['では、8月の21日土曜日はいかがでしょうか。','何時が空いていますか？'],
 ['午前10時はいかがでしょうか？','では、その時間でお願いします。']
 ]) {
  await s.say(staff);
  const reply=s.run('state.transcript.at(-1)');
  assert.equal(reply.text,expected,id+' '+staff);
  assert.equal(reply.emergencyAudio,undefined);
  assert.ok(fs.existsSync(new URL('../'+reply.audioSrc,import.meta.url)));
  console.log(id,staff,'→',reply.text);
 }
 assert.equal(Number(s.run('(state.proposedAppointment || state.inspectionAppointmentCandidate).day')),21);
}
