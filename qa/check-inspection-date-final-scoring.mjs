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

for (const standard of [false,true]) {
 const s=session();
 if(standard)s.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
 s.run('state.scriptStep=scenario.steps.findIndex(x=>x.key==="recapped_appointment");state.proposedAppointment={month:"9",day:"20",hour:"10",minute:0};state.inspectionPickupPhase="resolved";state.inspectionPickupOutcome="visit"');
 s.say('佐藤様、9月20日10時にご来店の予約です。');
 const correct=s.run('scoreScriptedRoleplay()');
 s.say('佐藤様、9月21日10時にご来店の予約です。');
 const wrong=s.run('scoreScriptedRoleplay()');
 assert.ok(wrong.score<correct.score,'最後の誤復唱で減点');
 assert.match(wrong.improve[0],/日付の案内が曖昧/);
 assert.equal(s.run('state.proposedAppointment.day'),'20');
 assert.match(s.run('state.transcript.at(-1).text'),/^(お願いします。|はい。)$/,'訂正を要求せず相づちで継続');
 s.say('本日はありがとうございました。');
 assert.equal(s.run('state.ended'),true);
}
const fixed=session();
fixed.run('state.scriptStep=scenario.steps.findIndex(x=>x.key==="recapped_appointment");state.proposedAppointment={month:"9",day:"20",hour:"10",minute:0};state.inspectionPickupPhase="resolved";state.inspectionPickupOutcome="pickup"');
fixed.say('佐藤様、9月21日10時にご自宅へ引き取りに伺うご予約です。');
fixed.say('失礼しました。佐藤様、9月20日10時にご自宅へ引き取りに伺うご予約です。');
assert.equal(fixed.run('lastInspectionRecapDateMismatch()'),false);
assert.ok(!fixed.run('scoreScriptedRoleplay().improve').some(x=>x.includes('日付の案内が曖昧')));
const loaner=session();
assert.equal(loaner.say('代車をご用意できますが、必要でしょうか？').text,'お願いします。');
console.log('最終日時不一致の減点・訂正回復・終話継続・代車受諾 OK');
