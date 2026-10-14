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
export const fixtures=[];
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 const s=session(id,async req=>{ assert.equal(validSelection(req),true);fixtures.push(req);return {id:req.candidates.find(c=>c.action==='inspection_mileage').id} });
 await s.say('現在の走行距離は何キロでしょうか？');
 assert.match(s.run('state.transcript.at(-1).text'),/3万/);
 assert.equal(s.run('state.customerReplyPending'),false);
 assert.equal(s.run('state.proposedAppointment'),null);
 s.run('state.inspectionMileageVariant="120000"');
 if(id.includes('pickup')) assert.match(s.run('inspectionLlmCandidates("走行距離は何キロですか？").find(c=>c.action==="inspection_mileage").text'),/12万/);
 assert.equal(s.run('inspectionLlmCandidates("10月25日の午前10時はいかがでしょうか？").length'),0);
 assert.equal(s.run('inspectionLlmCandidates("ありがとうございました。").length'),0);
 for(const c of fixtures.at(-1).candidates){const file=s.run(`audioPath('${c.id}')`);assert.ok(fs.existsSync(new URL('../'+file,import.meta.url)));}
}
const pickup=session('vehicle-inspection-pickup-delivery',async r=>({id:r.candidates.find(c=>c.action==='inspection_reason').id}));
pickup.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="reason";state.inspectionPickupReason="distance"');
await pickup.say('お持ち込みが難しい事情をお聞かせいただけますか？');
assert.equal(pickup.run('state.inspectionPickupReason'),'distance');assert.equal(pickup.run('state.inspectionPickupPhase'),'proposal');
assert.match(pickup.run('state.transcript.at(-1).text'),/遠い/);
assert.equal(pickup.run('applyInspectionLlmSelection("場所はどちらですか？",{id:"inspection_pickup_location_customer"})'),false);
const stale=session('vehicle-inspection-phone-followup',()=>new Promise(r=>{stale.release=r}));
const pending=stale.say('走行距離は何キロですか？'); await Promise.resolve();
stale.run('state.ended=true');stale.release({id:'inspection_current_mileage_customer'});await pending;
assert.equal(stale.run('state.transcript.length'),1);
const fail=session('vehicle-inspection-phone-followup',async()=>({id:'not-allowed'}));fail.run('handleScriptedStaffReply=()=>state.legacyCalled=true');
await fail.say('走行距離は何キロですか？');assert.equal(fail.run('state.legacyCalled'),true);
console.log('車検LLM: 上級/応用・距離設定・MP3・引取理由保持・予約保護・遅延破棄・失敗復帰 OK');
export { session };
