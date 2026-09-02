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

const advanceStart = appSource.indexOf("function advancePastPassedScriptedSteps");
const advanceEnd = appSource.indexOf("function findFurthestMatchingOptionalStepIndex", advanceStart);
assert.notEqual(advanceStart, -1, "本人確認省略後の返答工程補正が見つかりません");
assert.notEqual(advanceEnd, -1, "本人確認省略後の返答工程補正の終端が見つかりません");
const identityStep = { key: "confirmed_identity", customerResponse: "そうです。" };
const introducedStep = { key: "introduced_self", customerResponse: "お世話になっております。" };
const courtesyStep = { key: "thanked_customer", customerResponse: "こちらこそ。" };
const advanceContext = {
  state: {
    scriptStep: 1,
    analyses: [
      { stepKey: "introduced_self", passed: true },
      { stepKey: "thanked_customer", passed: true }
    ]
  },
  scenario: { steps: [identityStep, introducedStep, courtesyStep] }
};
vm.createContext(advanceContext);
vm.runInContext(appSource.slice(advanceStart, advanceEnd), advanceContext);
assert.equal(
  advanceContext.advancePastPassedScriptedSteps(identityStep).customerResponse,
  "こちらこそ。",
  "本人確認を省略して名乗りとお礼を伝えた発話へ本人確認用の『そうです。』を返しています"
);
assert.equal(advanceContext.state.scriptStep, 3, "同じ発話で達成した名乗りとお礼を通過できません");

const rememberStart = appSource.indexOf("function rememberFutureScriptedAchievements");
const rememberEnd = appSource.indexOf("function recordOptionalShortcutEvidence", rememberStart);
assert.notEqual(rememberStart, -1, "先行工程の達成記録処理が見つかりません");
assert.notEqual(rememberEnd, -1, "先行工程の達成記録処理の終端が見つかりません");
const rememberedKeys = [];
const rememberContext = {
  scenario: { steps: [identityStep, introducedStep, courtesyStep] },
  scriptedStepMatches: (_text, candidate) => candidate.key === "introduced_self",
  hasCourtesyExpression: (text) => /お世話になっております/.test(text),
  markScriptedStepPassed: (candidate) => rememberedKeys.push(candidate.key)
};
vm.createContext(rememberContext);
vm.runInContext(appSource.slice(rememberStart, rememberEnd), rememberContext);
rememberContext.rememberFutureScriptedAchievements(
  "私、トヨタモビリティ帯広の渕山と申します。どうもいつもお世話になっております。",
  0
);
assert.deepEqual(
  rememberedKeys,
  ["introduced_self", "thanked_customer"],
  "本人確認省略時の同一発話に含まれる名乗りと日頃のお礼を両方記録できません"
);

const recoverStart = appSource.indexOf("function recoverEarlierInspectionOpeningStep");
const recoverEnd = appSource.indexOf("function recordOptionalShortcutEvidence", recoverStart);
assert.notEqual(recoverStart, -1, "順不同の冒頭工程を回収する処理が見つかりません");
assert.notEqual(recoverEnd, -1, "順不同の冒頭工程を回収する処理の終端が見つかりません");
const recoveredKeys = [];
const recoverContext = {
  scenario: { steps: [identityStep, introducedStep, courtesyStep] },
  state: {
    analyses: [
      { stepKey: "confirmed_identity", passed: false },
      { stepKey: "introduced_self", passed: true }
    ]
  },
  scriptedStepMatches: (_text, candidate) => candidate.key === "confirmed_identity",
  markScriptedStepPassed: (candidate) => {
    recoveredKeys.push(candidate.key);
    recoverContext.state.analyses.push({ stepKey: candidate.key, passed: true });
  }
};
vm.createContext(recoverContext);
vm.runInContext(appSource.slice(recoverStart, recoverEnd), recoverContext);
assert.equal(
  recoverContext.recoverEarlierInspectionOpeningStep("佐藤様のお電話でしょうか。", 2).customerResponse,
  "そうです。",
  "名乗りを先に行った後の本人確認へ『そうです。』と返せません"
);
assert.deepEqual(recoveredKeys, ["confirmed_identity"], "後から行った本人確認を採点へ記録できません");

recoverContext.state.analyses = [];
recoverContext.scriptedStepMatches = (_text, candidate) =>
  candidate.key === "confirmed_identity" || candidate.key === "introduced_self";
assert.equal(
  recoverContext.recoverEarlierInspectionOpeningStep(
    "トヨタモビリティ帯広の渕山です。佐藤様でしょうか。",
    2
  ).customerResponse,
  "お世話になっております。",
  "本人確認と名乗りが同時の場合に名乗りへの挨拶を優先できません"
);

advanceContext.state.scriptStep = 1;
advanceContext.state.analyses = [{ stepKey: "introduced_self", passed: true }];
assert.equal(
  advanceContext.advancePastPassedScriptedSteps(identityStep).customerResponse,
  "お世話になっております。",
  "本人確認を省略して名乗りだけ伝えた発話へ名乗り工程のお客様返答を選べません"
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
  "私、トヨタモビリティ帯広の山田と申します",
  "私、トヨタモビリティ帯広本別店の寺谷と申します",
  "私、トヨタモビリティ帯広本別店寺屋と申します",
  "私、トヨタモビリティ帯広本別店の未登録名と申します",
  "トヨタモビリティ帯広本別の原田です。コメント転換。",
  "私、トヨタモビリティ帯広本、別の原田でございます。いつもお世話になっております。",
  "私、豊田モビリティ帯広の高橋と申します",
  "私、トヨタモビリティ帯広の佐々木と、もうします",
  "トヨタモビリティ帯広の鈴木です",
  "トヨタモビリティ帯広の田中でございます",
  "トヨタモビリティ帯広の伊藤と言います",
  "トヨタモビリティ帯広の加藤といいます",
  "私、トヨタモビリヒロの小林と申します",
  "わたし、とよたもびりひろのふちやまともうします",
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
  "トヨタモビリティ帯広です",
  "トヨタモビリティ帯広本別店と申します",
  "トヨタモビリティ帯広本別店の担当者と申します",
  "トヨタモビリヒロです"
]) {
  assert.equal(
    introductionContext.hasInspectionSelfIntroduction(phrase),
    false,
    `${phrase}を店舗・担当者名がそろった名乗りとして誤認識しています`
  );
}

assert.match(
  scenarioSource,
  /requiredGroups:\s*\[\["トヨタモビリティ",\s*"トヨタ",\s*"とよたもびりてぃ",\s*"とよた"\],\s*\["です",\s*"申します",\s*"もうします",\s*"でございます",\s*"と言います",\s*"といいます"\]\]/,
  "標準シナリオに担当者名の名乗り語尾がそろっていません"
);

const callTimingStart = appSource.indexOf("function asksInspectionCallTimingPermission");
const callTimingEnd = appSource.indexOf("function analyzeStaff", callTimingStart);
assert.notEqual(callTimingStart, -1, "通話可否確認の判定が見つかりません");
assert.notEqual(callTimingEnd, -1, "通話可否確認の判定終端が見つかりません");
const callTimingContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text)
};
vm.createContext(callTimingContext);
vm.runInContext(appSource.slice(callTimingStart, callTimingEnd), callTimingContext);
assert.equal(
  callTimingContext.asksInspectionCallTimingPermission("今、お電話よろしかったですか？"),
  true,
  "現在の通話可否確認を認識できません"
);
assert.equal(
  callTimingContext.asksInspectionCallTimingPermission("このまま予約を進めてもよろしいでしょうか？"),
  false,
  "予約手続き確認を現在の通話可否確認として誤認識しています"
);
assert.match(
  appSource,
  /asksInspectionCallTimingPermission\(combinedText\)[\s\S]*?text: "大丈夫ですよ。"[\s\S]*?inspection_confirmed_booking_time_customer/,
  "名乗り・お礼と同時の通話可否確認へ『大丈夫ですよ。』と回答できません"
);

console.log("携帯電話発信・本人確認省略テスト: OK");
