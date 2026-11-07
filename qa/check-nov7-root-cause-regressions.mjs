import fs from 'node:fs';
import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validateSelection,validSelection} from '../lab/selection-core.mjs';
const source=fs.readFileSync('app.js','utf8');
const cases=[
 ['permission','今、お電話よろしいでしょうか。','大丈夫'],
 ['permission_context','少しお時間お電話よろしかったですか？','大丈夫'],
 ['permission_control','今、少しお時間よろしいでしょうか？','大丈夫'],
 ['identity','佐藤様のお電話でよろしいでしょうか。','そうです'],
 ['identity_past','佐藤様のお電話でよろしかったでしょうか？','そうです'],
 ['identity_compound','私、トヨタモビリティ帯広南店の渕山と申します。佐藤様のお電話でよろしいでしょうか。','そうです'],
 ['identity_thanks','ありがとうございます。佐藤様のお電話でよろしいでしょうか？','そうです'],
 ['contact','確認のお電話はこの携帯電話におかけしてよろしいでしょうか？','この携帯'],
 ['mileage','現在の走行距離は何キロでしょうか？','3万'],
 ['mileage_soft','現在の走行距離は何キロぐらい走られてますでしょう。','3万'],
 ['mileage_thanks','ありがとうございます。現在の走行距離は何キロでしょうか？','3万'],
 ['oil','オイル交換はいかがですか？','オイル交換'],
 ['oil_negative','オイル交換は必要ございませんか？','オイル交換'],
 ['oil_thanks','ありがとうございます。オイル交換はいかがですか？','オイル交換'],
 ['last_identity','走行距離も後ほど伺います。佐藤様のお電話でよろしいでしょうか？','そうです'],
 ['last_mileage','佐藤様ですね。現在の走行距離は何キロでしょうか？','3万'],
 ['last_contact','今、少しお時間よろしいでしょうか。確認の連絡はこの携帯におかけしてよろしいですか？','この携帯'],
 ['last_permission','連絡先は後ほど確認します。今、お電話よろしいでしょうか？','大丈夫'],
];
const results=[];
for(const scenario of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery'])for(const stage of [0,1,7])for(const mode of ['hold','off','error','best_candidate'])for(const [name,text,expected] of cases){
 const requests=[];let selected=null;
 const s=session(scenario,async req=>{requests.push(req);assert.ok(validSelection(req));if(mode==='error')throw Error('mock transport failure');if(mode==='best_candidate'){const c=req.candidates.find(c=>c.text.includes(expected));if(c){selected=c;return validateSelection({id:c.id,kind:"question",topic:name.startsWith("identity")||name==="last_identity"?"identity":expected==="3万"?"mileage":expected==="オイル交換"?"work":expected==="この携帯"?"contact":"consent",evidence:text,answerTarget:s.run(`inspectionLastQuestionClause(${JSON.stringify(text)})`),conditions:[]},req);}}return null;});
 s.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
 s.run(`state.scriptStep=${stage};renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;`);
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
 const before=s.run('JSON.stringify({step:state.scriptStep,contact:state.inspectionReminderContactAnswered})');
 await s.say(text);
 const reply=s.run('state.transcript.filter(m=>m.role==="customer").at(-1)');
 results.push({scenario,stage,mode,name,text,expected,reply:reply?.text,audioId:reply?.audioId,audioExists:reply?.audioSrc?fs.existsSync(reply.audioSrc):false,emergency:reply?.emergencyAudio||null,before:JSON.parse(before),after:s.run('({step:state.scriptStep,contact:state.inspectionReminderContactAnswered})'),target:s.run(`inspectionLastQuestionClause(${JSON.stringify(text)})`),selected:selected?.text,candidates:requests.at(-1)?.candidates.map(c=>({id:c.id,text:c.text}))||[],called:requests.length,ok:reply?.text.includes(expected)===true});
}
for(const r of results){
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.audioExists,true,r.name);
 assert.equal(r.emergency,null,r.name);
 assert.equal(r.after.contact,['contact','last_contact'].includes(r.name),r.name);
}
console.log(`共通判定・本番確定経路: ${results.length}条件成功（候補契約・音声存在・非常代替なし・連絡先状態隔離）`);
