import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function inspectionConversationMetricAchieved");
const end = source.indexOf("function buildImprovementTalk", start);
assert.notEqual(start, -1, "会話全体の最終達成判定がありません");
assert.notEqual(end, -1, "会話全体の最終達成判定の終端がありません");

const normalize = (text) => String(text || "")
  .replace(/\s+/g, "")
  .replace(/９/g, "9")
  .replace(/８/g, "8")
  .replace(/３０/g, "30")
  .replace(/一時間半/g, "90分");
const context = {
  state: { transcript: [], analyses: [], inspectionLoanerRequested: false, inspectionMileageAsked: false },
  scenario: {
    customerName: "佐藤様",
    vehicleName: "ヤリス",
    expiryDate: "9月30日",
    steps: [],
    scoring: []
  },
  normalizeScriptedText: normalize,
  hasInspectionSelfIntroduction: (text) => /トヨタモビリティ.*(?:申します|でございます)/.test(text),
  hasCourtesyExpression: (text) => /(?:いつも|日頃).*(?:お世話になって(?:おります|います|ます)|ありがとう)/.test(text),
  hasInspectionAvailabilityRequest: (text) => /(?:都合|予定).*(?:教えて|お決まり|いかが)/.test(text),
  asksCurrentMileage: (text) => /(?:走行距離|何キロ).*(?:でしょうか|ますか)/.test(text),
  hasSupportedInspectionDuration: (text) => /(?:90分|1時間半)/.test(text),
  hasInspectionLoanerConfirmation: (text, implicit = false) => {
    const normalized = normalize(text);
    const hasLoaner = /代車/.test(normalized) || implicit;
    return hasLoaner && /(?:用意|手配).*(?:します|いたします|させていただきます)/.test(normalized);
  },
  asksInspectionWaitingMethodConfirmation: (text) => /(?:店内|お店).*(?:待).*(?:ますか|でしょうか)/.test(text),
  hasInspectionWaitingChoiceOffer: (text) => /(?:店内|お店).*(?:待).*(?:可能|できます)/.test(text),
  asksInspectionVehicleConcerns: () => false,
  hasInspectionDocumentGuidance: () => false,
  hasLockNutToolExpression: () => false,
  hasInspectionReminderContactConfirmation: () => false,
  hasExplicitBookingContinuationConfirmation: (text) => /(?:予約|手続き).*(?:時間|よろしい|大丈夫)/.test(text),
  inspectionAppointmentProposalMatch: (text) => /\d{1,2}月\d{1,2}日.*\d{1,2}時/.test(text)
    ? { month: 9, day: 5, hour: 10, minute: 30 }
    : null,
  hasInspectionAppointmentProposalEvidence: (text) => /\d{1,2}月\d{1,2}日.*\d{1,2}時.*(?:いかが|どう)/.test(text),
  hasScriptedAppointmentRecapEvidence: (text) => /佐藤.*\d{1,2}月\d{1,2}日.*\d{1,2}時/.test(text),
  isInspectionFinalClosingThanks: (text) => /ありがとうございました/.test(text)
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

context.state.transcript = [
  { role: "staff", text: "佐藤様のご都合の良い日を教えていただければと思います。" },
  { role: "staff", text: "現在の走行距離は何キロくらいでしょうか。" },
  { role: "customer", text: "今、3万キロくらいです。" },
  { role: "staff", text: "作業時間は一時間半ほどです。" },
  { role: "staff", text: "店内でお待ちいただけますか。" },
  { role: "customer", text: "代車を用意してほしいんですが、できますか？" },
  { role: "staff", text: "かしこまりました。代車をご用意いたします。" }
];
assert.equal(context.inspectionConversationMetricAchieved("asked_availability"), true);
assert.equal(context.inspectionConversationMetricAchieved("explained_duration_and_wait"), true);
assert.equal(context.inspectionConversationMetricAchieved("explained_loaner"), true);

context.state.transcript = [
  { role: "staff", text: "恐れ入ります。佐藤様のお電話でしょうか。" },
  { role: "staff", text: "9月5日午前10時30分はいかがでしょうか。" },
  { role: "customer", text: "では、その時間でお願いします。" },
  { role: "staff", text: "このまま予約手続きを進めます。10分ほどお時間よろしいでしょうか。" },
  { role: "staff", text: "佐藤様、9月5日午前10時30分にお待ちしております。" }
];
assert.equal(context.inspectionConversationMetricAchieved("confirmed_identity"), true);
assert.equal(context.inspectionConversationMetricAchieved("proposed_appointment"), true);
assert.equal(context.inspectionConversationMetricAchieved("confirmed_booking_time"), true);
assert.equal(context.inspectionConversationMetricAchieved("recapped_appointment"), true);

context.state.transcript = [
  { role: "staff", text: "本日は佐藤様がお乗りのヤリスの車検のご案内でお電話しました。" },
  { role: "customer", text: "車検はいつまでですか？" },
  { role: "staff", text: "車検満了日は9月30日です。" }
];
assert.equal(
  context.inspectionConversationMetricAchieved("explained_inspection_notice"),
  true,
  "別発話の車種・車検用件・満了日を合算できません"
);

context.state.transcript = [
  { role: "staff", text: "いつもお世話になってます。" }
];
assert.equal(
  context.inspectionConversationMetricAchieved("thanked_customer"),
  true,
  "口語の『お世話になってます』を日頃のお礼にできません"
);

context.scenario.scoring = [
  { key: "asked_availability", label: "都合", action: "都合を確認する", points: 5 },
  { key: "explained_duration_and_wait", label: "時間", action: "時間を説明する", points: 7 }
];
context.state.inspectionMileageAsked = true;
context.state.transcript = [
  { role: "staff", text: "ご都合の良い日を教えていただければと思います。" },
  { role: "staff", text: "現在の走行距離は何キロくらいでしょうか。" },
  { role: "staff", text: "作業時間は90分です。" },
  { role: "staff", text: "店内でお待ちいただけますか。" }
];
context.state.analyses = [
  { scripted: true, stepKey: "asked_availability", asked_availability: false, blocked: true },
  { scripted: true, stepKey: "explained_duration_and_wait", explained_duration_and_wait: false, blocked: true }
];
const result = context.scoreScriptedRoleplay();
assert.equal(result.score, 100, "後の発話で達成した項目に古い聞き返し減点が残っています");
assert.equal(result.improve.some((item) => item.includes("聞き返し")), false);

console.log("車検誘致・3会話の会話全体採点テスト: OK");
