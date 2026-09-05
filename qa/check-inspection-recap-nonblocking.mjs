import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const start = source.indexOf("function analyzeScriptedStaff");
const end = source.indexOf("function scriptedStepCanAdvanceOnFailure", start);

assert.notEqual(start, -1, "車検誘致のスタッフ発話解析が見つかりません");
assert.notEqual(end, -1, "スタッフ発話解析の終端が見つかりません");

const context = {
  state: {
    proposedAppointment: { month: 9, day: 10, hour: 9, minute: 30 },
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
  },
  hasConfirmedInspectionAppointmentRecap(text) {
    const normalized = String(text || "").replace(/\s+/g, "");
    return /佐藤/.test(normalized)
      && /9月10日/.test(normalized)
      && /9時(?:半|30分)/.test(normalized)
      && /お待ちしております/.test(normalized);
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
const wrongMinute = context.analyzeScriptedStaff(
  "佐藤様、9月10日の9時にお待ちしております。",
  recapStep
);
assert.equal(wrongMinute.passed, false, "9時30分の予約を9時と復唱して加点しています");
assert.equal(wrongMinute.canAdvance, true, "分が異なる復唱で会話を停止しています");

context.state.analyses = [];
const completeRecap = context.analyzeScriptedStaff(
  "佐藤様、9月10日の9時半にお待ちしております。",
  recapStep
);
assert.equal(completeRecap.passed, true, "氏名と確定日時がそろう復唱を採点達成にできません");
assert.equal(completeRecap.canAdvance, true);

assert.match(
  source,
  /step\.key === "recapped_appointment"[\s\S]*?text: "ん！？、何日の予定でしたっけ？"[\s\S]*?audioId: "inspection_recapped_appointment_retry"/,
  "予約復唱不足時の表示文と音声IDが新しい文言へ固定されていません"
);
assert.match(
  audioSource,
  /"inspection_recapped_appointment_retry"[^\n]*"ん！？、何日の予定でしたっけ？"/,
  "予約復唱不足時の音声登録文が表示文と一致していません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_recapped_appointment_retry.mp3", import.meta.url)),
  true,
  "予約復唱不足時のMP3がありません"
);

console.log("車検誘致・予約日時復唱の非ブロッキング判定テスト: OK");
