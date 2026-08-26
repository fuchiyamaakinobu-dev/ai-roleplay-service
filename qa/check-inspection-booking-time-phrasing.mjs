import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function normalizeScriptedText");
const questionEnd = appSource.indexOf("function scriptedStepSpecificMatches", helperStart);
assert.notEqual(helperStart, -1, "車検誘致用の正規化関数が見つかりません");
assert.notEqual(questionEnd, -1, "予約手続き確認判定関数の終端が見つかりません");

const source = appSource.slice(helperStart, questionEnd);
const questionStart = source.indexOf("function isScriptedQuestion");
const bookingStart = source.indexOf("function hasBookingContinuationConfirmation");
assert.notEqual(questionStart, -1, "質問文判定関数が見つかりません");
assert.notEqual(bookingStart, -1, "予約手続き確認判定関数が見つかりません");

const context = {};
vm.createContext(context);
vm.runInContext(
  `${source.slice(0, source.indexOf("function analyzeScriptedStaff"))}\n${source.slice(questionStart)}`,
  context
);

for (const phrase of [
  "予約手続きに10分程度かかりますがよろしいでしょうか？",
  "もう少しお時間ありますか？",
  "もう少しお時間ございますでしょうか？",
  "お時間をいただいてもよろしいですか？",
  "このまま予約を進めてもよろしいですか？",
  "このままご役を進めさせていただいてもよろしいでしょうか？",
  "予約のお手続きを続けても大丈夫ですか？",
  "よろしければご予約をいただければと思いますが、いかがでしょうか？"
]) {
  assert.equal(context.hasBookingContinuationConfirmation(phrase), true, `${phrase}を了承確認として認識できません`);
}

for (const phrase of [
  "予約手続きには10分かかります。",
  "もう少しです。",
  "お時間です。",
  "大丈夫です。"
]) {
  assert.equal(context.hasBookingContinuationConfirmation(phrase), false, `${phrase}を了承確認として誤認識しています`);
}

assert.match(
  scenarioSource,
  /key:\s*"confirmed_booking_time"[\s\S]*?requiredGroups:\s*\[\["10分",\s*"十分",\s*"もう少し"/,
  "予約手続き確認の言い換えがシナリオ条件へ登録されていません"
);

assert.match(
  appSource,
  /step\.key === "confirmed_booking_time"[\s\S]*?return hasBookingContinuationConfirmation\(normalized\)/,
  "Firestoreの旧必須語が残っていても予約続行確認を優先する処理が見つかりません"
);

console.log("予約手続き確認の言い換え判定テスト: OK");
