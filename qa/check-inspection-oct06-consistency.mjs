import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function session(seed = 2) {
  const context = { window: {}, document: { querySelector: () => ({ textContent: '' }) }, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../scenario.js', import.meta.url), 'utf8'), context);
  vm.runInContext(source.slice(0, source.indexOf('els.startButton.addEventListener')), context);
  vm.runInContext(`
    scenario = window.VEHICLE_INSPECTION_PICKUP_SCENARIO;
    state.variantSeed = ${seed}; state.started = true;
    renderProgress = () => {};
    continueSpeechInputWithoutCustomerReply = () => {};
    finishRoleplay = () => { state.ended = true; };
    addMessage = (role, text, options = {}) => { state.transcript.push({ role, text, audioId: options.audioId }); options.onCommitted?.(); };
  `, context);
  return {
    context,
    run(code) { return vm.runInContext(code, context); },
    say(text) {
      context.input = text;
      vm.runInContext('state.transcript.push({role:"staff", text:input}); handleScriptedStaffReply(input)', context);
      return vm.runInContext('state.transcript.at(-1)', context);
    }
  };
}

const opening = session(2);
assert.equal(opening.say('いつも日頃はお世話になっております。私、トヨタモビリティ帯広本別店の原田といいます。本日、車検のご案内でお電話しました。お時間少しよろしかったですか？').text, '大丈夫ですよ。');
assert.equal(opening.run('hasInspectionAvailabilityRequest("8月1日から整備の方可能なんですが、いつごろよろしいですか？")'), true);
assert.equal(opening.run('hasInspectionAvailabilityRequest("8月1日から整備できます")'), false);
opening.say('8月1日から整備の方可能なんですが、いつごろよろしいですか？');
assert.equal(opening.run('inspectionConversationMetricAchieved("asked_availability")'), true);

const reason = session(2);
reason.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="reason"');
assert.match(reason.say('引き取りのご希望ですね。こちらに来れない理由なんか、教えていただければ助かるんですが。').text, /運転に自信/);
reason.say('佐藤さん、それでは9月の10日の9時30分はいかがでしょうか。');
assert.equal(reason.say('誰かご家族の方と一緒に来ることは可能ですか？').text, 'それなら、お店に持って行きます。');
assert.equal(reason.run('state.inspectionPickupOutcome'), 'visit');
assert.equal(reason.run('state.proposedAppointment.day'), '10');
assert.notEqual(reason.say('9月の10日9時30分はよろしかったですか？').text, '具体的な日時を教えてください。');

const distance = session(1);
distance.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="location"; state.inspectionPickupOutcome="pickup"; state.inspectionPickupReason="distance"');
distance.say('1時間半で作業できます');
assert.equal(distance.say('店近くの札内店で作業できるんですがいかがですか').text, 'はい。');
assert.equal(distance.run('state.inspectionPickupOutcome'), 'pickup');
distance.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="confirmation"; state.inspectionPickupOutcome="pickup"; state.inspectionPickupReason="distance"');
assert.equal(distance.say('9月の30日10時半から来ていただいてもいいですか').text, '今回は引き取りでお願いしたいです。');
assert.equal(distance.run('state.inspectionPickupOutcome'), 'pickup');
assert.equal(distance.run('state.inspectionPickupPhase'), 'confirmation');
const responses = distance.run('state.transcript.filter(m=>m.role==="customer").length');
distance.say('来店してもらえたらうれしいんですがいかがですか');
assert.equal(distance.run('state.transcript.filter(m=>m.role==="customer").length'), responses, '同じ訂正を繰り返さない');
assert.equal(distance.say('ご家族と一緒に来ることは可能ですか？').text, 'それなら、お店に持って行きます。');
assert.equal(distance.run('state.inspectionPickupOutcome'), 'visit');

const pickup = session();
pickup.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="resolved"; state.inspectionPickupOutcome="pickup"; state.inspectionPickupActive=false; state.proposedAppointment={month:"9",day:"30",hour:"10",minute:0}');
assert.equal(pickup.say('店でお待ちいただけませんか？').text, '今回は引き取りでお願いしたいです。');
assert.equal(pickup.run('state.inspectionPickupOutcome'), 'pickup');
pickup.say('6月の30日10時に行きますのでよろしくお願いします');
assert.equal(pickup.run('state.proposedAppointment.month'), '9', '誤った復唱で予約月を上書きしない');
assert.equal(pickup.run('inspectionConversationMetricAchieved("recapped_appointment")'), false);

const mileage = session();
assert.match(mileage.say('かしこまりました、ヤリスの走行距離どのくらい乗れてます').text, /今、3万キロ/);
assert.equal(mileage.run('asksCurrentMileage("走行距離は3万キロです")'), false);
assert.equal(mileage.say('このまま少々お時間いただいていいですか').text, '大丈夫ですよ。');
const far = session(1);
far.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="proposal"; state.inspectionPickupReason="distance"');
assert.equal(far.say('遠くて持って行くのが大変なのですね。9月20日10時にご来店いただけますか？').text, '今回は引き取りでお願いしたいです。');
assert.equal(far.run('state.inspectionPickupOutcome'), 'pickup');
assert.equal(far.run('inspectionConversationMetricAchieved("pickup_circumstance_acknowledged")'), true);
assert.equal(far.say('お車の引取場所はどちらになりますか？').text, '自宅に取りに来てもらえますか？');
assert.equal(far.run('state.inspectionPickupPhase'), 'confirmation');
assert.equal(far.say('かしこまりました。ご自宅への引き取りを承ります。').text, 'はい、お願いします。');
far.say('9月20日10時にご自宅へ引き取りに伺う予定で、いかがでしょうか？');
far.say('変更して9月21日10時30分にご自宅へ引き取りに伺う予定ではいかがでしょうか？');
assert.equal(far.run('state.proposedAppointment.day'), '21');
assert.equal(far.run('state.proposedAppointment.minute'), 30);
for (const [text, expected] of [
  ['佐藤様、9月21日10時30分にご自宅へ引き取りに伺うご予約です。よろしくお願いいたします。', true],
  ['佐藤様、9月20日10時30分にご自宅へ引き取りに伺うご予約です。', false],
  ['佐藤様、9月21日10時にご自宅へ引き取りに伺うご予約です。', false],
  ['佐藤様、9月21日10時30分にご来店のご予約です。お待ちしております。', false],
  ['9月21日10時30分にご自宅へ引き取りに伺うご予約です。', false]
]) {
  far.context.recapInput=text;
  assert.equal(far.run('hasConfirmedInspectionAppointmentRecap(recapInput)'),expected,text);
}
const directLocation = session(1);
directLocation.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="proposal"; state.inspectionPickupReason="distance"');
assert.equal(directLocation.say('お車の引取場所はどちらになりますか？').text, '自宅に取りに来てもらえますか？');
assert.equal(directLocation.run('state.inspectionPickupPhase'), 'confirmation');
console.log('10月6日再現: 引取・来店整合性、通話可否、都合確認、理由質問、日時保持、誤復唱未達 OK');
