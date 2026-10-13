import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validSelection} from '../lab/selection-core.mjs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function session(id, select) {
 const node=()=>({value:'',disabled:false,textContent:'',setAttribute(){}});
 const c=vm.createContext({window:{},document:{querySelector:node},console});
 for(const f of ['scenario.js','audio-db.js']) vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
 vm.runInContext(source.slice(0,source.indexOf('els.startButton.addEventListener')),c);
 c.window.ROLEPLAY_INTENT_ASSIST={enabled:()=>true,select}; c.id=id;
 vm.runInContext(`scenario=scenarios.find(s=>s.id===id);state.started=true;state.scriptStep=4;
 stopSpeechInput=()=>{};stopCustomerPlayback=()=>{};clearStaffInput=()=>{};renderProgress=()=>{};
 addMessage=(role,text,options={})=>state.transcript.push({role,text,audioId:options.audioId});`,c);
 return {run:s=>vm.runInContext(s,c),say:text=>{c.input=text;return vm.runInContext('els.staffInput.value=input;handleReply({preventDefault(){}})',c)}};
}
for (const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 const s=session(id,async()=>null);
 for(const text of ['8月1日以降、いつでも可能でございまして、今のところ9月の一日はいかがでしょうか。','ええ、9月1日は今のところまだ予定はありませんので、ええ、朝の9時半はいかがでしょう。']) {
  await s.say(text);
 }
 assert.notEqual(s.run('state.transcript.at(-1).audioId'),'inspection_asked_availability_customer');
 const a=JSON.parse(s.run('JSON.stringify(state.proposedAppointment || state.inspectionAppointmentCandidate)'));
 assert.equal(Number(a.month),9);assert.equal(Number(a.day),1);assert.equal(Number(a.hour),9);assert.equal(a.minute,30);
 if(id.includes('pickup')) assert.equal(s.run('state.proposedAppointment'),null);
 assert.equal(s.run('hasInspectionAvailabilityRequest("いつがご都合よろしいでしょうか？")'),true);
}
