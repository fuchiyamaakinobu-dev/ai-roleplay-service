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
  sourceBetween("function asksInspectionCallTimingPermission", "function analyzeStaff"),
  context
);
vm.runInContext(
  sourceBetween("function asksInspectionReminderContactDestination", "function scriptedRequiredGroupsMatch"),
  context
);

assert.equal(
  context.asksInspectionCallTimingPermission("今、お電話お時間よろしかったですか？"),
  true,
  "冒頭の通話可否確認を認識できません"
);
for (const phrase of [
  "お電話差し上げますが、今おかけしているこちらの電話番号でよろしいですか？",
  "ご入庫の3日前に確認のお電話を差し上げますが、今おかけしている電話番号でよろしいでしょうか？"
]) {
  assert.equal(
    context.asksInspectionCallTimingPermission(phrase),
    false,
    `${phrase} を冒頭の通話可否確認として誤認しています`
  );
  assert.equal(
    context.asksInspectionReminderContactDestination(phrase),
    true,
    `${phrase} を連絡先確認として認識できません`
  );
}

assert.match(
  source,
  /if \(asksInspectionReminderContactDestination\(decisionText\)\)[\s\S]*?hasCompleteReminderConfirmation = hasInspectionReminderContactConfirmation\(text\)[\s\S]*?if \(hasCompleteReminderConfirmation\)[\s\S]*?markScriptedStepPassed\(reminderStep, text\)[\s\S]*?この携帯にお願いします。/,
  "連絡先質問への返答と3日前確認連絡の採点を分離できません"
);
assert.match(
  source,
  /durationAlreadyExplained = state\.transcript\.some\(\(message\) =>[\s\S]*?hasSupportedInspectionDuration\(message\.text\)[\s\S]*?askedDurationAlready = state\.inspectionDurationQuestionAsked \|\| durationAlreadyExplained/,
  "作業時間の説明済み履歴を走行距離回答へ反映できません"
);

console.log("2026-09-11 targeted inspection reply checks passed");
