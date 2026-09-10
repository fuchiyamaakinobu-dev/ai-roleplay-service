import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const helperStart = source.indexOf("function inspectionPartialPhaseResponse");
const helperEnd = source.indexOf("function asksInspectionVehicleConcerns", helperStart);
assert.notEqual(helperStart, -1, "重要語によるフェーズ進行用の返答関数が見つかりません");
assert.notEqual(helperEnd, -1, "フェーズ進行用の返答関数の終端が見つかりません");

const context = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, "")
};
vm.createContext(context);
vm.runInContext(
  `${source.slice(helperStart, helperEnd)}\nthis.inspectionPartialPhaseResponse = inspectionPartialPhaseResponse;`,
  context
);

const partialStep = (key, words) => ({ key, requiredGroups: [words] });
assert.deepEqual(
  JSON.parse(JSON.stringify(context.inspectionPartialPhaseResponse(
    partialStep("explained_documents", ["車検証", "自賠責", "納税証明書"]),
    "車検証をお持ちください"
  ))),
  {
    text: "分かりました。",
    audioId: "inspection_explained_lock_and_arrival_customer"
  },
  "書類の一部だけでも聞き返さず案内受領の返答へ進めません"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.inspectionPartialPhaseResponse(
    partialStep("explained_loaner", ["代車", "早め", "予約", "用意"]),
    "代車についてご案内します"
  ))),
  {
    text: "お願いします。",
    audioId: "inspection_booking_invitation_accept_customer"
  },
  "代車の重要語を認識しても明確な希望返答へ進めません"
);
assert.equal(
  context.inspectionPartialPhaseResponse(
    partialStep("explained_documents", ["車検証", "自賠責", "納税証明書"]),
    "それと"
  ),
  null,
  "重要語のない発話途中をフェーズ言及済みとして扱っています"
);

const callTimingIndex = source.indexOf("asksInspectionCallTimingPermission(decisionText)");
const loanerIndex = source.indexOf("asksInspectionLoanerNeed(decisionText)");
const mileageIndex = source.indexOf("asksCurrentMileage(decisionText)");
const concernIndex = source.indexOf("asksInspectionVehicleConcerns(decisionText)");
const waitingIndex = source.indexOf("asksInspectionWaitingMethodConfirmation(decisionText)");
const reminderIndex = source.indexOf("asksInspectionReminderContactDestination(decisionText)");
for (const [label, index] of [
  ["通話可否", callTimingIndex],
  ["代車", loanerIndex],
  ["走行距離", mileageIndex],
  ["車両状態", concernIndex],
  ["店内待ち", waitingIndex],
  ["3日前連絡先", reminderIndex]
]) {
  assert.ok(index > 0, `${label}の質問を現在フェーズより優先する分岐がありません`);
}

console.log("車検誘致・重要語優先の進行テスト: OK");
