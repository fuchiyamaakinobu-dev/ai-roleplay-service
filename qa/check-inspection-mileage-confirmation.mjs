import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} が見つかりません`);
  assert.notEqual(end, -1, `${endMarker} が見つかりません`);
  return appSource.slice(start, end);
}

const context = { state: { inspectionMileageAsked: false } };
vm.createContext(context);
vm.runInContext(
  sourceBetween("function normalizeScriptedText", "function hasSupportedInspectionDuration"),
  context
);
vm.runInContext(
  sourceBetween("function hasSupportedInspectionDuration", "function hasInspectionWaitingChoiceOffer"),
  context
);
vm.runInContext(
  sourceBetween("function isScriptedQuestion", "function scriptedStepSpecificMatches"),
  context
);
vm.runInContext(
  sourceBetween("function asksCurrentMileage", "function hasBookingContinuationConfirmation"),
  context
);
vm.runInContext(
  sourceBetween("function scriptedRequiredGroupsMatch", "function analyzeScriptedStaff"),
  context
);

for (const phrase of [
  "現在の走行距離は何kmですか？",
  "距離数は何キロぐらい走っていますでしょうか。",
  "今、何キロ走っていますか？",
  "走行距離は何ｋｍでしょうか？"
]) {
  assert.equal(context.asksCurrentMileage(phrase), true, `${phrase} を走行距離質問として認識できません`);
}

for (const phrase of [
  "走行距離は3万キロですね。",
  "作業時間は90分です。",
  "お店で待つことができます。"
]) {
  assert.equal(context.asksCurrentMileage(phrase), false, `${phrase} を走行距離質問として誤認識しています`);
}

const completeDurationTalk = "作業時間は90分で、店内で待つことができます。";
const durationGroups = [["90分"], ["店内"]];
assert.equal(
  context.scriptedRequiredGroupsMatch(completeDurationTalk, { key: "explained_duration_and_wait" }, durationGroups),
  false,
  "作業時間と店内待ちのキーワードだけで、走行距離未確認を通過しています"
);
context.state.inspectionMileageAsked = true;
assert.equal(
  context.scriptedRequiredGroupsMatch(completeDurationTalk, { key: "explained_duration_and_wait" }, durationGroups),
  true,
  "走行距離確認後も作業時間と店内待ちを完了できません"
);
context.state.inspectionMileageAsked = false;

vm.runInContext(
  sourceBetween("function scriptedRetryForMissingDetails", "function naturalScriptedRetryVariants"),
  context
);

const durationStep = {
  key: "explained_duration_and_wait",
  expected: "走行距離・作業時間・店内待ち",
  requiredGroups: [["90分"], ["店内"]],
  retryResponse: "どれくらい時間がかかるのですか？"
};
context.state.inspectionMileageAsked = false;
context.state.analyses = [];
context.scriptedStepSpecificMatches = () => true;
context.scriptedStepCanAdvanceOnFailure = () => false;
vm.runInContext(
  sourceBetween("function analyzeScriptedStaff", "function scriptedStepCanAdvanceOnFailure"),
  context
);
const mileageOmittedAnalysis = context.analyzeScriptedStaff(completeDurationTalk, durationStep);
assert.equal(mileageOmittedAnalysis.passed, false, "走行距離未確認を採点達成にしています");
assert.equal(mileageOmittedAnalysis.canAdvance, true, "走行距離未確認だけで会話を停止しています");
assert.equal(mileageOmittedAnalysis.blocked, false, "走行距離未確認でお客様の聞き返しを発生させています");

let retry = context.scriptedRetryForMissingDetails(
  "作業時間は90分で、店内で待つこともできます。",
  durationStep
);
assert.equal(retry.missingDetail, null, "走行距離未確認をお客様の聞き返し対象にしています");
assert.equal(retry.text, "どれくらい時間がかかるのですか？");

context.state.inspectionMileageAsked = true;
retry = context.scriptedRetryForMissingDetails("作業時間は90分です。", durationStep);
assert.equal(retry.missingDetail, "waiting", "走行距離確認後の不足項目を店内待ちに絞れていません");
assert.equal(retry.text, "お店で待つことはできますか？");

assert.equal(
  (appSource.match(/inspectionMileageAsked\s*=\s*false/g) || []).length,
  2,
  "やり直し・開始時の走行距離確認状態を初期化できません"
);
assert.match(
  appSource,
  /inspectionMileageAsked:\s*false/,
  "初期状態に走行距離確認フラグがありません"
);
assert.match(
  appSource,
  /step\.key === "explained_duration_and_wait" && asksCurrentMileage\(text\)[\s\S]*?今、3万キロくらいです。/,
  "走行距離質問後のお客様回答分岐がありません"
);
assert.match(
  appSource,
  /return state\.inspectionMileageAsked[\s\S]*?hasSupportedInspectionDuration\(normalized\)[\s\S]*?hasWaiting/,
  "走行距離・作業時間・店内待ちの3条件を完了判定に使用していません"
);
assert.match(
  appSource,
  /const mileageOnlyMissing = step\.key === "explained_duration_and_wait"[\s\S]*?const canAdvance = passed \|\| mileageOnlyMissing/,
  "走行距離だけが未確認の場合に、未達のまま会話を進められません"
);
assert.match(scenarioSource, /inspectionCycle:\s*"初回車検"/);
assert.match(scenarioSource, /assumedMileageKm:\s*30000/);
assert.match(
  scenarioSource,
  /label:\s*"走行距離・時間・店内待ち"[\s\S]*?requiresMileageConfirmation:\s*true/,
  "シナリオ定義に走行距離確認が反映されていません"
);
assert.match(
  audioDbSource,
  /inspection_current_mileage_customer",\s*"走行距離確認・お客様回答",\s*"今、3万キロくらいです。",\s*"pending"/,
  "走行距離回答の音声登録文が一致していません"
);
assert.doesNotMatch(
  appSource + audioDbSource,
  /走行距離は確認しなくて大丈夫ですか？|inspection_mileage_missing_retry/,
  "不要な走行距離確認促進のお客様発話が残っています"
);

console.log("inspection mileage confirmation checks passed");
