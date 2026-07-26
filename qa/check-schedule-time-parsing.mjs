import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function normalizeFullWidthDigits(");
const end = source.indexOf("function isMorningTimeBandOffer(", start);

assert.notEqual(start, -1, "全角数字の正規化関数が見つかりません");
assert.notEqual(end, -1, "時刻抽出関数を切り出せません");

const context = {};
vm.createContext(context);
vm.runInContext(`
  ${source.slice(start, end)}
  this.normalizeFullWidthDigits = normalizeFullWidthDigits;
  this.extractScheduleTimeOptions = extractScheduleTimeOptions;
`, context);

const targetText = context.normalizeFullWidthDigits(
  "午前中ですと10時、お昼からですと４時に空きがあります"
);
assert.equal(targetText.includes("4時"), true, "全角の４時を半角へ正規化できません");
assert.deepEqual(
  [...context.extractScheduleTimeOptions(targetText)],
  ["10時", "16時"],
  "午前10時とお昼からの4時を、10時・16時の候補として抽出できません"
);

assert.deepEqual(
  [...context.extractScheduleTimeOptions("午前10時、午後4時")],
  ["10時", "16時"],
  "午後4時を16時として抽出できません"
);

assert.deepEqual(
  [...context.extractScheduleTimeOptions("午後4時と午前10時")],
  ["16時", "10時"],
  "時刻ごとの午前・午後の文脈を区別できません"
);

assert.deepEqual(
  [...context.extractScheduleTimeOptions("11時または15時")],
  ["11時", "15時"],
  "既存の半角24時間表記を維持できません"
);

const afternoonMappings = [
  ["午後１時", "13時"],
  ["午後２時", "14時"],
  ["午後３時", "15時"],
  ["午後４時", "16時"],
  ["午後５時", "17時"]
];
for (const [spokenTime, expectedTime] of afternoonMappings) {
  const normalizedTime = context.normalizeFullWidthDigits(spokenTime);
  assert.deepEqual(
    [...context.extractScheduleTimeOptions(normalizedTime)],
    [expectedTime],
    `${spokenTime}を${expectedTime}として認識できません`
  );
}

const duplicateFourOClock = context.normalizeFullWidthDigits("午後４時または16時");
assert.deepEqual(
  [...context.extractScheduleTimeOptions(duplicateFourOClock)],
  ["16時"],
  "午後４時と16時を同じ候補としてまとめられません"
);

console.log("全角数字・午前午後の時刻候補判定テスト: OK");
