import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function normalizeScriptedText");
const helperEnd = appSource.indexOf("function hasCourtesyExpression", helperStart);
assert.notEqual(helperStart, -1, "車検誘致の会話判定関数が見つかりません");
assert.notEqual(helperEnd, -1, "車検誘致の会話判定関数の終端が見つかりません");

const context = {
  state: { inspectionMileageAsked: false },
  scenario: { customerName: "佐藤様", expiryDate: "9月30日" }
};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

const concernStep = {
  key: "asked_vehicle_concerns",
  requiredGroups: [["気になる", "不具合", "調子", "具合"]]
};
for (const phrase of [
  "何かお使いになっていて気になるところはございませんでしょうか？",
  "調子の悪いところはございますでしょうか？",
  "お車で何か不具合はありませんか？"
]) {
  assert.equal(
    context.scriptedStepMatches(phrase, concernStep),
    true,
    `${phrase} を車両状態の質問として認識できません`
  );
}
assert.equal(
  context.scriptedStepMatches("調子は良いですね。", concernStep),
  false,
  "質問ではない車両状態の言及を誤認識しています"
);

const earlyConcernStart = appSource.indexOf("const concernStepIndex = scenario.steps.findIndex");
const closingIntentStart = appSource.indexOf("const closingIntent = hasScriptedClosingIntent", earlyConcernStart);
assert.notEqual(earlyConcernStart, -1, "前倒し車両状態確認の分岐がありません");
assert.notEqual(closingIntentStart, -1, "前倒し車両状態確認が通常判定より前にありません");
const earlyConcernBlock = appSource.slice(earlyConcernStart, closingIntentStart);
assert.match(earlyConcernBlock, /scriptedStepMatches\(text, concernStep\)/);
assert.match(earlyConcernBlock, /analyzeScriptedStaff\(text, concernStep\)/);
assert.match(earlyConcernBlock, /state\.scriptedPartialReplies\[step\.key\]/);
assert.match(earlyConcernBlock, /オイル交換もお願いしたいです。/);
assert.match(earlyConcernBlock, /inspection_asked_vehicle_concerns_customer/);
assert.match(
  appSource,
  /responseStep\.key === "asked_vehicle_concerns"[\s\S]*?text:\s*"オイル交換もお願いしたいです。"[\s\S]*?audioId:\s*"inspection_asked_vehicle_concerns_customer"/,
  "Firestore公開データに旧返答が残る場合の優先返答がありません"
);

assert.match(
  scenarioSource,
  /key:\s*"asked_vehicle_concerns"[\s\S]*?customerResponse:\s*"オイル交換もお願いしたいです。"/,
  "通常の車両状態確認後のお客様返答が更新されていません"
);
assert.match(
  audioDbSource,
  /inspection_asked_vehicle_concerns_customer",\s*"車両状態確認・オイル交換希望",\s*"オイル交換もお願いしたいです。",\s*"pending"/,
  "表示文と音声登録文が一致していません"
);
assert.doesNotMatch(
  scenarioSource + audioDbSource,
  /inspection_asked_vehicle_concerns_customer"[^\n]*別にないです。|key:\s*"asked_vehicle_concerns"[\s\S]*?customerResponse:\s*"別にないです。"/,
  "車両状態確認後の旧返答が残っています"
);

console.log("inspection early concern reply checks passed");
