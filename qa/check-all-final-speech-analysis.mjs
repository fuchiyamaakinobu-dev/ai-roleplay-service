import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validSelection,validateSelection} from '../lab/selection-core.mjs';
for(const id of ['service-12month-visit-promotion','vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery'])for(const text of ['ありがとうございます。','佐藤様、9月30日10時にご来店の予約です。','少々お待ちください。']){
 let calls=0;const s=session(id,async req=>{calls++;assert.ok(validSelection(req));assert.equal(req.text,text);return validateSelection({kind:'explanation',topic:'other',evidence:text,id:'rule'},req);});
 s.run("renderResults=()=>{};state.currentState='INSPECTION_REQUEST_RECEIVED';");
 await s.say(text);assert.equal(calls,1,id+'/'+text);assert.equal(s.run('state.customerReplyPending'),false);
}
const unknown='オドメーターの数字を教えていただけます？';
let input;const s=session('vehicle-inspection-pickup-delivery',async req=>{input=req;return validateSelection({kind:'question',topic:'mileage',evidence:unknown,id:req.candidates.find(c=>c.action==='inspection_mileage').id},req);});
await s.say(unknown);assert.ok(input.candidates.some(c=>c.action==='inspection_mileage'));assert.match(s.run('state.transcript.at(-1).text'),/3万/);
assert.equal(s.run('state.proposedAppointment'),null);
const req={text:'ありがとうございます。',live:true,context:{phase:'inspection:0',additionalAnswered:false,timeExplained:false},history:[],candidates:[]};
assert.ok(validSelection(req));assert.equal(validateSelection({kind:'acknowledgement',topic:'other',evidence:req.text,id:'rule'},req).id,'rule');
assert.throws(()=>validateSelection({kind:'question',topic:'mileage',evidence:req.text,id:'invented'},req));
assert.equal(validSelection({...req,text:'あ'.repeat(2001)}),false);
for(const mode of ['off','failure']){let calls=0;const f=session('vehicle-inspection-pickup-delivery',async()=>{calls++;throw Error('network')});if(mode==='off')f.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');await f.say('現在の走行距離は何キロですか？');assert.match(f.run('state.transcript.at(-1).text'),/3万/);assert.equal(calls,mode==='off'?0:1);}
console.log('全確定発話: 3シナリオ・挨拶/復唱/説明・1回通信・未知の言い換え・空候補・OFF/失敗 OK');
