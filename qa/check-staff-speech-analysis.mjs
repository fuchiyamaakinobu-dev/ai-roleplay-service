import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validSelection,validateSelection} from '../lab/selection-core.mjs';
const cases=[
 ['1泊2日お預かりさせていただいて翌日10月の1日の16時にご来店いただいてお引き渡しと言う形でよろしいでしょうか','return_confirmation','inspection_explained_lock_and_arrival_customer'],
 ['代車をご用意しますので、そちらに乗っていただくことでよろしいでしょうか？','loaner_offer','inspection_recapped_appointment_customer'],
 ['このまま予約の手続きを進めてもよろしいでしょうか？','booking_procedure','inspection_pickup_still_requested']
];
export const requests=[];
for(const mode of ['llm','off','failure','rule'])for(const [text,topic,id] of cases){
 let calls=0;const s=session('vehicle-inspection-pickup-delivery',async req=>{calls++;assert.ok(validSelection(req));requests.push(req);if(mode==='failure')throw Error('offline');if(mode==='rule')return {id:'rule'};return validateSelection({kind:'question',topic,evidence:text,id},req);});
 s.run("state.inspectionPickupActive=true;state.inspectionPickupPhase='location';state.inspectionPickupOutcome='pickup';state.inspectionPickupReason='work';state.proposedAppointment={month:'9',day:'30',hour:'10',minute:0};");
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
 await s.say(text);
 assert.equal(s.run('state.transcript.at(-1).audioId'),id,mode+'/'+topic);
 assert.equal(s.run('state.proposedAppointment.day'),'30');assert.equal(s.run('state.proposedAppointment.hour'),'10');
 assert.equal(s.run('state.inspectionPickupOutcome'),'pickup');assert.equal(s.run('state.inspectionPickupActive'),true);
 assert.equal(calls,mode==='off'?0:1);
 if(mode==='llm')assert.equal(validateSelection({kind:'question',topic:'appointment',evidence:text,id},requests.at(-1)).id,'rule');
}
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
for(const text of ['9月30日10時にご入庫いただけますか？','翌日16時に返却しますが、走行距離は何キロですか？','代車をご用意しますが、お車に気になるところはありませんか？','翌日、ご自宅と店舗のどちらに納車しましょうか？'])assert.equal(s.run(`inspectionSpeechAnalysisCandidates(${JSON.stringify(text)}).length`),0,text);
console.log('意味分析: 返却/代車/未解決手続き・一回通信・OFF/失敗・入庫と引取保持・最終質問保護 OK');
