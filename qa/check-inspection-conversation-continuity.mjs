import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const closingStart = source.indexOf("function hasScriptedClosingIntent");
const closingEnd = source.indexOf("function recordOptionalShortcutEvidence", closingStart);
assert.notEqual(closingStart, -1, "車検誘致の終話判定が見つかりません");
assert.notEqual(closingEnd, -1, "終話判定の終端が見つかりません");

const closingContext = {
  state: { proposedAppointment: null },
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  scenario: { steps: [] },
  scriptedStepMatches: () => false,
  markScriptedStepPassed: () => {}
};
vm.createContext(closingContext);
vm.runInContext(source.slice(closingStart, closingEnd), closingContext);

assert.equal(
  closingContext.hasScriptedClosingIntent("ありがとうございます。"),
  false,
  "日時確定前の一般的なお礼を終話として誤認識しています"
);
closingContext.state.proposedAppointment = { month: 9, day: 10, hour: 9 };
assert.equal(
  closingContext.hasScriptedClosingIntent("ありがとうございます。"),
  false,
  "日時確定後の会話途中のお礼を終話として誤認識しています"
);
assert.equal(
  closingContext.isInspectionFinalClosingThanks("ありがとうございました。"),
  true,
  "最終の『ありがとうございました』をマイク終了条件として認識できません"
);
for (const phrase of [
  "ありがとうございます。",
  "よろしくお願いいたします。",
  "失礼いたします。"
]) {
  assert.equal(
    closingContext.isInspectionFinalClosingThanks(phrase),
    false,
    `最終の『ありがとうございました』以外でマイク終了条件を満たしています: ${phrase}`
  );
}
for (const phrase of [
  "ありがとうございました。",
  "よろしくお願いいたします。",
  "それでは当日よろしくお願いいたします。",
  "失礼いたします。"
]) {
  assert.equal(
    closingContext.hasScriptedClosingIntent(phrase),
    true,
    `日時確定後の自然な終話表現を認識できません: ${phrase}`
  );
}

assert.match(
  source,
  /step\.key === "closed_politely"[\s\S]*?ありがとうございました/,
  "最終工程で『ありがとうございます』と『ありがとうございました』を区別していません"
);
assert.match(
  source,
  /const finished = reachedEnd && isInspectionFinalClosingThanks\(text\)/,
  "最終の『ありがとうございました』以外で通常進行が終了する可能性があります"
);
assert.match(
  source,
  /const finishedAfterSkip = reachedEndAfterSkip && isInspectionFinalClosingThanks\(text\)/,
  "任意項目の省略後に『ありがとうございました』なしで終了する可能性があります"
);

const remembered = [];
closingContext.scenario.steps = [
  { key: "current" },
  { key: "explained_documents" },
  { key: "explained_lock_and_arrival" },
  { key: "closed_politely" }
];
closingContext.scriptedStepMatches = (text, step) => text.includes(step.key);
closingContext.markScriptedStepPassed = (step) => remembered.push(step.key);
closingContext.rememberFutureScriptedAchievements(
  "explained_documents explained_lock_and_arrival closed_politely",
  0
);
assert.deepEqual(
  remembered,
  ["explained_documents", "explained_lock_and_arrival"],
  "後工程の確認済み項目を会話全体で記憶できません"
);

assert.match(
  source,
  /alreadyAsked[\s\S]*?maySkipRepeatedQuestion[\s\S]*?同じ質問は繰り返さず/,
  "同じ聞き返しを一度で打ち切る処理がありません"
);
assert.match(
  source,
  /optionalAfterAppointment[\s\S]*?未確認項目を聞き返さず先へ進みました/,
  "日時確定後の任意項目を聞き返さず進む処理がありません"
);
assert.match(
  source,
  /const maySkipRepeatedQuestion = step\.key !== "closed_politely"/,
  "一度確認した未確定日時から後工程へ進む処理が見つかりません"
);
assert.match(
  source,
  /実際の終話あいさつだけは自動スキップしない/,
  "終話工程を自動スキップしない意図が明記されていません"
);

console.log("車検誘致・会話記憶と重複質問防止テスト: OK");
