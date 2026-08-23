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
for (const phrase of [
  "ありがとうございます。",
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
  /step\.key !== "proposed_appointment"/,
  "入庫日時の最低条件まで再質問禁止の対象になっています"
);

console.log("車検誘致・会話記憶と重複質問防止テスト: OK");
