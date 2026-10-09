import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function session(variant='30000') {
  const c={window:{},document:{querySelector:()=>({textContent:''})},console};
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(new URL('../scenario.js',import.meta.url),'utf8'),c);
  vm.runInContext(source.slice(0,source.indexOf('els.startButton.addEventListener')),c);
  vm.runInContext(`scenario=window.VEHICLE_INSPECTION_PICKUP_SCENARIO;state.started=true;state.variantSeed=1;
    state.inspectionMileageVariant=${JSON.stringify(variant)};renderProgress=()=>{};
    continueSpeechInputWithoutCustomerReply=()=>{};finishRoleplay=()=>{state.ended=true};
    addMessage=(role,text,options={})=>{state.transcript.push({role,text,audioId:options.audioId});options.onCommitted?.()};`,c);
  return {run:s=>vm.runInContext(s,c),say(text){c.input=text;vm.runInContext('state.transcript.push({role:"staff",text:input});handleScriptedStaffReply(input)',c);return vm.runInContext('state.transcript.at(-1).text',c)}};
}
for(const variant of ['30000','over60000','120000']) {
  const s=session(variant);
  s.say('現在の走行距離は何キロですか？');
  s.say('気になるところはございますか？');
  s.say('9月30日10時半はいかがでしょうか？');
  assert.equal(s.run('state.proposedAppointment'),null,'基本フロー途中の日時は候補');
  assert.equal(s.say('代車もご用意させていただきますね。このまま車検の説明をさせていただきたかったので少々お時間よろしいでしょうか？'),'大丈夫ですよ。');
  if(variant!=='30000') {
    assert.equal(s.run('state.inspectionLoanerConfirmed'),true);
    assert.equal(s.say('代車をご用意します。'),'はい。','手配済みの代車を再要求しない');
  }
  s.say('車検証、自賠責保険証券、納税証明書をご用意ください。');
  assert.equal(s.run('state.proposedAppointment.minute'),30);
  assert.doesNotMatch(s.say('荷室の荷物は空の状態でお願いします。'),/日時|予約しよう/);
  if(variant!=='30000') assert.ok(s.run('scoreScriptedRoleplay().judgements').some(x=>x.startsWith('走行距離・時間・店内待ち: 要改善')),'預かり案内不足は採点に残る');
  s.say('本日はありがとうございました。');assert.equal(s.run('state.ended'),true);
}
const unresolved=session();
unresolved.say('9月30日10時半はいかがでしょうか？');
unresolved.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="location";state.inspectionPickupOutcome="pickup"');
unresolved.say('本日はありがとうございました。');
assert.equal(unresolved.run('state.ended'),true);
assert.equal(unresolved.run('state.proposedAppointment'),null,'引取受付未解決を予約確定にしない');
assert.equal(unresolved.run('state.inspectionAppointmentIncomplete'),true);
const split=session();
split.say('現在の走行距離は何キロですか？');
split.say('作業は1時間半です。気になるところはございますか？');
assert.equal(split.say('オイル交換も含めて店内でお待ちいただけます。'),'できれば、車を取りに来てもらえませんか？');
console.log('履歴再現：候補保持・最後の質問・代車保持・省略採点・未解決終話 OK');

for(const invitation of ['当社へご入庫いただけますでしょうか？','ご入庫いただけないでしょうか？','ご利用頂けますでしょうか？','当社にお願いできますでしょうか？']) {
  const s=session();
  assert.equal(s.say(invitation),'お願いしたいんですけど、いつできますか？');
  const before=s.run('state.transcript.filter(x=>x.role==="customer").length');
  s.say('ありがとうございます。');
  assert.equal(s.run('state.transcript.filter(x=>x.role==="customer").length'),before,'お礼の後はスタッフの続き待ち');
  assert.equal(s.say('このままご予約をさせていただきたいのですが、よろしいでしょうか？'),'お願いします。');
  assert.equal(s.say('8月30日はいかがでしょうか？'),'何時が空いていますか？');
  s.say('ありがとうございます。');
  assert.equal(s.say('8月30日はいかがでしょうか？'),'はい。','同じ日付で再質問しない');
  s.say('10時半が空いていますが、いかがでしょうか？');
  assert.equal(s.run('state.inspectionAppointmentCandidate.day'),'30');
  assert.equal(s.run('state.inspectionAppointmentCandidate.minute'),30);
  assert.equal(s.run('state.proposedAppointment'),null,'基本フロー前の日時は候補');
  s.say('現在の走行距離は何キロですか？');
  s.say('気になるところはございますか？');
  s.say('オイル交換を含めて1時間半です。店内でお待ちいただけます。');
  s.say('ご来店が難しい理由を教えていただけますか？');
  s.say('近くの札内店へのご来店はいかがでしょうか？');
  assert.equal(s.run('state.proposedAppointment.minute'),30);
  assert.doesNotMatch(s.say('代わりのお車、外出される予定とかはございませんか？'),/いつできます|何時|何日/);
  s.say('本日はありがとうございました。');assert.equal(s.run('state.ended'),true);
}
const loaner=session('120000');
assert.equal(loaner.say('代わりのお車、外出される予定とかはございませんか？'),'お願いします。');
assert.equal(loaner.run('state.inspectionWaitingMethod'),'loaner');
const dateUpdate=session();
dateUpdate.say('8月30日はいかがでしょうか？');
dateUpdate.say('9月2日はいかがでしょうか？');
dateUpdate.say('10時が空いていますがいかがでしょうか？');
assert.equal(dateUpdate.run('state.inspectionAppointmentCandidate.day'),'2','候補日変更を保持');
console.log('入庫意思・お礼・予約了承・日付と時刻の分割・代車外出質問 OK');
