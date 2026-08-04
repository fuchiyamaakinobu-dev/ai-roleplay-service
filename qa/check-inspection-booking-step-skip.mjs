import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const proposalStart = appSource.indexOf("function hasInspectionAppointmentProposalEvidence");
const proposalEnd = appSource.indexOf("function advancedPastScriptedStep", proposalStart);
assert.notEqual(proposalStart, -1, "予約日時の先行提案判定が見つかりません");
assert.notEqual(proposalEnd, -1, "予約日時の先行提案判定の終端が見つかりません");

const proposalContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text)
};
vm.createContext(proposalContext);
vm.runInContext(appSource.slice(proposalStart, proposalEnd), proposalContext);

assert.equal(
  proposalContext.hasInspectionAppointmentProposalEvidence("今月なんですが、8月20日はいかがでしょうか？"),
  true,
  "具体的な日付の先行提案を認識できません"
);
assert.equal(
  proposalContext.hasInspectionAppointmentProposalEvidence("8月20日です。"),
  false,
  "質問・提案ではない日付の言及を先行提案として扱っています"
);
assert.equal(
  proposalContext.hasInspectionAppointmentProposalEvidence("このまま予約を進めてもよろしいでしょうか？"),
  false,
  "具体的な日時のない予約手続き確認を日時提案として扱っています"
);

const retryStart = appSource.indexOf("function scriptedRetryForMissingDetails");
const retryEnd = appSource.indexOf("function naturalScriptedRetryVariants", retryStart);
assert.notEqual(retryStart, -1, "不足項目の聞き返し関数が見つかりません");
assert.notEqual(retryEnd, -1, "不足項目の聞き返し関数の終端が見つかりません");

const retryContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  hasSupportedInspectionDuration: () => false
};
vm.createContext(retryContext);
vm.runInContext(appSource.slice(retryStart, retryEnd), retryContext);

const dateOnlyRetry = retryContext.scriptedRetryForMissingDetails(
  "8月20日はいかがでしょうか？",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(dateOnlyRetry.text, "何時が空いていますか？", "日付提示後に時刻だけを確認できません");
assert.equal(dateOnlyRetry.missingDetail, "appointmentTime", "日付提示後の不足項目が時刻になっていません");

const timeOnlyRetry = retryContext.scriptedRetryForMissingDetails(
  "4時はいかがでしょうか？",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(timeOnlyRetry.text, "何日の予定ですか？", "時刻提示後に日付だけを確認できません");

assert.match(
  appSource,
  /step\.key === "confirmed_booking_time"[\s\S]*?hasInspectionAppointmentProposalEvidence\(text\)[\s\S]*?skippedAnalysis\.canAdvance = true[\s\S]*?skippedAnalysis\.blocked = false[\s\S]*?handleScriptedStaffReply\(text\)/,
  "予約手続き確認を未達として残し、日時調整へ進む処理が見つかりません"
);

console.log("予約手続き確認省略後の日時調整テスト: OK");
