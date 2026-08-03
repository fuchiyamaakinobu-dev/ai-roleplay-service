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

console.log("携帯電話発信・本人確認省略テスト: OK");
