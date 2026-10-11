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
for(const name of ['札内店','本店','西店','南店']) {
 for(const suffix of ['ってお店になります','と言うお店になります','というお店になります']) {
  const s=session();
  assert.equal(s.run(`inspectionVisitStoreName(${JSON.stringify(name+suffix)})`),name);
 }
 const s=session();
 s.say('現在の走行距離は何キロですか？');
 s.say('気になるところはございますか？');
 assert.equal(s.say('オイル交換も含めて、お店で待っていただく1時間半車検はいかがですか？'),'できれば、車を取りに来てもらえませんか？');
 s.say('来店できない理由はございますか？');
 assert.equal(s.say(`家の近くの${name}っていうお店にご来店いただくのはいかがですか？`),'それなら、お店に持って行きます。');
 assert.equal(s.say('9月10日9時30分はよろしかったですか？'),'では、その日でお願いします。');
 assert.doesNotMatch(s.say(`最後に9月10日9時30分${name}にご来店の予約です。`),/どちら|ではありません/);
}
const consent=session();
assert.equal(consent.say('今回の車検はいかがいたしましょうか。'),'お願いしたいんですけど、いつできますか？');
const loaner=session('over60000');
loaner.say('8月30日9時半はいかがでしょうか？');
loaner.say('当日はご来店いただけますか？');
assert.equal(loaner.say('こちらから取りに伺いますね。代車をえ、ご用意させていただきますが必要でしょうか？'),'お願いします。');
const docs=session();
docs.say('8月30日9時半はいかがでしょうか？');
docs.say('当日はご来店いただけますか？');
assert.equal(docs.say('車検証、自賠責、納税証明書とロックナットの工具をお持ちください。荷室は空にしてください。'),'分かりました。');
assert.equal(docs.run('state.inspectionPickupActive'),true);
docs.say('9月30日9時半で予約を入れますのでよろしくお願いします。');
assert.equal(docs.run('state.inspectionAppointmentCandidate.month'),'8');
docs.say('ありがとうございました。');
assert.equal(docs.run('state.ended'),true);
assert.ok(docs.run('scoreScriptedRoleplay().improve').some(x=>x.includes('日付の案内が曖昧')));
const corrected=session();
corrected.say('8月30日9時半はいかがでしょうか？');
corrected.say('当日はご来店いただけますか？');
corrected.say('最終確認です。9月30日9時半の予約でよろしくお願いします。');
assert.equal(corrected.run('lastInspectionRecapDateMismatch()'),true);
corrected.say('失礼しました。最終確認です。8月30日9時半の予約でよろしくお願いします。');
assert.equal(corrected.run('lastInspectionRecapDateMismatch()'),false);
assert.equal(corrected.run('state.proposedAppointment'),null);
const burden=session();
burden.run('state.variantSeed=2');
burden.say('現在の走行距離は何キロですか？');
burden.say('気になるところはございますか？');
burden.say('1時間半でお待ちいただけます。');
burden.say('来れない理由はありますか？');
assert.match(burden.say('もしよろしければお待ちいただいて車検をさせていただければと思います。'),/運転に自信/);
assert.equal(burden.run('state.inspectionLoanerRequested'),false);
console.log('拡大履歴：店舗・日時・代車・持参品・待ち車検・入庫意思・未確定復唱 OK');
