import fs from 'node:fs';import assert from 'node:assert/strict';import {session} from '../qa/check-inspection-llm-selection.mjs';import {validSelection,validateSelection} from '../lab/selection-core.mjs';
const source=fs.readFileSync('app.js','utf8');
const positives=['そうなんですね。ね、遠いんですもんね。ドライブがてらって言ったらちょっと失礼ですけど。もしよろしければ。私、代車の方をご用意していただくんですけど、それではいかがですか？','代車をご用意しますので、ご来店いただくことは可能ですか？','ドライブがてらお越しいただき、代車をご用意しますがいかがでしょうか？'];
let count=0;
for(const phase of ['proposal','location','confirmation'])for(const mode of ['llm','hold','off','error'])for(const text of positives){
 const s=session('vehicle-inspection-pickup-delivery',async req=>{assert.ok(validSelection(req));if(mode==='error')throw Error('network');if(mode==='hold')return null;assert.match(req.context.situation,/来店提案/);return validateSelection({id:'inspection_pickup_still_requested',kind:'question',topic:'waiting',evidence:text,answerTarget:s.run(`inspectionLastQuestionClause(${JSON.stringify(text)})`),conditions:[]},req);});
 s.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
 s.run(`state.scriptStep=7;state.inspectionMileageVariant='120000';state.inspectionPickupActive=true;state.inspectionPickupPhase='${phase}';state.inspectionPickupReason='distance';renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;`);
 if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
 await s.say(text);assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_pickup_still_requested');assert.equal(s.run('state.inspectionPickupActive'),true);assert.equal(s.run('state.inspectionPickupPhase'),phase);assert.equal(s.run('state.inspectionLoanerRequested'),false);assert.equal(s.run('state.proposedAppointment'),null);count++;
}
const s=session('vehicle-inspection-pickup-delivery',async()=>null);s.run("state.inspectionPickupActive=true;state.inspectionPickupPhase='proposal';state.inspectionPickupReason='distance'");
for(const text of ['代車をご用意しますが、いかがですか？','ご来店の際、代車は必要ですか？','代車をご用意します。走行距離は何キロですか？','ドライブがてらいかがですか。代車をご用意します。ほかに気になるところはありますか？','代車を用意します。確認のお電話はこの携帯でよろしいですか？','代車をご用意します。引取り場所はどちらですか？','代車をご用意します。お返しは翌日16時でよろしいですか？']){assert.equal(s.run(`inspectionVisitWithLoanerContext(${JSON.stringify(text)})`),false,text);count++;}
s.run('state.inspectionPickupActive=false');assert.equal(s.run(`inspectionVisitWithLoanerContext(${JSON.stringify(positives[0])})`),false);count++;
console.log('複合来店提案 '+count+'条件 OK');
