import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function session() {
  const context = {window:{}, document:{querySelector:()=>({textContent:''})}, console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../scenario.js', import.meta.url),'utf8'),context);
  vm.runInContext(source.slice(0,source.indexOf('els.startButton.addEventListener')),context);
  vm.runInContext(`scenario=window.VEHICLE_INSPECTION_PICKUP_SCENARIO; state.started=true; state.variantSeed=1;
    renderProgress=()=>{}; continueSpeechInputWithoutCustomerReply=()=>{};
    finishRoleplay=()=>{state.ended=true};
    addMessage=(role,text,options={})=>{state.transcript.push({role,text,audioId:options.audioId});options.onCommitted?.()}`,context);
  return {run:code=>vm.runInContext(code,context),say(text){
    context.input=text;
    vm.runInContext('state.transcript.push({role:"staff",text:input});handleScriptedStaffReply(input)',context);
    return vm.runInContext('state.transcript.at(-1)',context);
  }};
}

for (const variant of ['over60000','120000']) {
 const s=session();s.run('state.inspectionMileageVariant='+JSON.stringify(variant));
 assert.equal(s.say('ヤリスの車検のご都合はいかがでしょうか？').text,'お願いしたいんですけど、いつできますか？');
 assert.match(s.say('現在の走行距離は何キロですか？').text,variant==='120000'?/12万/:/6万/);
 assert.equal(s.say('気になるところや追加のご用命はございますか？').text,'オイル交換もお願いしたいです。');
 assert.equal(s.say('ほかに気になるところはございますか？').text,'そのほかは大丈夫です。');
 s.say('オイル交換も含めて1時間半でできます。店内でお待ちいただけます。');
 assert.equal(s.run('state.inspectionPickupActive'),false,'多走行は待ち車検で引取へ進まない');
 assert.equal(s.run('state.inspectionWaitingMethod'),'loaner');
 s.say(variant==='over60000'?'ワンデー車検で1日お預かりします。':'お車をお預かりして整備します。');
 assert.equal(s.run('state.inspectionPickupActive'),false,'代車案内を待つ');
 assert.equal(s.say('代車をご用意いたします。').text,'できれば、車を取りに来てもらえませんか？');
 s.say('ご来店が難しい理由を教えていただけますか？');
 s.say('近い店舗の札内店へご来店いただく方法はいかがでしょうか？');
 s.say('9月20日10時にご来店はいかがでしょうか？');
 assert.equal(s.run('state.proposedAppointment.day'),'20');
 assert.match(s.say('もう一度、走行距離は何キロですか？').text,variant==='120000'?/12万/:/6万/);
 assert.equal(s.say('店内でお待ちになりますか？').text,'代車を用意してもらえますか？');
 assert.equal(s.run('state.inspectionWaitingMethod'),'loaner');
 const scored=s.run('scoreScriptedRoleplay()');
 assert.ok(scored.judgements.some(x=>x.startsWith('走行距離・時間・店内待ち: ○')));
 s.say('本日はありがとうございました。');assert.equal(s.run('state.ended'),true);
}
const audio={window:{}};vm.createContext(audio);vm.runInContext(fs.readFileSync(new URL('../audio-db.js',import.meta.url),'utf8'),audio);
for(const id of ['inspection_current_mileage_120000_customer','inspection_current_mileage_over60000_customer']) {
 const item=audio.window.ROLEPLAY_AUDIO_DB.items.find(x=>x.id===id);assert.ok(item);assert.ok(fs.statSync(new URL('../audio/'+item.file,import.meta.url)).size>1000);
}
console.log('6万km超・12万km：距離保持・預かり案内・代車・終話・音声登録 OK');
