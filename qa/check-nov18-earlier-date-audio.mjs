import fs from 'node:fs';import assert from 'node:assert/strict';import {session} from './check-inspection-llm-selection.mjs';
const src=fs.readFileSync('app.js','utf8');let count=0;
for(const scenario of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery'])for(const reverse of [false,true]) {
 const s=session(scenario,async()=>null);s.run(src.slice(src.indexOf('function addMessage('),src.indexOf('function renderConversation(')));s.run('renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;');
 await s.say(reverse?'8月の23日と22日、どちらがよろしいですか？':'8月の22日か23日、どちらがよろしいですか？');
 assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_preferred_earlier_date_customer');assert.equal(s.run('state.scriptedPartialReplies.inspectionPickupDate.text'),'8月22日');assert.equal(s.run('state.proposedAppointment'),null);count++;
 await s.say('それでは午前9時半はいかがですか？');assert.equal(s.run('state.inspectionAppointmentCandidate.day'),'22');assert.equal(s.run('state.inspectionAppointmentCandidate.hour'),'9');assert.equal(s.run('state.inspectionAppointmentCandidate.minute'),30);count++;
}
const s=session('vehicle-inspection-pickup-delivery',async()=>null);s.run(src.slice(src.indexOf('function addMessage('),src.indexOf('function renderConversation(')));s.run("renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;audioIndex.delete('inspection_preferred_earlier_date_customer');");await s.say('8月22日と23日、どちらがよろしいですか？');assert.equal(s.run('state.transcript.at(-1).emergencyAudio.reason'),'missing_registered_audio');assert.ok(!s.run('state.scriptedPartialReplies.inspectionPickupDate'));count++;
console.log('早い日付選択音声 '+count+' 条件 OK');
