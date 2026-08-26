import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const proposalStart = source.indexOf("function hasInspectionAppointmentProposalEvidence");
const proposalEnd = source.indexOf("function hasInspectionScheduleQuestionIntent", proposalStart);

assert.notEqual(proposalStart, -1, "予約日時提案判定が見つかりません");
assert.notEqual(proposalEnd, -1, "予約日時提案判定の終端が見つかりません");

const context = {};
vm.createContext(context);
vm.runInContext(`
  function normalizeScriptedText(text) { return String(text).replace(/\\s+/g, ""); }
  function isScriptedQuestion(text) { return /(?:でしょうか|ますか|ですか|[?？])/.test(text); }
  ${source.slice(proposalStart, proposalEnd)}
  this.hasCompleteInspectionAppointmentProposal = hasCompleteInspectionAppointmentProposal;
`, context);

assert.equal(
  context.hasCompleteInspectionAppointmentProposal("8月20日の10時はいかがでしょうか？"),
  true,
  "具体的な月日・時刻の予約提案を認識できません"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("8月20日はいかがでしょうか？"),
  false,
  "日付だけで入庫日時確定へ進んでいます"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("10時はいかがでしょうか？"),
  false,
  "時刻だけで入庫日時確定へ進んでいます"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("8月11日以降でしたら作業可能ですが、朝10時半はいかがでしょうか？"),
  false,
  "入庫可能期間の開始日と時刻を予約日時として誤認識しています"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("車検は9月30日までです。8月1日から作業可能ですが、10時はいかがでしょうか？"),
  false,
  "満了日・入庫可能日と時刻を予約日時として誤認識しています"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("8月11日以降でしたら作業可能です。8月20日の10時はいかがでしょうか？"),
  true,
  "入庫可能日の後に提示された具体的な予約日時を認識できません"
);

assert.match(
  source,
  /!state\.proposedAppointment[\s\S]*?appointmentIndex !== state\.scriptStep[\s\S]*?hasInspectionAppointmentProposalEvidence\(text\)[\s\S]*?appointmentIndex > state\.scriptStep[\s\S]*?recordSkippedStepsBeforeAppointment[\s\S]*?state\.scriptStep = appointmentIndex[\s\S]*?handleScriptedStaffReply\(text\)/,
  "日付または時刻の部分提案から日時工程を優先する処理が見つかりません"
);
assert.match(
  source,
  /すでに後工程へ進んでいても日時が未確定なら[\s\S]*?完全な日時提案を最優先で確定/,
  "後工程へ進んだ後の完全な日時提案を優先できません"
);

const advanceStart = source.indexOf("function advancePastPassedScriptedSteps");
const advanceEnd = source.indexOf("function findFurthestMatchingOptionalStepIndex", advanceStart);
assert.notEqual(advanceStart, -1, "確認済み工程の通過処理が見つかりません");
assert.notEqual(advanceEnd, -1, "確認済み工程の通過処理の終端が見つかりません");

const advanceContext = {
  state: {
    scriptStep: 1,
    analyses: [
      { stepKey: "confirmed_waiting", passed: true },
      { stepKey: "asked_vehicle_concerns", passed: true }
    ]
  },
  scenario: {
    steps: [
      { key: "proposed_appointment", customerResponse: "では、その日でお願いします。" },
      { key: "confirmed_waiting", customerResponse: "待っています。" },
      { key: "asked_vehicle_concerns", customerResponse: "オイル交換もお願いしたいです。" },
      { key: "explained_documents", customerResponse: "はい。" }
    ]
  }
};
vm.createContext(advanceContext);
vm.runInContext(
  `${source.slice(advanceStart, advanceEnd)}\nthis.advancePastPassedScriptedSteps = advancePastPassedScriptedSteps;`,
  advanceContext
);
const preservedAppointmentResponse = advanceContext.advancePastPassedScriptedSteps(
  advanceContext.scenario.steps[0],
  { preserveResponseStep: true }
);
assert.equal(
  preservedAppointmentResponse.key,
  "proposed_appointment",
  "日時確定後に確認済みのオイル交換希望へ返答が戻っています"
);
assert.equal(
  advanceContext.state.scriptStep,
  3,
  "日時確定後に確認済みの待ち方・車両状態工程を通過できません"
);
assert.match(
  source,
  /preserveResponseStep:\s*step\.key === "proposed_appointment" && analysis\.passed/,
  "日時確定の返答を最優先に保持する呼び出しがありません"
);
const appointmentPriorityIndex = source.indexOf("const appointmentIndex = scenario.steps.findIndex");
const earlyConcernIndex = source.indexOf("const concernStepIndex = scenario.steps.findIndex", appointmentPriorityIndex);
assert.ok(
  appointmentPriorityIndex >= 0 && earlyConcernIndex > appointmentPriorityIndex,
  "完全な日時提案よりオイル交換の再質問を先に処理しています"
);
assert.match(
  source,
  /closingIntent[\s\S]*?state\.proposedAppointment[\s\S]*?step\.optionalAfterAppointment[\s\S]*?scriptedStepMatches\(text, closingStep\)[\s\S]*?finishRoleplay/,
  "日時確定後の終話あいさつで終了する処理が見つかりません"
);

const optionalJumpStart = source.indexOf("function findFurthestMatchingOptionalStepIndex");
const optionalJumpEnd = source.indexOf("function handleScriptedStaffReply", optionalJumpStart);
assert.notEqual(optionalJumpStart, -1, "日時確定後の任意工程ジャンプ判定が見つかりません");
assert.notEqual(optionalJumpEnd, -1, "任意工程ジャンプ判定の終端が見つかりません");

const optionalContext = {
  state: { proposedAppointment: { month: 8, day: 20, hour: 13 } },
  scenario: {
    steps: [
      { key: "asked_vehicle_concerns", optionalAfterAppointment: true },
      { key: "explained_documents", optionalAfterAppointment: true },
      { key: "explained_lock_and_arrival", optionalAfterAppointment: true },
      { key: "confirmed_reminder_contact", optionalAfterAppointment: true },
      { key: "recapped_appointment", optionalAfterAppointment: true },
      { key: "closed_politely" }
    ]
  },
  scriptedStepMatches(text, step) {
    return text.includes(step.key);
  },
  hasScriptedAppointmentRecapEvidence(text) {
    return text.includes("recapped_appointment");
  }
};
vm.createContext(optionalContext);
vm.runInContext(
  `${source.slice(optionalJumpStart, optionalJumpEnd)}\nthis.findFurthestMatchingOptionalStepIndex = findFurthestMatchingOptionalStepIndex;`,
  optionalContext
);
assert.equal(
  optionalContext.findFurthestMatchingOptionalStepIndex(
    "explained_documents explained_lock_and_arrival confirmed_reminder_contact",
    0
  ),
  3,
  "気になる所を省略して事前連絡まで説明した発話へ進めません"
);
assert.match(
  source,
  /optionalForwardIndex > state\.scriptStep[\s\S]*?recordSkippedScriptedSteps[\s\S]*?state\.scriptStep = optionalForwardIndex[\s\S]*?handleScriptedStaffReply\(text\)/,
  "日時確定後に先の任意工程を優先する処理が見つかりません"
);

const timeOnlyStart = source.indexOf("function shouldUseInspectionTimeOnlyAppointmentResponse");
const timeOnlyEnd = source.indexOf("function naturalScriptedRetryVariants", timeOnlyStart);
assert.notEqual(timeOnlyStart, -1, "時刻だけを最後に確定した場合の返答判定が見つかりません");
assert.notEqual(timeOnlyEnd, -1, "時刻だけを最後に確定した場合の返答判定の終端が見つかりません");

const timeOnlyContext = {
  state: {
    scriptedPartialReplies: {
      proposed_appointment: { missingDetail: "appointmentTime" }
    }
  },
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  inspectionAppointmentDateCandidates: (text) => /\d{1,2}月\d{1,2}日/.test(text) ? [text] : []
};
vm.createContext(timeOnlyContext);
vm.runInContext(
  `${source.slice(timeOnlyStart, timeOnlyEnd)}\nthis.shouldUseInspectionTimeOnlyAppointmentResponse = shouldUseInspectionTimeOnlyAppointmentResponse;`,
  timeOnlyContext
);
assert.equal(
  timeOnlyContext.shouldUseInspectionTimeOnlyAppointmentResponse(
    "10時はいかがでしょうか？",
    { key: "proposed_appointment" },
    { passed: true }
  ),
  true,
  "日付確定後の時刻提示で『その時間』の返答へ切り替わりません"
);
assert.equal(
  timeOnlyContext.shouldUseInspectionTimeOnlyAppointmentResponse(
    "8月20日10時はいかがでしょうか？",
    { key: "proposed_appointment" },
    { passed: true }
  ),
  false,
  "月日と時刻の同時提示まで『その時間』の返答へ切り替えています"
);
assert.match(
  source,
  /text: "では、その時間でお願いします。"[\s\S]*?audioId: "inspection_appointment_single_time_customer"/,
  "時刻確定時の表示文と音声IDが一致していません"
);
assert.match(
  audioSource,
  /\["inspection_appointment_single_time_customer",[^\n]*"では、その時間でお願いします。"\]/,
  "時刻確定時の音声登録文がありません"
);

console.log("車検誘致・入庫日時を最低限とする終話テスト: OK");
