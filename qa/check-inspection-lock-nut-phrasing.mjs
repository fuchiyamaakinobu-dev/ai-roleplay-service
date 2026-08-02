import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function normalizeScriptedText");
const helperEnd = appSource.indexOf("function analyzeScriptedStaff", helperStart);
assert.notEqual(helperStart, -1, "車検誘致用の正規化関数が見つかりません");
assert.notEqual(helperEnd, -1, "ロックナット用具判定関数の終端が見つかりません");

const context = {};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

for (const phrase of [
  "ロックナットキーをお持ちください",
  "ロックキーをご用意ください",
  "アダプターをお持ちください",
  "ロックナットを外す工具をお持ちください",
  "専用工具をご用意ください",
  "ホイールナットを外す道具をお持ちください"
]) {
  assert.equal(context.hasLockNutToolExpression(phrase), true, `${phrase}をロックナット用具として認識できません`);
}

for (const phrase of ["工具を持ってきてください", "道具を用意してください", "キーを持ってきてください"]) {
  assert.equal(context.hasLockNutToolExpression(phrase), false, `${phrase}を文脈なしで誤認識しています`);
}

assert.match(
  scenarioSource,
  /requiredGroups:\s*\[\["ロックナットキー",\s*"ロックキー",\s*"アダプター",\s*"キー",\s*"工具",\s*"道具"\],\s*\["15分",\s*"十五分"\]/,
  "ロックナット用具の言い換えと15分前来店が別条件になっていません"
);

console.log("ロックナット用具の言い換え判定テスト: OK");
