import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function normalizeScriptedText");
const questionEnd = appSource.indexOf("function scriptedStepSpecificMatches", helperStart);
assert.notEqual(helperStart, -1, "車検誘致用の正規化関数が見つかりません");
assert.notEqual(questionEnd, -1, "予約手続き確認判定関数の終端が見つかりません");

const source = appSource.slice(helperStart, questionEnd);
const questionStart = source.indexOf("function isScriptedQuestion");
const bookingStart = source.indexOf("function hasBookingContinuationConfirmation");
assert.notEqual(questionStart, -1, "質問文判定関数が見つかりません");
assert.notEqual(bookingStart, -1, "予約手続き確認判定関数が見つかりません");

const context = {};
vm.createContext(context);
vm.runInContext(
  `${source.slice(0, source.indexOf("function analyzeScriptedStaff"))}\n${source.slice(questionStart)}`,
  context
);
const affirmativeStart = appSource.indexOf("function isAffirmativeScriptedReply");
const affirmativeEnd = appSource.indexOf("function combinedScriptedReply", affirmativeStart);
assert.notEqual(affirmativeStart, -1, "肯定回答判定が見つかりません");
assert.notEqual(affirmativeEnd, -1, "肯定回答判定の終端が見つかりません");
vm.runInContext(appSource.slice(affirmativeStart, affirmativeEnd), context);

for (const phrase of [
  "予約手続きに10分程度かかりますがよろしいでしょうか？",
  "もう少しお時間ありますか？",
  "もう少しお時間ございますでしょうか？",
  "お時間をいただいてもよろしいですか？",
  "このまま予約を進めてもよろしいですか？",
  "このままご役を進めさせていただいてもよろしいでしょうか？",
  "予約のお手続きを続けても大丈夫ですか？",
  "よろしければご予約をいただければと思いますが、いかがでしょうか？"
]) {
  assert.equal(context.hasBookingContinuationConfirmation(phrase), true, `${phrase}を了承確認として認識できません`);
}

for (const phrase of [
  "予約手続きには10分かかります。",
  "もう少しです。",
  "お時間です。",
  "大丈夫です。",
  "ご予約いただければ、代車の方はご用意できる？できます。"
]) {
  assert.equal(context.hasBookingContinuationConfirmation(phrase), false, `${phrase}を了承確認として誤認識しています`);
}

assert.match(
  scenarioSource,
  /key:\s*"confirmed_booking_time"[\s\S]*?requiredGroups:\s*\[\["10分",\s*"十分",\s*"もう少し"/,
  "予約手続き確認の言い換えがシナリオ条件へ登録されていません"
);

assert.match(
  appSource,
  /step\.key === "confirmed_booking_time"[\s\S]*?return hasBookingContinuationConfirmation\(normalized\)/,
  "Firestoreの旧必須語が残っていても予約続行確認を優先する処理が見つかりません"
);

assert.match(
  appSource,
  /answeredCustomerBookingAvailability = step\.key === "confirmed_booking_time"[\s\S]*?isAffirmativeBookingAvailabilityReply\(text\)[\s\S]*?inspection-retry:confirmed_booking_time:general/,
  "お客様の予約可否質問への肯定回答を認識できません"
);
for (const phrase of [
  "はい。",
  "大丈夫ですよ。",
  "はい。このまま予約できます。",
  "このままご予約可能です。"
]) {
  assert.equal(
    context.isAffirmativeBookingAvailabilityReply(phrase),
    true,
    `${phrase}を予約可否への肯定回答として認識できません`
  );
}
for (const phrase of [
  "このまま予約できますか？",
  "このまま予約できません。",
  "予約できるか確認します。"
]) {
  assert.equal(
    context.isAffirmativeBookingAvailabilityReply(phrase),
    false,
    `${phrase}を予約可否への肯定回答として誤認識しています`
  );
}
assert.match(
  appSource,
  /answeredCustomerBookingAvailability[\s\S]*?!analysis\.passed[\s\S]*?analysis\.canAdvance = true[\s\S]*?予約手続き時間の確認は未達/,
  "予約可否への肯定回答を未達のまま日時調整へ進められません"
);
assert.match(
  appSource,
  /answeredCustomerBookingAvailability[\s\S]*?text:\s*"具体的な日時を教えてください。"[\s\S]*?audioId:\s*"inspection_proposed_appointment_retry"/,
  "予約可否への肯定回答後に具体的な日時だけを確認できません"
);
assert.match(
  appSource,
  /step\.key === "proposed_appointment"[\s\S]*?hasExplicitBookingContinuationConfirmation\(text\)[\s\S]*?markScriptedStepPassed\(bookingTimeStep, text\)[\s\S]*?addMessage\("customer", "大丈夫ですよ。"[\s\S]*?audioId: "inspection_confirmed_booking_time_customer"[\s\S]*?return;/,
  "日時提案待ちで予約手続き時間を確認した場合に『大丈夫ですよ。』へ回収する処理が見つかりません"
);
assert.match(
  audioDbSource,
  /inspection_proposed_appointment_retry",\s*"予約日時提案・聞き返し",\s*"具体的な日時を教えてください。"/,
  "日時確認の表示文と音声登録文が一致していません"
);
assert.match(
  audioDbSource,
  /inspection_confirmed_booking_time_customer",\s*"予約時間確認・お客様回答",\s*"大丈夫ですよ。"/,
  "予約手続き時間了承の表示文と音声登録文が一致していません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_proposed_appointment_retry.mp3", import.meta.url)),
  true,
  "具体的な日時確認のMP3が見つかりません"
);

console.log("予約手続き確認の言い換え判定テスト: OK");
