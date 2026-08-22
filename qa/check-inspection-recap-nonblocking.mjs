import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function analyzeScriptedStaff");
const end = source.indexOf("function scriptedStepCanAdvanceOnFailure", start);

assert.notEqual(start, -1, "車検誘致のスタッフ発話解析が見つかりません");
assert.notEqual(end, -1, "スタッフ発話解析の終端が見つかりません");

const context = {
  state: {
    proposedAppointment: { month: 9, day: 10, hour: 9 },
    analyses: [],
    inspectionMileageAsked: true,
    inspectionLoanerRequested: false
  },
  normalizeScriptedText(text) {
    return String(text || "").replace(/\s+/g, "");
  },
  scriptedRequiredGroupsMatch(normalized, step, matchedGroups) {
    return matchedGroups.every((matches) => matches.length > 0);
  },
  scriptedStepSpecificMatches() {
    return true;
  },
  scriptedStepCanAdvanceOnFailure() {
    return false;
  },
  hasSupportedInspectionDuration() {
    return false;
  }
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const recapStep = {
  key: "recapped_appointment",
  expected: "お客様名と予約日時を復唱する",
  requiredGroups: [["佐藤"], ["9月"], ["10日"], ["9時"], ["お待ち", "予約", "よろしく"]]
};

const dateTimeOnly = context.analyzeScriptedStaff(
  "9月10日の9時半でございます。",
  recapStep
);
assert.equal(dateTimeOnly.passed, false, "氏名なしの復唱を採点達成にしています");
assert.equal(dateTimeOnly.canAdvance, true, "確定日時が一致する復唱で会話を停止しています");
assert.equal(dateTimeOnly.blocked, false, "確定日時が一致する復唱を聞き返し対象にしています");

context.state.analyses = [];
const wrongDate = context.analyzeScriptedStaff(
  "9月11日の9時半でございます。",
  recapStep
);
assert.equal(wrongDate.passed, false);
assert.equal(wrongDate.canAdvance, true, "予約日が違う復唱で会話を停止しています");
assert.equal(wrongDate.blocked, false, "予約日が違う復唱を聞き返し対象にしています");

context.state.analyses = [];
const completeRecap = context.analyzeScriptedStaff(
  "佐藤様、9月10日の9時半にお待ちしております。",
  recapStep
);
assert.equal(completeRecap.passed, true, "氏名と確定日時がそろう復唱を採点達成にできません");
assert.equal(completeRecap.canAdvance, true);

console.log("車検誘致・予約日時復唱の非ブロッキング判定テスト: OK");
