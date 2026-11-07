import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validateSelection,validSelection} from '../lab/selection-core.mjs';
const source=fs.readFileSync('app.js','utf8');
function real(select){
 const s=session('vehicle-inspection-pickup-delivery',select);
 s.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
 s.run('renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;');
 return s;
}
let count=0;
const cases=[
 ['はい。ええと。ちなみに、ええと今現在のヤリスの走行距離はおわかりになりますか？','inspection_mileage','mileage',/万/],
 ['ありがとうございます。オドメーターに表示されている数字を教えていただけます？','inspection_mileage','mileage',/万/],
 ['お車はここまで何キロほどお乗りになりました？','inspection_mileage','mileage',/万/],
 ['お知らせする際は、今つながっている番号で差し支えないでしょうか？','inspection_contact','contact',/この携帯/],
 ['整備と一緒に済ませておきたいことはございます？','inspection_work','work',/オイル交換/],
 ['少々お話を続けても差し支えございません？','inspection_call_permission','consent',/大丈夫/],
];
for(const stage of [0,4,7])for(const variant of ['30000','over60000','120000'])for(const [text,action,topic,expected] of cases){
 let requested;
 const s=real(async req=>{
   requested=req;assert.ok(validSelection(req));
   const candidate=req.candidates.find(c=>c.action===action);assert.ok(candidate,JSON.stringify(req));
   return validateSelection({id:candidate.id,kind:'question',topic,evidence:text,
     answerTarget:s.run(`inspectionLastQuestionClause(${JSON.stringify(text)})`),conditions:[]},req);
 });
 s.run(`state.scriptStep=${stage};state.inspectionMileageVariant='${variant}'`);
 await s.say(text);
 const reply=s.run('state.transcript.at(-1)');
 assert.match(reply.text,expected,JSON.stringify({text,reply}));
 assert.ok(!reply.emergencyAudio);assert.ok(fs.existsSync(reply.audioSrc));
 assert.equal(s.run('state.inspectionMileageAsked'),topic==='mileage');
 assert.equal(s.run('state.inspectionReminderContactAnswered'),topic==='contact');
 assert.equal(s.run('state.proposedAppointment'),null);
 if(topic==='mileage')assert.match(reply.text,variant==='120000'?/12万/:variant==='over60000'?/6万/:/3万/);
 assert.ok(requested);count++;
}
// Unavailable, held, malformed and rejected model outputs all preserve fallback.
for(const mode of ['off','hold','error','invalid','wrong_topic','earlier_target']){
 const text=cases[0][0];
 const s=real(async req=>{
   if(mode==='error')throw Error('simulated timeout/network/quota failure');
   if(mode==='hold')return null;
   if(mode==='invalid')return {id:'unregistered'};
   return {id:req.candidates.find(c=>c.action==='inspection_mileage').id,kind:'question',
     topic:mode==='wrong_topic'?'contact':'mileage',evidence:text,answerTarget:'はい。'};
 });
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
 s.run('state.inspectionMileageVariant="120000"');await s.say(text);
 assert.match(s.run('state.transcript.at(-1).text'),/12万/);count++;
}
// Reject earlier-clause selection even though the selected ID is available.
const composite='走行距離も後ほど伺います。今、少しお時間よろしいでしょうか？';
const earlier=real(async req=>({id:req.candidates.find(c=>c.action==='inspection_mileage').id,
 kind:'question',topic:'mileage',evidence:'走行距離も後ほど伺います。',answerTarget:'走行距離も後ほど伺います。'}));
await earlier.say(composite);assert.match(earlier.run('state.transcript.at(-1).text'),/大丈夫/);
assert.equal(earlier.run('state.inspectionMileageAsked'),false);count++;
// A foreign mileage ID cannot enter through a valid-looking semantic result.
const wrong=real(async req=>({id:'inspection_current_mileage_customer',kind:'question',topic:'mileage',
 evidence:req.text,answerTarget:req.text}));
wrong.run('state.inspectionMileageVariant="120000"');await wrong.say(cases[0][0]);
assert.match(wrong.run('state.transcript.at(-1).text'),/12万/);count++;
console.log(`LLM意味理解優先: ${count}条件成功（模擬LLM・本番音声確定経路、実API呼出なし）`);
