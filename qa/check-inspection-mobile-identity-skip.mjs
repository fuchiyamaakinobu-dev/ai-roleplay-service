import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const activeDialogueSource = `${appSource}\n${scenarioSource}\n${audioDbSource}`;

assert.doesNotMatch(
  activeDialogueSource,
  /どちらにおかけですか|どちらにお掛けですか/,
  "廃止した『どちらにおかけですか？』が通常会話データに残っています"
);
assert.match(
  scenarioSource,
  /key:\s*"confirmed_identity"[\s\S]*?points:\s*4/,
  "本人確認4点の採点項目を維持してください"
);
assert.match(
  appSource,
  /skippedIdentity[\s\S]*?"どちら様でしょうか？"[\s\S]*?"inspection_introduced_self_retry"/,
  "本人確認も名乗りもない場合の自然な名乗り確認がありません"
);
assert.doesNotMatch(
  audioDbSource,
  /inspection_identity_missing_after_introduction|inspection_confirmed_identity_retry/,
  "廃止した本人確認聞き返し音声が通常再生登録に残っています"
);

const helperStart = appSource.indexOf("function scriptedStepCanAdvanceOnFailure");
const helperEnd = appSource.indexOf("function markScriptedStepNotApplicable", helperStart);
assert.notEqual(helperStart, -1, "本人確認省略の進行判定が見つかりません");
assert.notEqual(helperEnd, -1, "本人確認省略の進行判定の終端が見つかりません");
const context = {};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);
assert.equal(
  context.scriptedStepCanAdvanceOnFailure({ key: "confirmed_identity" }),
  true,
  "本人確認を省略した場合に次へ進めません"
);
assert.equal(
  context.scriptedStepCanAdvanceOnFailure({ key: "introduced_self" }),
  false,
  "名乗りまで無条件で省略可能になっています"
);
assert.equal(
  context.scriptedStepCanAdvanceOnFailure({ key: "thanked_customer", advanceOnFailure: true }),
  true,
  "既存のお礼省略進行が維持されていません"
);

const introductionStart = appSource.indexOf("function hasInspectionSelfIntroduction");
const introductionEnd = appSource.indexOf("function scriptedRequiredGroupsMatch", introductionStart);
assert.notEqual(introductionStart, -1, "店舗・担当者名の名乗り判定が見つかりません");
assert.notEqual(introductionEnd, -1, "店舗・担当者名の名乗り判定の終端が見つかりません");
const introductionContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, "")
};
vm.createContext(introductionContext);
vm.runInContext(appSource.slice(introductionStart, introductionEnd), introductionContext);

for (const phrase of [
  "私、トヨタモビリティ帯広の渕山と申します",
  "私、トヨタモビリティ帯広の渕山ともうします",
  "トヨタモビリティ帯広の渕山です",
  "わたし、とよたもびりてぃおびひろのふちやまともうします",
  "とよたもびりてぃ帯広のふちやまです"
]) {
  assert.equal(
    introductionContext.hasInspectionSelfIntroduction(phrase),
    true,
    `${phrase}を店舗・担当者名の名乗りとして認識できません`
  );
}

for (const phrase of [
  "トヨタです",
  "渕山ともうします",
  "トヨタモビリティ帯広です"
]) {
  assert.equal(
    introductionContext.hasInspectionSelfIntroduction(phrase),
    false,
    `${phrase}を店舗・担当者名がそろった名乗りとして誤認識しています`
  );
}

assert.match(
  scenarioSource,
  /requiredGroups:\s*\[\["トヨタモビリティ",\s*"トヨタ",\s*"とよたもびりてぃ",\s*"とよた"\],\s*\["です",\s*"申します",\s*"もうします"\]\]/,
  "標準シナリオに名乗りのひらがな音声認識表記がありません"
);

console.log("携帯電話発信・本人確認省略テスト: OK");
