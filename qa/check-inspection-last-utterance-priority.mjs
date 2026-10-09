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

for (const standard of [false, true]) {
  const s = session();
  if (standard) s.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
  const text = '日頃はお世話になり誠にありがとうございます、ヤリスの車検が近くなりましたがご都合はいかがでしょうか';
  const before = s.run('state.transcript.length');
  assert.equal(s.say(text).text, 'お願いしたいんですけど、いつできますか？');
  assert.equal(s.run('state.transcript.slice('+before+').filter(m=>m.role==="customer").length'), 1);
  assert.equal(s.run('inspectionConversationMetricAchieved("thanked_customer")'), true, '前半のお礼も採点に保持');
  assert.equal(s.run('inspectionConversationMetricAchieved("asked_availability")'), true);
  assert.equal(s.run('state.transcript.filter(m=>m.role==="staff").at(-1).text'), text, '原文を保持');

  const compound = session();
  if (standard) compound.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
  assert.match(compound.say('ヤリスの車検のご都合いかがでしょうか現在の走行距離は何キロですか').text, /今、3万キロ/);
  assert.equal(compound.run('inspectionConversationMetricAchieved("asked_availability")'), true);
  const reversed = session();
  if (standard) reversed.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
  assert.equal(reversed.say('現在の走行距離は何キロですかヤリスの車検のご都合いかがでしょうか').text, 'お願いしたいんですけど、いつできますか？');
  const concerns = session();
  if (standard) concerns.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
  assert.equal(concerns.say('ご都合はいかがでしょうかお車に気になるところはございますか').text, 'オイル交換もお願いしたいです。');
  const concernsFirst = session();
  if (standard) concernsFirst.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
  assert.equal(concernsFirst.say('お車に気になるところはございますかヤリスの車検のご都合はいかがでしょうか').text, 'お願いしたいんですけど、いつできますか？');
  const currentTurn = session();
  if (standard) currentTurn.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
  currentTurn.say('佐藤様でしょうか？');
  currentTurn.say('トヨタモビリティ帯広本別店の寺谷と申します');
  currentTurn.say('日頃はお世話になり誠にありがとうございます');
  assert.equal(currentTurn.say('ヤリスの車検が近くなりましたがご都合はいかがでしょうか').text, 'お願いしたいんですけど、いつできますか？');

  const call = session();
  if (standard) call.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
  call.say('佐藤様のお電話でしょうか？');
  assert.equal(call.say('トヨタモビリティ帯広本別店の寺谷と申します。今、お電話よろしいでしょうか？').text, '大丈夫ですよ。');
  assert.equal(call.run('inspectionConversationMetricAchieved("introduced_self")'), true);
  assert.equal(call.say('今、お電話よろしいでしょうか？ヤリスの車検のご都合はいかがでしょうか？').text, 'お願いしたいんですけど、いつできますか？');
}

const repeatedReason = session(2);
repeatedReason.say('9月10日9時30分はいかがでしょうか？');
repeatedReason.say('現在の走行距離は何キロですか？');
repeatedReason.say('車検以外のご用命や気になるところはございますか？');
repeatedReason.say('オイル交換も含めて1時間半でできます。店内でお待ちいただけます。');
const reasonText = repeatedReason.say('ご来店が難しい理由を教えていただけますか？').text;
assert.match(reasonText, /運転に自信/);
assert.equal(repeatedReason.say('引き取りをご希望ですね。ご来店が難しい理由を教えていただけますか？').text, reasonText);
assert.equal(repeatedReason.run('state.inspectionPickupPhase'), 'proposal');
assert.equal(repeatedReason.say('ご家族の方と一緒に来ることは可能ですか？').text, 'それなら、お店に持って行きます。');
assert.equal(repeatedReason.run('state.inspectionPickupOutcome'), 'visit');
assert.equal(repeatedReason.run('state.proposedAppointment.day'), '10');
console.log('複合発話: 最後の質問だけに一度回答し、原文と前半の達成を保持 OK');
