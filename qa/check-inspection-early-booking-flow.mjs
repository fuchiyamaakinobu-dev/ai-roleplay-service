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
for (const variant of ['30000','over60000','120000']) for (const early of [true,false]) {
  const s=session(variant);
  s.say('8月1日以降作業が可能ですが、ご都合はいかがでしょうか？');
  const book=()=>{
    assert.equal(s.say('8月1日以降いつでも大丈夫なので、8月の30日はいかがでしょうか？'),'何時が空いていますか？');
    s.say('今ですと何時でも大丈夫なんですが、朝一の9時半はいかがでしょう？');
    s.say('9時30分はいかがでしょうか。');
    s.say('ありがとうございます。では、8月30日の9時半でご予約の方入れますね。');
  };
  if(early) {
    book();
    assert.equal(s.run('state.inspectionPickupPhase'),null,'途中の予約案内を最終復唱と誤認しない');
    assert.equal(s.run('state.proposedAppointment'),null,'受付方法は未調整');
  }
  s.say('ちなみに今、何キロぐらい走られていらっしゃいますでしょうか。');
  assert.equal(s.say('基本作業だけですと一時間半ぐらいなんですが。ええ？車検以外の作業？ええ、追加整備などはございますでしょうか？'),'オイル交換もお願いしたいです。');
  assert.equal(s.say('オイル交換もですね。その他は大丈夫でしょうか？'),'そのほかは大丈夫です。');
  const waiting='その内容ですと、一時間ちょっとぐらいで作業は完了するかと思いますが、洗車を含めましても一時間半で終了すると思います。工場でお待ちいただくことはできますでしょうか。';
  if(variant==='30000') assert.equal(s.say(waiting),'できれば、車を取りに来てもらえませんか？');
  else {
    s.say(waiting);
    assert.equal(s.run('state.inspectionPickupActive'),false,'多走行を待ち車検で進めない');
    s.say(variant==='over60000'?'ワンデー車検で1日お預かりします。':'お車をお預かりして整備します。');
    assert.equal(s.say('代車をご用意します。'),'できれば、車を取りに来てもらえませんか？');
  }
  s.say('ご来店が難しい理由を教えていただけますか？');
  s.say('近くの札内店へのご来店はいかがでしょうか？');
  if(!early) book();
  assert.equal(s.run('state.proposedAppointment.day'),'30');
  assert.equal(s.run('state.proposedAppointment.minute'),30);
  s.say('車検証、自賠責保険証券、納税証明書をお持ちください。荷物は空にしてください。');
  s.say('では、9月30日朝9時半で車検のご予約を入れておきます。よろしくお願いいたします。');
  s.say('本日はありがとうございました。');
  assert.equal(s.run('state.ended'),true);
  assert.ok(s.run('state.analyses.some(x=>x.appointmentRecapCheck && x.dateMismatch)'), '日付不一致を記録');
  assert.equal(s.run('state.transcript.filter(x=>x.role==="customer" && x.text==="できれば、車を取りに来てもらえませんか？").length'),1,'引取依頼は一度だけ');
}
console.log('直近会話再現：日時先行/後行×3距離、追加整備、引取依頼、終話・日付採点 OK');
