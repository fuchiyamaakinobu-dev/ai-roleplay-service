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
assert.equal(s.say('ヤリスの車検は9月30日満了、8月1日以降作業可能ですが、ご都合いかがでしょうか？').text,'お願いしたいんですけど、いつできますか？');
s.say('9月20日10時はいかがでしょうか？');
assert.equal(s.run('state.proposedAppointment'),null);
assert.equal(s.run('state.inspectionPickupActive'),false);
assert.match(s.say('現在の走行距離は何キロですか？').text,/3万キロ/);
assert.equal(s.say('追加整備がなければ1時間半です。店内でお待ちいただけます。').text,'はい。');
assert.equal(s.run('state.inspectionPickupActive'),false,'追加作業確認前は引取を依頼しない');
assert.equal(s.say('車検以外のご用命や気になるところはございますか？').text,'オイル交換もお願いしたいです。');
assert.equal(s.say('ほかに気になるところはございますか？').text,'そのほかは大丈夫です。');
assert.equal(s.run('state.inspectionPickupActive'),false);
assert.equal(s.say('オイル交換も含めて1時間半でできます。店内でお待ちいただく形はいかがでしょうか？').text,'できれば、車を取りに来てもらえませんか？');
assert.equal(s.run('state.inspectionPickupPhase'),'reason');
assert.equal(s.run('state.inspectionAppointmentCandidate.day'),'20');
s.say('ご来店が難しい理由を教えていただけますか？');
s.say('近くの店舗の札内店へのご来店はいかがでしょうか？');
assert.equal(s.run('state.proposedAppointment.day'),'20');
s.say('本日はありがとうございました。');assert.equal(s.run('state.ended'),true);
console.log('基本フロー：都合→距離→ご用命→待ち車検→引取→予約確定 OK');
