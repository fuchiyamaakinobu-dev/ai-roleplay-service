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

const s=session();
s.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="proposal";state.inspectionPickupReason="distance"');
const offer='遠くてお車を持ってくるのが大変なのですね。ご自宅に近い札内店へのご来店はいかがでしょうか？難しい場合は引き取りも承ります。';
assert.equal(s.say(offer).text,'それなら、お店に持って行きます。');
assert.equal(s.run('inspectionVisitStoreSelection().name'),'札内店');
assert.equal(s.run('state.inspectionPickupOutcome'),'visit');
s.say('9月20日10時に札内店へご来店いただくのはいかがでしょうか？');
assert.equal(s.run('state.proposedAppointment.day'),'20');
s.say('佐藤様、9月21日10時に札内店にご来店のご予約です。');
const result=s.run('scoreScriptedRoleplay()');
assert.match(result.improve[0],/日付の案内が曖昧/);
assert.ok(!result.improve.some(x=>x.includes('お客様名を添える')));
s.say('本日はありがとうございました。');assert.equal(s.run('state.ended'),true);
const direct=session();direct.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="proposal";state.inspectionPickupReason="distance"');
assert.equal(direct.say('ご自宅への引き取りを承ります。').text,'自宅に取りに来てもらえますか？');
assert.equal(direct.run('state.inspectionPickupOutcome'),'pickup');
console.log('近隣店舗提案と条件付き引取の区別・店舗名保持・日付指摘 OK');
