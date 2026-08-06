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
  /requiredGroups:\s*\[\["ロックナットキー",\s*"ロックキー",\s*"アダプター",\s*"キー",\s*"工具",\s*"道具"\],\s*\["10分",\s*"十分",\s*"15分",\s*"十五分"\],\s*\["早め",\s*"前"\]/,
  "ロックナット用具と10分・15分前来店が別条件になっていません"
);
assert.match(scenarioSource, /10分または15分前来店/, "10分前と15分前の両方が案内例へ反映されていません");

const arrivalStep = { key: "explained_lock_and_arrival" };
for (const phrase of [
  "ロックナットキーをお持ちいただき、10分前にお越しください",
  "アダプターをお持ちいただき、十分前にお越しください",
  "専用工具をお持ちいただき、15分前にお越しください",
  "ロックキーをお持ちいただき、十五分前にお越しください"
]) {
  assert.equal(
    context.scriptedRequiredGroupsMatch(context.normalizeScriptedText(phrase), arrivalStep, []),
    true,
    `${phrase}をロックナット・早着項目として達成できません`
  );
}
assert.equal(
  context.scriptedRequiredGroupsMatch(
    context.normalizeScriptedText("ロックナットキーをお持ちください"),
    arrivalStep,
    []
  ),
  false,
  "来店前時間の案内なしで項目を達成しています"
);

console.log("ロックナット用具の言い換え判定テスト: OK");
