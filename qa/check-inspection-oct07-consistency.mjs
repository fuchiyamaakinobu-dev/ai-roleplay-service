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
const scoring=session();
scoring.say('ヤリスの車検は9月30日満了で8月1日以降作業可能なのですが、ご都合よろしかったでしょうか？');
assert.equal(scoring.run('inspectionConversationMetricAchieved("asked_availability")'),true);
scoring.run('state.proposedAppointment={month:"9",day:"30",hour:"10",minute:30};state.inspectionPickupPhase="resolved";state.inspectionPickupOutcome="visit"');
assert.equal(scoring.say('このまま車検の説明させていただきたかったので少々お時間よろしかったでしょうか').text,'大丈夫ですよ。');
assert.equal(scoring.run('inspectionConversationMetricAchieved("confirmed_booking_time")'),true);
assert.equal(scoring.run('hasExplicitBookingContinuationConfirmation("今、お電話よろしかったでしょうか？")'),false);
assert.equal(scoring.run('hasExplicitBookingContinuationConfirmation("9月30日10時半でよろしかったでしょうか？")'),false);
assert.equal(scoring.run('hasExplicitBookingContinuationConfirmation("車検の説明に少々お時間をいただきます")'),false);
assert.equal(scoring.run('hasConfirmedInspectionAppointmentRecap("9月30日10時半にご来店の予約でございます。")'),false,'氏名不足は未達を維持');

const store=session();
store.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="proposal";state.inspectionPickupReason="distance"');
assert.equal(store.say('近くの店にお越しいただいて車検できますがいかがでしょうか？').text,'近くのお店は、どちらのお店になりますか？');
store.say('札内店にご来店いただく予定です。');
assert.equal(store.run('inspectionVisitStoreSelection().name'),'札内店');
store.run('state.proposedAppointment={month:"9",day:"30",hour:"10",minute:30}');
const wrong='佐藤様、最後に確認させていただきます。9月30日10時半に本別店にご来店の予約でございます。';
assert.equal(store.say(wrong).text,'ご案内いただいた札内店の予約ではありませんか？');
assert.equal(store.run('inspectionConversationMetricAchieved("recapped_appointment")'),false);
store.say('佐藤様、9月30日10時半に札内店にご来店の予約でございます。');
assert.equal(store.run('inspectionConversationMetricAchieved("recapped_appointment")'),true);
assert.equal(store.run('state.proposedAppointment.day'),'30');

const named=session();
named.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="proposal";state.inspectionPickupReason="distance"');
assert.equal(named.say('お家の近くに札内店という店舗があります。そちらへご来店可能でしょうか？').text,'それなら、お店に持って行きます。');
assert.equal(named.run('inspectionVisitStoreSelection().name'),'札内店');
named.run('state.inspectionWaitingMethod="loaner";state.inspectionLoanerRequested=true;state.proposedAppointment={month:"9",day:"30",hour:"10",minute:30}');
assert.equal(named.say('9月30日10時半に札内店にご来店いただいて、一時間半お待ちいただく車検です。').text,'代車を用意してもらえますか？');
assert.equal(named.run('state.inspectionWaitingMethod'),'loaner');
assert.equal(named.run('state.inspectionPickupOutcome'),'visit');
assert.equal(named.say('本日はありがとうございました。失礼いたします。').text,'ありがとうございました。');
assert.equal(named.run('state.ended'),true);
const audio=session();
audio.run('renderConversation=()=>{};els.audioEnabled.checked=true;startSpeechInputAfterCustomer=()=>{};speakCustomerText=(text)=>{window.spoken=text}');
audio.run('commitMessage("customer","近くのお店は、どちらのお店になりますか？",{allowSpeechSynthesis:true})');
assert.equal(audio.run('window.spoken'),undefined,'ユーザー指定により店舗確認も音声合成を使用しない');
audio.run('window.spoken=null;commitMessage("customer","未登録の通常車検発話")');
assert.equal(audio.run('window.spoken'),null,'既存の通常車検の音声動作は維持');
console.log('10月7日: 都合・説明時間の採点回収、店舗確認・復唱一致、代車希望保持 OK');
