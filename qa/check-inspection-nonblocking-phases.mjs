import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const helperStart = source.indexOf("function scriptedStepCanAdvanceOnFailure");
const helperEnd = source.indexOf("function markScriptedStepNotApplicable", helperStart);
assert.notEqual(helperStart, -1, "未達工程の進行判定がありません");
assert.notEqual(helperEnd, -1, "未達工程の進行判定終端がありません");

const context = {};
vm.createContext(context);
vm.runInContext(source.slice(helperStart, helperEnd), context);

const nonBlockingKeys = [
  "confirmed_identity",
  "introduced_self",
  "thanked_customer",
  "explained_inspection_notice",
  "asked_availability",
  "explained_available_period",
  "explained_duration_and_wait",
  "explained_loaner",
  "confirmed_booking_time",
  "confirmed_waiting",
  "asked_vehicle_concerns",
  "explained_documents",
  "explained_lock_and_arrival",
  "confirmed_reminder_contact",
  "recapped_appointment"
];

nonBlockingKeys.forEach((key) => {
  assert.equal(
    context.scriptedStepCanAdvanceOnFailure({ key }),
    true,
    `${key} が未達時に会話を止めています`
  );
});
assert.equal(
  context.scriptedStepCanAdvanceOnFailure({ key: "proposed_appointment" }),
  false,
  "具体的な入庫日時を未確定のまま通過しています"
);
assert.equal(
  context.scriptedStepCanAdvanceOnFailure({ key: "closed_politely" }),
  false,
  "最終挨拶を待たずにマイクを終了しています"
);
assert.match(
  source,
  /skippedIncompleteStep[\s\S]*?\? "はい。" : responseStep\.customerResponse/,
  "未達工程で案内不足質問を返さず中立の相づちを返せません"
);
assert.match(
  source,
  /analysis\.blocked[\s\S]*?analysis\.noClarificationDeduction !== true[\s\S]*?!optionalAfterAppointmentKeys/,
  "実際の聞き返しだけを追加減点する採点条件がありません"
);

const analyzeStart = source.indexOf("function analyzeScriptedStaff");
const analyzeEnd = source.indexOf("function markScriptedStepNotApplicable", analyzeStart);
const analyzeContext = {
  state: {
    proposedAppointment: null,
    analyses: [],
    inspectionMileageAsked: false,
    inspectionLoanerRequested: false
  },
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  scriptedRequiredGroupsMatch: () => false,
  scriptedStepSpecificMatches: () => true,
  hasSupportedInspectionDuration: () => false,
  inspectionAppointmentProposalMatch: () => null,
  hasInspectionLoanerConfirmation: () => false,
  renderConversation: () => {}
};
vm.createContext(analyzeContext);
vm.runInContext(source.slice(analyzeStart, analyzeEnd), analyzeContext);
const skippedIntroduction = analyzeContext.analyzeScriptedStaff(
  "次のご案内です",
  { key: "introduced_self", expected: "店舗・担当者名", requiredGroups: [["店舗"], ["担当者"]] }
);
assert.equal(skippedIntroduction.passed, false, "未達の名乗りを得点対象にしています");
assert.equal(skippedIntroduction.canAdvance, true, "未達の名乗りで会話を止めています");
assert.equal(skippedIntroduction.blocked, false, "自動通過を聞き返し減点にしています");

console.log("車検誘致・未達フェーズの非ブロッキング進行テスト: OK");
