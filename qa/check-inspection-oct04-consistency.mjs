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

const reason = session(3);
reason.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="reason"');
assert.match(reason.say('もしよろしければ引き取りの理由などを教えていただきたかったのですが').text, /ほかのお店/);
assert.equal(reason.run('state.inspectionPickupPhase'), 'proposal');
assert.equal(reason.run('inspectionPickupReasonQuestion("引き取りの理由を教えていただきました")'), false, '過去の説明は質問ではない');

const duration = session();
assert.equal(duration.run('inspectionAppointmentProposalMatch("9月の30日10時半からご来店で1時間半車検できるのですがいかがでしょうか").hour'), '10');
assert.equal(duration.run('inspectionAppointmentProposalMatch("9月30日1時間半で作業できます")'), null);
assert.equal(duration.run('inspectionAppointmentProposalMatch("9月30日9時と10時はいかがですか")'), null);

const permission = session();
permission.run('state.inspectionPickupPhase="resolved"; state.inspectionPickupOutcome="visit"');
assert.equal(permission.say('9月の30日10時半で車検の方ご予約入れさせていただきますでは車検のご説明させていただきたかったのでもうこのまま少々お時間よろしいでしょうか').text, '大丈夫ですよ。');
assert.equal(permission.run('state.proposedAppointment.day'), '30', '通話了承と同じ発話の日時も保持する');
assert.equal(permission.say('9月30日10時半にご予約入れさせていただきますねあと代車のほうが必要でしょうか').text, 'お願いします。');
assert.equal(permission.run('state.inspectionLoanerRequested'), true);

const mileage = session(4);
mileage.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="proposal"; state.inspectionPickupReason="misunderstanding"');
assert.match(mileage.say('取りに来てもらえると聞いてたんですね申し訳ございませんご来店いただければありがたかったのですがヤリスの現在の走行距離って何キロ位に乗られてますか').text, /今、3万キロ/);
assert.equal(mileage.run('state.inspectionPickupPhase'), 'proposal', '距離回答だけで来店に同意しない');

const retained = session(2);
retained.say('9月の30日10時半はいかがでしょうか');
retained.say('引き取りの理由を教えていただけますか？');
assert.equal(retained.say('ご家族の方と一緒にご来店いただくのって可能ですか？').text, 'それなら、お店に持って行きます。');
assert.equal(retained.run('state.proposedAppointment.day'), '30');
const stepKey = retained.run('scenario.steps[state.scriptStep].key');
assert.notEqual(stepKey, 'proposed_appointment');
const documents = retained.say('車検証、自賠責保険証券、納税証明書をお持ちください。荷物は空の状態でお願いします。');
assert.notEqual(documents.text, 'では、その日でお願いします。', '日時承諾を後の書類案内で発話しない');
assert.notEqual(documents.text, '具体的な日時を教えてください。');
console.log('10月2・3日再現: 最後の質問・柔らかい理由質問・作業時間と予約時刻・候補保持 OK');
