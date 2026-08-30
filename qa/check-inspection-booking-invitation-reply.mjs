import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const durationProgressStart = appSource.indexOf("function isInspectionDurationProgressAcknowledgement");
const durationProgressEnd = appSource.indexOf("function hasInspectionBookingInvitation", durationProgressStart);
assert.notEqual(durationProgressStart, -1, "作業時間質問へ進むお礼判定が見つかりません");
assert.notEqual(durationProgressEnd, -1, "作業時間質問へ進むお礼判定の終端が見つかりません");
const durationProgressContext = {};
vm.createContext(durationProgressContext);
vm.runInContext(appSource.slice(durationProgressStart, durationProgressEnd), durationProgressContext);
assert.equal(
  durationProgressContext.isInspectionDurationProgressAcknowledgement("ありがとうございます。"),
  true,
  "予約意思確認後の『ありがとうございます。』から自然な作業時間質問へ進めません"
);
assert.equal(
  durationProgressContext.isInspectionDurationProgressAcknowledgement("基本作業は90分です。"),
  false,
  "作業時間を案内済みの発話を進行用のお礼として誤認識しています"
);

const helperStart = appSource.indexOf("function hasInspectionBookingInvitation");
const helperEnd = appSource.indexOf("function scriptedRequiredGroupsMatch", helperStart);
assert.notEqual(helperStart, -1, "電話予約提案の判定関数が見つかりません");
assert.notEqual(helperEnd, -1, "電話予約提案の判定関数の終端が見つかりません");
const context = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text)
};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

assert.equal(
  context.hasInspectionBookingInvitation("よろしければこのお電話でご予約できますが、いかがでしょうか？"),
  true,
  "この電話での予約提案を都合確認として認識できません"
);
assert.equal(
  context.hasInspectionBookingInvitation("ご予約はいかがでしょうか？"),
  true,
  "短い予約提案を都合確認として認識できません"
);
assert.equal(
  context.hasInspectionBookingInvitation("車検の方はお決まりでしたでしょうか？"),
  true,
  "『お決まり』を車検の予約意思確認として認識できません"
);
assert.equal(
  context.hasInspectionBookingInvitation("車検はもう決められましたか？"),
  true,
  "『決められましたか』を車検の予約意思確認として認識できません"
);
assert.equal(
  context.hasInspectionBookingInvitation(
    "お使いのヤリスの車検満了日は9月30日で、8月1日以降作業可能です。ご予定はお決まりでしたでしょうか？"
  ),
  true,
  "車検時期と『ご予定はお決まり』をまとめた発話を予約意思確認として認識できません"
);
assert.equal(
  context.hasInspectionBookingInvitation(
    "お使いのヤリスの車検満了日は9月30日です。ご都合はいかがでしょうか？"
  ),
  false,
  "通常の都合確認を予約意思確認として誤認識しています"
);
assert.equal(
  context.hasInspectionBookingInvitation("車検は決まりました"),
  false,
  "質問ではない決定の言及を都合確認として誤認識しています"
);
assert.equal(
  context.hasInspectionBookingInvitation("この電話で予約できます"),
  false,
  "質問ではない予約説明を都合確認として誤認識しています"
);
assert.equal(
  context.hasInspectionBookingInvitation("代車は予約できますか？"),
  false,
  "代車予約の質問を入庫予約提案として誤認識しています"
);
assert.equal(
  context.hasDirectInspectionBookingInvitation("よろしければこのお電話でご予約できますが、いかがでしょうか？"),
  true,
  "この電話での直接予約提案を認識できません"
);
assert.equal(
  context.hasDirectInspectionBookingInvitation("今回の車検のご予定はお決まりでしょうか？"),
  false,
  "予定の有無を尋ねる質問を直接予約提案として誤認識しています"
);
assert.equal(
  context.hasDirectInspectionBookingInvitation(
    "お使いのヤリスの車検満了日は9月30日で、8月1日以降作業可能です。ご予定はお決まりでしたでしょうか？"
  ),
  false,
  "車検案内と予定確認をまとめた発話を直接予約提案として誤認識しています"
);

const crossingStart = appSource.indexOf("function advancedPastScriptedStep");
const crossingEnd = appSource.indexOf("function scriptedRequiredGroupsMatch", crossingStart);
assert.notEqual(crossingStart, -1, "複合発話の通過項目判定が見つかりません");
const crossingContext = {
  scenario: {
    steps: [
      { key: "thanked_customer" },
      { key: "explained_inspection_notice" },
      { key: "asked_availability" },
      { key: "explained_available_period" }
    ]
  },
  scriptedStepMatches(text, step) {
    return step.key === "asked_availability"
      && /ご都合/.test(text)
      && /(?:でしょうか|ますか|ですか|[?？])/.test(text);
  }
};
vm.createContext(crossingContext);
vm.runInContext(appSource.slice(crossingStart, crossingEnd), crossingContext);
const steps = [
  { key: "explained_inspection_notice" },
  { key: "asked_availability" },
  { key: "explained_available_period" },
  { key: "explained_duration_and_wait" }
];
assert.equal(
  crossingContext.advancedPastScriptedStep(0, 3, steps, "asked_availability"),
  true,
  "車検案内・予約提案・満了日をまとめた発話で肯定返答を選べません"
);
assert.equal(
  crossingContext.advancedPastScriptedStep(2, 3, steps, "asked_availability"),
  false,
  "都合確認を終えた後の発話を予約提案分岐として誤認識しています"
);
assert.equal(
  crossingContext.shouldAnswerCombinedInspectionAvailability(
    "ヤリスの車検が9月30日までとなりましたので、ご案内のお電話をしました。ご都合はいかがでしょうか？",
    0,
    4
  ),
  true,
  "車検案内と都合確認をまとめた発話へ都合の回答を返せません"
);
assert.equal(
  crossingContext.shouldAnswerCombinedInspectionAvailability(
    "ヤリスの車検が9月30日までとなりましたので、ご案内のお電話をしました。",
    0,
    4
  ),
  false,
  "都合を尋ねていない車検案内へ日程回答を返しています"
);

const dateCandidateStart = appSource.indexOf("function isInspectionDeadlineDateCandidate");
const dateCandidateEnd = appSource.indexOf("function inspectionAppointmentProposalMatch", dateCandidateStart);
assert.notEqual(dateCandidateStart, -1, "車検満了日を予約候補から除外する判定が見つかりません");
assert.notEqual(dateCandidateEnd, -1, "予約日候補判定を切り出せません");
const dateContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, "")
};
vm.createContext(dateContext);
vm.runInContext(appSource.slice(dateCandidateStart, dateCandidateEnd), dateContext);
assert.deepEqual(
  Array.from(
    dateContext.inspectionAppointmentDateCandidates(
      "ヤリスの車検満了日が9月30日となりまして、ご都合はいかがでしょうか？"
    )
  ),
  [],
  "車検満了日の9月30日を予約候補日として誤認識しています"
);
assert.deepEqual(
  Array.from(
    dateContext.inspectionAppointmentDateCandidates(
      "車検が9月30日となりました。9月1日の10時はいかがでしょうか？"
    ),
    (date) => `${date.month}月${date.day}日`
  ),
  ["9月1日"],
  "満了日を除外した後の実際の予約候補日を保持できません"
);
assert.match(
  appSource,
  /asksGeneralAvailability[\s\S]*?お願いしたいんですけど、いつできますか？[\s\S]*?inspection_asked_availability_customer/,
  "日時提示前の都合確認へ、登録済みの日程質問を返せません"
);
const retryStart = appSource.indexOf("function scriptedRetryForMissingDetails");
const retryEnd = appSource.indexOf("function shouldUseInspectionTimeOnlyAppointmentResponse", retryStart);
const retryContext = {
  normalizeScriptedText: dateContext.normalizeScriptedText,
  inspectionAppointmentDateCandidates: dateContext.inspectionAppointmentDateCandidates,
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text),
  hasInspectionBookingInvitation: () => false,
  asksInspectionDayPreference: () => false,
  hasInspectionScheduleQuestionIntent: () => false,
  asksOpenInspectionDatePreference: () => false,
  hasSupportedInspectionDuration: () => false,
  hasInspectionReminderContactConfirmation: () => false
};
vm.createContext(retryContext);
vm.runInContext(appSource.slice(retryStart, retryEnd), retryContext);
const expiryAndAvailabilityReply = retryContext.scriptedRetryForMissingDetails(
  "ヤリスの車検満了日が9月30日となりまして、ご都合はいかがでしょうか？",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(expiryAndAvailabilityReply.text, "お願いしたいんですけど、いつできますか？");
assert.equal(expiryAndAvailabilityReply.audioId, "inspection_asked_availability_customer");
assert.equal(expiryAndAvailabilityReply.missingDetail, "appointmentDate");

assert.match(scenarioSource, /requiredGroups:\s*\[\["ご都合",\s*"予定",\s*"日程",\s*"予約",\s*"決まり",\s*"決め"\]\]/);
assert.match(appSource, /text:\s*"お願いします。"[\s\S]*?audioId:\s*"inspection_booking_invitation_accept_customer"/);
assert.match(appSource, /text:\s*"お願いしようと思っていました。"[\s\S]*?audioId:\s*"inspection_booking_invitation_intent_customer"/);
assert.match(
  appSource,
  /startingScriptStep[\s\S]*?advancedPastScriptedStep\([\s\S]*?"asked_availability"/,
  "複数ステップをまとめた予約提案で肯定返答を優先していません"
);
assert.match(
  appSource,
  /function hasDirectInspectionBookingInvitation[\s\S]*?!normalized\.includes\("予約"\)[\s\S]*?return/,
  "予定確認と直接予約提案を分ける判定がありません"
);
assert.match(
  appSource,
  /hasDirectInspectionBookingInvitation\(combinedText\)[\s\S]*?state\.inspectionDurationProgressionPending = true[\s\S]*?text:\s*"お願いします。"/,
  "直接予約提案への肯定返答後に自然な作業時間質問の進行状態を保持していません"
);
assert.match(
  appSource,
  /naturalDurationProgression[\s\S]*?analysis\.noClarificationDeduction = true/,
  "意図した作業時間質問を案内不足の聞き返し減点から除外していません"
);
assert.match(
  appSource,
  /analysis\.blocked[\s\S]*?analysis\.noClarificationDeduction !== true[\s\S]*?!optionalAfterAppointmentKeys/,
  "聞き返し回数の集計で自然な進行質問を除外していません"
);

const scoreStart = appSource.indexOf("function scoreScriptedRoleplay");
const scoreEnd = appSource.indexOf("function buildImprovementTalk", scoreStart);
assert.notEqual(scoreStart, -1, "車検誘致の採点関数が見つかりません");
assert.notEqual(scoreEnd, -1, "車検誘致の採点関数の終端が見つかりません");
const scoreContext = {
  scenario: {
    scoring: [
      { key: "completed_flow", action: "確定フローを完了する", points: 95 },
      { key: "recapped_appointment", action: "お客様名と予約日時を復唱する", points: 5 }
    ],
    steps: []
  },
  state: {
    inspectionMileageAsked: true,
    analyses: [
      {
        scripted: true,
        stepKey: "completed_flow",
        completed_flow: true,
        passed: true,
        blocked: false,
        confidence: 0.95
      },
      {
        scripted: true,
        stepKey: "explained_duration_and_wait",
        passed: false,
        blocked: true,
        noClarificationDeduction: true,
        confidence: 0.55
      }
    ]
  }
};
vm.createContext(scoreContext);
vm.runInContext(
  `${appSource.slice(scoreStart, scoreEnd)}\nthis.scoreScriptedRoleplay = scoreScriptedRoleplay;`,
  scoreContext
);
const protectedFlowScore = scoreContext.scoreScriptedRoleplay();
assert.equal(
  protectedFlowScore.score,
  95,
  "自然な作業時間質問が2点減点され、予約復唱不足だけの95点になっていません"
);
assert.equal(
  protectedFlowScore.improve.some((text) => text.includes("聞き返し")),
  false,
  "自然な作業時間質問が改善点の聞き返し回数に表示されています"
);
assert.match(
  appSource,
  /shouldAnswerCombinedInspectionAvailability\([\s\S]*?text:\s*"お願いしたいんですけど、いつできますか？"[\s\S]*?audioId:\s*"inspection_asked_availability_customer"/,
  "複数項目と都合確認をまとめた発話へ登録済みの日程回答を選んでいません"
);
assert.match(audioDbSource, /inspection_booking_invitation_accept_customer"[^\n]*"お願いします。"/);
assert.match(audioDbSource, /inspection_booking_invitation_intent_customer"[^\n]*"お願いしようと思っていました。"/);

for (const fileName of [
  "inspection_booking_invitation_accept_customer.mp3",
  "inspection_booking_invitation_intent_customer.mp3"
]) {
  const audioFile = new URL(`../audio-ondoku/${fileName}`, import.meta.url);
  assert.ok(fs.existsSync(audioFile), `${fileName} がありません`);
  assert.ok(fs.statSync(audioFile).size > 10000, `${fileName} が小さすぎます`);
}

console.log("車検誘致・電話予約提案への肯定返答テスト: OK");
