import fs from 'node:fs';import assert from 'node:assert/strict';import {session} from './check-inspection-llm-selection.mjs';
const src=fs.readFileSync('app.js','utf8');let count=0;
const create=(variant='over60000',mode='hold')=>{const s=session('vehicle-inspection-pickup-delivery',async req=>{if(mode==='error')throw Error('limit');if(mode==='wrong')return {id:'inspection_asked_availability_customer',kind:'question',topic:'booking_intent',evidence:req.text,answerTarget:req.text};return {id:'rule'};});s.run(src.slice(src.indexOf('function addMessage('),src.indexOf('function renderConversation(')));s.run(`state.inspectionMileageVariant='${variant}';state.inspectionMileageAsked=true;state.scriptStep=6;state.transcript=[{role:'customer',text:'オイル交換もお願いしたいです。'}];renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};continueSpeechInputWithoutCustomerReply=()=>{};interactionDelayMs=()=>0;`);if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');return s;};
for(const mode of ['off','hold','error','wrong']){
 const s=create('over60000',mode);
 await s.say('そうですか。6万キロでしたら一日車検というのをお勧めしているんですがいかがですか？');assert.match(s.run('state.transcript.at(-1).text'),/どれくらい時間/);count++;
 for(const t of ['8月の22日か23日どちらも営業していますが、いかがですか？','8月の22日23日、どちらがよろしいですか？','8月の22日と23日。Gどちらがよろしいですか？']){
  await s.say(t);assert.equal(s.run('state.transcript.at(-1).emergencyAudio.reason'),'missing_registered_audio');assert.equal(s.run('state.inspectionAppointmentCandidate'),null);assert.equal(s.run('state.proposedAppointment'),null);count++;
 }
 await s.say('佐藤様。8月の22日の朝9時半ではいかがですか？');assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_appointment_single_time_customer');assert.equal(s.run('state.inspectionAppointmentCandidate.minute'),30);assert.equal(s.run('state.inspectionAppointmentCandidate.period'),'午前');count++;
 const low=create('low',mode);await low.say('オイル交換もさせていただきますねそれでも1時間半位で車検可能だったのですが9月の17日午前10時半とかでいかがでしょうか');assert.equal(low.run('state.transcript.at(-1).audioId'),'inspection_appointment_single_time_customer');assert.equal(low.run('state.inspectionAppointmentCandidate.day'),'17');count++;
 await low.say('かしこまりましたありがとうございます加藤様1時間半で車検ができるのでお店にご来店いただいてお待ちいただく車金ってできるんですけれどもいかがでしょうか');
 assert.equal(low.run('state.inspectionWaitingMethod'),'store');count++;
 await low.say('お待ちいただいてる間に代車でお出かけになることがありますか');assert.doesNotMatch(low.run('state.transcript.at(-1).text'),/^はい|^ええ/);assert.equal(low.run('state.inspectionWaitingMethod'),'store');count++;
 await low.say('代車もご用意いたしますね');assert.equal(low.run('state.inspectionWaitingMethod'),'store');assert.equal(low.run('state.inspectionLoanerRequested'),false);assert.equal(low.run('inspectionStorageScoringEvidence().nonWaiting'),false);count++;
}
const consent=create();await consent.say('ありがとうございます。いつ頃よろしいかご相談させてもらっていいですか？');assert.equal(consent.run('state.transcript.at(-1).audioId'),'inspection_confirmed_booking_time_customer');count++;
const request='今回の車検もお願いしたくお電話しました。';
const invited=create();invited.run('state.transcript=[]');assert.equal(invited.run(`applyInspectionLlmSelection(${JSON.stringify(request)},{id:'inspection_asked_availability_customer',kind:'request',topic:'booking_intent',evidence:${JSON.stringify(request)},answerTarget:${JSON.stringify(request)}},inspectionSemanticCandidates(${JSON.stringify(request)}))`),true);assert.equal(invited.run('state.transcript.at(-1).audioId'),'inspection_asked_availability_customer');count++;
const s=create();assert.equal(s.run("inspectionDurationAnswerEvidence('9月30日で車検が切れます')"),false);assert.equal(s.run("inspectionDurationAnswerEvidence('朝お預かりして、夕方お渡しできます')"),true);count+=2;
for(const t of ['満了は8月22日で23日以降は切れています','8月22日と23日ですが、走行距離は何キロですか？']) {assert.equal(s.run(`inspectionMultipleDateChoice(${JSON.stringify(t)})`),false);count++;}
console.log('11月17日履歴再発防止 '+count+' 条件 OK');
