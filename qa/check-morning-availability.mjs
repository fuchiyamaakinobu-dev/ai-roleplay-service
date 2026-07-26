import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function nextQuestionVariant(");
const analysisEnd = source.indexOf("function collectEvidence(", start);
const timeSelectionStart = source.indexOf("function selectAppointmentTimeOption(");
const timeSelectionEnd = source.indexOf("function selectObjection(", timeSelectionStart);
const followUpStart = source.indexOf("function appointmentFollowUpTurn(");
const followUpEnd = source.indexOf("function selectContextualCustomerResponse(", followUpStart);

assert.notEqual(start, -1, "午前中提案の判定関数が見つかりません");
assert.notEqual(analysisEnd, -1, "スタッフ発話の解析関数を切り出せません");
assert.notEqual(timeSelectionStart, -1, "時刻候補の選択関数が見つかりません");
assert.notEqual(timeSelectionEnd, -1, "時刻候補の選択関数を切り出せません");
assert.notEqual(followUpStart, -1, "日時確認の応答関数が見つかりません");
assert.notEqual(followUpEnd, -1, "日時確認の応答関数を切り出せません");

const context = {
  state: {
    appointmentDateConfirmed: true,
    analyses: [],
    questionRepeats: {}
  },
  scenario: {
    audio: {
      appointmentMorningNeedTime: "appointmentMorningNeedTime",
      followUps: []
    }
  },
  lexicon: new Proxy({}, { get: () => [] }),
  includesAny(text, words = []) {
    return words.some((word) => text.includes(word));
  },
  isActivePickupRequest() {
    return false;
  },
  collectEvidence() {
    return [];
  },
  decide() {
    return "continue";
  },
  confidenceFor() {
    return 1;
  },
  pickVariant() {
    return "earlier";
  },
  customerTurn(text, audioId) {
    return { text, audioId };
  }
};
vm.createContext(context);
vm.runInContext(`
  ${source.slice(start, analysisEnd)}
  ${source.slice(timeSelectionStart, timeSelectionEnd)}
  ${source.slice(followUpStart, followUpEnd)}
  this.isMorningTimeBandOffer = isMorningTimeBandOffer;
  this.analyzeStaff = analyzeStaff;
  this.selectAppointmentTimeOption = selectAppointmentTimeOption;
  this.appointmentFollowUpTurn = appointmentFollowUpTurn;
`, context);

const offered = [
  ["午前中が空いています", false],
  ["午前中に空きがあります", false],
  ["午前中はいかがですか", true],
  ["日曜日の午前中が空いております", false]
];

for (const [text, isQuestion] of offered) {
  assert.equal(
    context.isMorningTimeBandOffer(text, isQuestion),
    true,
    `肯定的な午前中提案を認識できません: ${text}`
  );
}

const denied = [
  ["午前中は空いていません", false],
  ["午前中の空きはありません", false],
  ["午前中は予約できません", false],
  ["午前中は難しいです", false],
  ["午前中は空いていませんか？", true]
];

for (const [text, isQuestion] of denied) {
  assert.equal(
    context.isMorningTimeBandOffer(text, isQuestion),
    false,
    `否定的な午前中表現を提案として認識しました: ${text}`
  );
}

assert.equal(
  context.isMorningTimeBandOffer("午前中と午後ならどちらが空いていますか", true),
  false,
  "午前・午後の選択質問を午前中だけの提案として認識しました"
);

const positiveAnalysis = context.analyzeStaff("午前中が空いています");
const response = context.appointmentFollowUpTurn(positiveAnalysis);
assert.equal(positiveAnalysis.offered_morning_time_band, true);
assert.deepEqual(
  response,
  {
    text: "では、午前中でお願いします。何時が空いていますか？",
    audioId: "appointmentMorningNeedTime"
  },
  "肯定的な午前中の空き案内から、具体的な時刻確認へ進みません"
);
const repeatedResponse = context.appointmentFollowUpTurn(positiveAnalysis);
assert.deepEqual(
  repeatedResponse,
  {
    text: "何時が空いていますか？",
    audioId: "appointmentMorningTimeRepeat"
  },
  "同じ午前中確認を繰り返さず、自然な再確認へ切り替えられません"
);
const specificResponse = context.appointmentFollowUpTurn(positiveAnalysis);
assert.deepEqual(
  specificResponse,
  {
    text: "午前中の何時が空いていますか？",
    audioId: "appointmentMorningTimeSpecific"
  },
  "3回目の確認を具体的な時刻質問へ切り替えられません"
);

const negativeAnalysis = context.analyzeStaff("午前中は空いていません");
assert.equal(
  negativeAnalysis.offered_morning_time_band,
  false,
  "否定表現を午前中の提案として解析しました"
);

const multipleTimeAnalysis = context.analyzeStaff(
  "午前中ですと10時、お昼からですと４時に空きがあります"
);
assert.equal(multipleTimeAnalysis.has_multiple_schedule_times, true);
assert.deepEqual(
  [...multipleTimeAnalysis.schedule_time_options],
  ["10時", "16時"],
  "スタッフ発話の解析で10時・16時の複数候補になりません"
);
const selectedTimeResponse = context.selectAppointmentTimeOption(multipleTimeAnalysis);
assert.deepEqual(
  selectedTimeResponse,
  {
    text: "では、早いほうでお願いします。",
    audioId: "appointmentEarlierTime"
  },
  "10時・16時の候補から早い時刻を選ぶ返答へ進みません"
);
assert.equal(context.state.appointmentTime, "10時");

console.log("午前中の肯定提案・否定表現の判定テスト: OK");
