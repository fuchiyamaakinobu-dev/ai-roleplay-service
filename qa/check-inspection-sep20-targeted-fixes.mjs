import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} が見つかりません`);
  assert.notEqual(end, -1, `${endMarker} が見つかりません`);
  return appSource.slice(start, end);
}

const context = {};
vm.createContext(context);
vm.runInContext(
  sourceBetween("function normalizeScriptedText", "function hasSupportedInspectionDuration"),
  context
);
vm.runInContext(
  sourceBetween("function hasInspectionWaitingChoiceOffer", "function hasInspectionAvailableFromInformation"),
  context
);
vm.runInContext(
  sourceBetween("function isScriptedQuestion", "function scriptedStepSpecificMatches"),
  context
);
vm.runInContext(
  sourceBetween("function hasDirectInspectionBookingInvitation", "function advancedPastScriptedStep"),
  context
);
vm.runInContext(
  sourceBetween("function asksCurrentMileage", "function hasBookingContinuationConfirmation"),
  context
);

const spokenAppointment = "くがつ、26日の10時半はいかがでしょうか。";
assert.equal(
  context.normalizeScriptedText(spokenAppointment).includes("9月26日"),
  true,
  "読点を含む月日を正規化できません"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.inspectionAppointmentProposalMatch(spokenAppointment))),
  { month: "9", day: "26", hour: "10", minute: 30, period: "" },
  "読点を含む日時提案を確定値へ変換できません"
);

const mileageQuestion = "佐藤様、今現在のヤリスの走行距離、どのくらい乗られてますか？";
assert.equal(context.asksCurrentMileage(mileageQuestion), true, "走行距離質問を発話全体から認識できません");

const loanerOffer = "それと早期のご予約で代車をご用意できるのですが、いかがでしょうか？";
assert.equal(context.asksInspectionLoanerNeed(loanerOffer), true, "読点を含む代車提案を認識できません");

assert.match(
  appSource,
  /if \(asksCurrentMileage\(decisionText\) \|\| asksCurrentMileage\(text\)\)/,
  "走行距離質問へ発話全体を使用していません"
);
assert.match(
  appSource,
  /if \(asksInspectionLoanerNeed\(decisionText\) \|\| asksInspectionLoanerNeed\(text\)\)[\s\S]*?inspectionWaitingMethod === "store"[\s\S]*?待っています。/,
  "店内待ち確定後の代車提案で待ち方を維持できません"
);
assert.match(
  scenarioSource,
  /key:\s*"explained_loaner"[\s\S]*?\["早め",\s*"お早め",\s*"早期"\]/,
  "代車予約の採点語に『早期』がありません"
);
assert.match(
  appSource,
  /standardLoanerReservationWasExplained[\s\S]*?\(\?:早め\|お早め\|早期\)[\s\S]*?\/予約\//,
  "会話全体から『早期の予約』を代車案内として回収できません"
);

console.log("2026-09-20 targeted inspection fixes passed");
