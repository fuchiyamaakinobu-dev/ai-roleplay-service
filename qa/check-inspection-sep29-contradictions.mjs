import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} が見つかりません`);
  assert.notEqual(end, -1, `${endMarker} が見つかりません`);
  return source.slice(start, end);
}

const context = {};
vm.createContext(context);
vm.runInContext(
  sourceBetween("function normalizeScriptedText", "function hasSupportedInspectionDuration"),
  context
);
vm.runInContext(
  sourceBetween("function isScriptedQuestion", "function scriptedStepSpecificMatches"),
  context
);
vm.runInContext(
  sourceBetween("function inspectionLastQuestionClause", "function isInspectionOperationalNoiseUtterance"),
  context
);
vm.runInContext(
  sourceBetween("function asksInspectionCallTimingPermission", "function analyzeStaff"),
  context
);
vm.runInContext(
  sourceBetween("function asksInspectionReminderContactDestination", "function scriptedRequiredGroupsMatch"),
  context
);

const concernsAfterLoaner = "かしこまりました。代車の方もご用意しておきます。佐藤様、車検のほかに何か気になるところはございませんか？";
const lastQuestion = context.inspectionLastQuestionClause(concernsAfterLoaner);
assert.match(lastQuestion, /気になるところ/);
assert.equal(
  context.asksInspectionVehicleConcerns(lastQuestion),
  true,
  "代車手配と同じ発話の最後にある車両状態質問を認識できません"
);

assert.equal(
  context.asksInspectionCallTimingPermission("あともう少しだけお電話大丈夫ですか？"),
  true,
  "『もう少しだけお電話大丈夫ですか』を通話継続確認として認識できません"
);

assert.equal(
  context.asksInspectionReminderContactDestination(
    "車検の3日前に確認のお電話をしますが、こちらのお電話にかけさせていただいてもよろしいでしょうか？"
  ),
  true,
  "『こちらのお電話』を3日前連絡先の確認として認識できません"
);

assert.match(
  source,
  /asksVehicleConcernsQuestion = asksInspectionVehicleConcerns\(decisionText\)[\s\S]*?asksInspectionVehicleConcerns\(text\)/,
  "複合発話の車両状態質問を発話全体から補助判定できません"
);
assert.match(
  source,
  /if \(asksVehicleConcernsQuestion\)[\s\S]*?オイル交換もお願いしたいです。/,
  "車両状態質問へ具体的なオイル交換希望を返せません"
);
assert.match(
  source,
  /不足している必要書類（\$\{missingDocuments\.join\("・"\)\}）/,
  "荷物説明済みの場合に不足書類だけを改善点へ表示できません"
);
assert.match(
  source,
  /予約日時の復唱にお客様名を添える/,
  "日時を復唱済みの場合に不足しているお客様名だけを改善表示できません"
);

console.log("2026-09-29 会話矛盾の個別修正テスト: OK");
