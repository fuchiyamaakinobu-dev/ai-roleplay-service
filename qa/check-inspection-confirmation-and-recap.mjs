import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validSelection,validateSelection} from '../lab/selection-core.mjs';
const text='以前は取りに伺えるとご案内していたのですね。説明が行き違い申し訳ございません。ご来店ならお車を見ながら詳しく説明できますが、難しい場合は引取でも対応します。今回は引取で手配してよろしいでしょうか？';
for(const mode of ['llm','off','failure','rule'])for(const seed of [0,1,2]){
 const s=session('vehicle-inspection-pickup-delivery',async req=>{assert.ok(validSelection(req));if(mode==='failure')throw Error('network');if(mode==='rule')return {id:'rule'};return validateSelection({kind:'question',topic:'pickup_confirmation',evidence:req.text,id:req.candidates[0].id},req);});
 s.run(`state.inspectionPickupActive=true;state.inspectionPickupPhase='proposal';state.inspectionPickupReason='previous';state.variantSeed=${seed};`);
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false;');
 await s.say(text);
 assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_pickup_confirmed_customer');
 assert.equal(s.run('state.inspectionPickupOutcome'),'pickup');assert.equal(s.run('state.inspectionPickupPhase'),'location');
 assert.equal(s.run('state.proposedAppointment'),null);
 await s.say('お引取りに伺う場所は、ご自宅でよろしいでしょうか？');
 assert.equal(s.run('state.inspectionPickupOutcome'),'pickup');
}
const guard=session('vehicle-inspection-pickup-delivery',async()=>null);
guard.run("state.inspectionPickupActive=true;state.inspectionPickupPhase='proposal';");
for(const q of ['難しい場合は引取できますが、ご来店いただけますでしょうか？','引取はできませんが、よろしいですか？','今回は引取ではなく来店でよろしいですか？'])assert.equal(guard.run(`asksInspectionPickupArrangementConfirmation(${JSON.stringify(q)})`),false,q);
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery'])for(const suffix of ['オイル交換を含む1日車検でお預かりします。','作業には2日間かかります。','最短1日で仕上がります。']){
 const s=session(id,async()=>null);
 s.run("state.scriptStep=scenario.steps.findIndex(x=>x.key==='recapped_appointment');state.proposedAppointment={month:'8',day:'30',hour:'10',minute:0,period:'午前'};state.inspectionPickupPhase='resolved';state.inspectionPickupOutcome='visit';");
 const recap='佐藤様、8月30日午前10時に、トヨタモビリティ帯広へご来店いただくご予約で承りました。代車をご用意します。'+suffix+'よろしくお願いいたします。';
 assert.equal(s.run(`inspectionAppointmentDateCandidates(${JSON.stringify(recap)}).length`),1);
 await s.say(recap);
 assert.equal(s.run('lastInspectionRecapDateMismatch()'),false,recap);
 assert.equal(s.run('scoreScriptedRoleplay().improve.some(x=>x.includes("日付の案内が曖昧"))'),false,'No false mismatch deduction');
 await s.say('佐藤様、8月31日午前10時にご来店の予約です。'+suffix);
 assert.equal(s.run('lastInspectionRecapDateMismatch()'),true,'Real wrong day must still fail');
 await s.say('訂正します。佐藤様、8月30日午前10時にご来店の予約です。'+suffix);
 assert.equal(s.run('lastInspectionRecapDateMismatch()'),false);
 assert.equal(s.run('inspectionAppointmentDateCandidates("8月30日か31日は空いていますか？").length'),2,'Keep two real dates');
}
console.log('引取手配の最終質問を優先・種/OFF/失敗/保留保護・1日車検/期間の除外・誤復唱と訂正回復 OK');
