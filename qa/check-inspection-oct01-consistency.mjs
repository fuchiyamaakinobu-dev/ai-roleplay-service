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

const scoring = session();
assert.equal(scoring.run('asksInspectionIdentityConfirmation("もしもし、佐藤さんのお電話ですか？")'), true);
assert.equal(scoring.run('asksInspectionIdentityConfirmation("お客様のお電話ですか？")'), false);
assert.equal(scoring.run('hasCourtesyExpression("日ごろからお世話になっておりましてありがとうございます")'), true);
assert.equal(scoring.run('hasCourtesyExpression("ありがとうございます")'), false);

const booking = session();
booking.run('state.inspectionPickupPhase="resolved"; state.inspectionPickupOutcome="visit"');
booking.say('ありがとうございますではお店のほうにご来店いただければと思いますでお日にちなんですが9月30日10時半はいかがでしょうか');
assert.ok(booking.run('state.proposedAppointment'), '10月1日880981の完全な日時を保持できない');
booking.say('では9月の30日午前10時半にご来店でご予約入れさせていただきますね');
const guidance = booking.say('あとロックナットでタイヤを閉めている場合はロックナット外す工具をご用意くださいあと受付に時間が必要になりますので15分前のご来店をお願いします');
assert.notEqual(guidance.text, '具体的な日時を教えてください。');
assert.equal(booking.run('Number(state.proposedAppointment.minute)'), 30);

const preference = session();
assert.equal(preference.run('asksInspectionDayPreference("13日の日曜日9時30分はいかがですか？")'), false);
assert.equal(preference.run('asksInspectionDayPreference("12日の土曜日ではいかがですか？")'), false);
assert.equal(preference.run('asksInspectionDayPreference("平日と土日ではどちらがよろしいですか？")'), true);
assert.equal(preference.run('isInspectionOperationalNoiseUtterance("なんで？")'), true);
assert.equal(preference.run('isInspectionOperationalNoiseUtterance("満了日なんですが9月30日です")'), false);
preference.run('state.inspectionPickupPhase="resolved"; state.inspectionPickupOutcome="visit"');
preference.say('平日と土日ではどちらがよろしいですか？');
for (const text of ['13日の日曜日9時30分はいかがですか？', 'それでは日曜日ご予約できますがよろしいですか？', '12日の土曜日ではいかがですか？']) {
  assert.notEqual(preference.say(text).text, '土日がいいです。', text);
}

const driving = session();
driving.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="location"; state.inspectionPickupOutcome="pickup"; state.inspectionPickupReason="driving"');
assert.equal(driving.say('お店でお待ちいただいて1時間半でできる車検ができるのですがご来店いただけないでしょうか').text, '今回は引き取りでお願いしたいです。');
assert.equal(driving.run('state.inspectionPickupOutcome'), 'pickup');
const replyCount = driving.run('state.transcript.filter(x=>x.role==="customer").length');
driving.say('90分でできますが、ご来店いただけますか？');
assert.equal(driving.run('state.transcript.filter(x=>x.role==="customer").length'), replyCount, '引取希望の訂正を繰り返さない');
driving.say('ご家族と一緒にご来店いただけますか？');
assert.equal(driving.run('state.inspectionPickupOutcome'), 'visit');

scoring.say('もしもし、佐藤さんのお電話ですか？');
scoring.say('私トヨタモビリティ帯広本別店の寺谷と申します日ごろからお世話になっておりましてありがとうございます');
assert.equal(scoring.run('inspectionConversationMetricAchieved("confirmed_identity")'), true);
assert.equal(scoring.run('inspectionConversationMetricAchieved("thanked_customer")'), true);

const standard = session();
standard.run('scenario=window.VEHICLE_INSPECTION_SCENARIO');
standard.say('お日にちなんですが9月30日10時半はいかがでしょうか');
assert.ok(standard.run('state.proposedAppointment'));
assert.equal(standard.run('state.inspectionPickupPhase'), null);

console.log('2026-10-01 実施ログ再現: 本人確認・感謝・予約保持・曜日候補・運転不安 OK');

const combined = session(3);
combined.run('state.inspectionPickupPhase="resolved"; state.inspectionPickupOutcome="visit"; state.inspectionLoanerRequested=true');
assert.equal(combined.say('かしこまりました代車の方ご用意しておきます。佐藤様車検の他に何か気になるところございませんか？').text, 'オイル交換もお願いしたいです。');
assert.equal(combined.run('state.inspectionLoanerConfirmed'), true);
assert.equal(combined.say('ありがとうございますちょっと今走行距離をお伺いしたんですけども乗ってて気になるところとかございませんか').text, 'そのほかは大丈夫です。');
assert.equal(combined.say('いつもお世話になっております。私、トヨタモビリティ帯広本別店の原田といいます。日頃はヤリスの方、ご利用いただきありがとうございます。今、お電話よろしかったですか？').text, '大丈夫ですよ。');

const mixedDate = session(3);
mixedDate.run('state.inspectionPickupPhase="resolved"; state.inspectionPickupOutcome="visit"');
assert.equal(mixedDate.say('佐藤様、8月1日以降作業可能なんですが、もしよろしければ9月17日午前10時半から作業できますがいかがでしょうか？').text, 'では、その日でお願いします。');
assert.equal(mixedDate.run('state.proposedAppointment.day'), '17');
assert.equal(mixedDate.say('オイル交換もさせていただきますね。オイル交換も含めて1時間半ほどでできると思います。9月30日10時半から作業できるのですがいかがでしょうか').text, 'では、その日でお願いします。');
assert.equal(mixedDate.run('state.proposedAppointment.day'), '30');
mixedDate.say('12日の土曜日ではいかがですか？');
assert.equal(mixedDate.run('state.proposedAppointment.day'), '12');
mixedDate.say('11時ではいかがでしょうか？');
assert.equal(mixedDate.run('state.proposedAppointment.hour'), '11');
assert.equal(mixedDate.run('Number(state.proposedAppointment.minute)'), 0);
mixedDate.say('車検の3日前に確認のご連絡をします。この携帯番号でよろしいでしょうか？');
assert.equal(mixedDate.run('state.proposedAppointment.day'), '12', '3日前を予約日と誤認しない');
mixedDate.say('最後に復唱いたします。佐藤様、9月13日10時半にご来店でお待ちしております。');
assert.equal(mixedDate.run('state.proposedAppointment.day'), '12', '誤った最終復唱で変更しない');
mixedDate.say('6月30日10時半はいかがでしょうか？');
assert.equal(mixedDate.run('state.proposedAppointment.month'), '9', '作業可能日より前へ変更しない');

const namedStore = session(2);
assert.equal(namedStore.run('asksInspectionCallTimingPermission("今日お電話したのは車検のご案内です。8月1日以降作業可能ですがご都合いかがでしょうか")'), false);
assert.equal(namedStore.run('inspectionPickupProposalEvidence("かしこまりましたそれでしたら近くに札内店と言う店舗がございますのでそちらのほうにお車ご来店いただくことって可能でしょうか", "driving").alternative'), true);
assert.equal(namedStore.run('inspectionPickupProposalEvidence("近くでオイル交換できます", "driving").alternative'), false);

const candidate = session(0);
candidate.say('佐藤様、9月30日10時半はいかがでしょうか？');
assert.equal(candidate.run('state.proposedAppointment'), null, '引取相談前の候補を予約確定しない');
assert.equal(candidate.run('state.inspectionAppointmentCandidate.day'), '30');
candidate.say('引き取りをご希望の理由を教えていただけますか？');
candidate.say('引き取りに伺います。');
candidate.say('かしこまりました。自宅へ伺います。');
assert.equal(candidate.run('state.inspectionPickupPhase'), 'resolved');
assert.equal(candidate.run('state.proposedAppointment.day'), '30', '受付確認後に候補日時を確定する');

const unresolved = session(2);
unresolved.run('state.inspectionPickupActive=true; state.inspectionPickupPhase="location"; state.inspectionPickupOutcome="pickup"; state.inspectionPickupReason="driving"');
assert.equal(unresolved.say('ご来店の際、車検証をお持ちください。').text, '今回は引き取りでお願いしたいです。');
assert.equal(unresolved.run('state.inspectionPickupOutcome'), 'pickup');
console.log('過去ログの追加修正: 複合質問・日時再提案・候補保持・店舗名・引取相談中の矛盾 OK');
