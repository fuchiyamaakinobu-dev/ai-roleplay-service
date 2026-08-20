import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const proposalStart = source.indexOf("function hasInspectionAppointmentProposalEvidence");
const proposalEnd = source.indexOf("function hasInspectionScheduleQuestionIntent", proposalStart);

assert.notEqual(proposalStart, -1, "予約日時提案判定が見つかりません");
assert.notEqual(proposalEnd, -1, "予約日時提案判定の終端が見つかりません");

const context = {};
vm.createContext(context);
vm.runInContext(`
  function normalizeScriptedText(text) { return String(text).replace(/\\s+/g, ""); }
  function isScriptedQuestion(text) { return /(?:でしょうか|ますか|ですか|[?？])/.test(text); }
  ${source.slice(proposalStart, proposalEnd)}
  this.hasCompleteInspectionAppointmentProposal = hasCompleteInspectionAppointmentProposal;
`, context);

assert.equal(
  context.hasCompleteInspectionAppointmentProposal("8月20日の10時はいかがでしょうか？"),
  true,
  "具体的な月日・時刻の予約提案を認識できません"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("8月20日はいかがでしょうか？"),
  false,
  "日付だけで入庫日時確定へ進んでいます"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("10時はいかがでしょうか？"),
  false,
  "時刻だけで入庫日時確定へ進んでいます"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("8月11日以降でしたら作業可能ですが、朝10時半はいかがでしょうか？"),
  false,
  "入庫可能期間の開始日と時刻を予約日時として誤認識しています"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("車検は9月30日までです。8月1日から作業可能ですが、10時はいかがでしょうか？"),
  false,
  "満了日・入庫可能日と時刻を予約日時として誤認識しています"
);
assert.equal(
  context.hasCompleteInspectionAppointmentProposal("8月11日以降でしたら作業可能です。8月20日の10時はいかがでしょうか？"),
  true,
  "入庫可能日の後に提示された具体的な予約日時を認識できません"
);

assert.match(
  source,
  /appointmentIndex > state\.scriptStep[\s\S]*?hasCompleteInspectionAppointmentProposal\(text\)[\s\S]*?recordSkippedStepsBeforeAppointment[\s\S]*?state\.scriptStep = appointmentIndex[\s\S]*?handleScriptedStaffReply\(text\)/,
  "未確認の過去工程を未達のまま日時工程へ進める処理が見つかりません"
);
assert.match(
  source,
  /closingIntent[\s\S]*?state\.proposedAppointment[\s\S]*?step\.optionalAfterAppointment[\s\S]*?scriptedStepMatches\(text, closingStep\)[\s\S]*?finishRoleplay/,
  "日時確定後の終話あいさつで終了する処理が見つかりません"
);

console.log("車検誘致・入庫日時を最低限とする終話テスト: OK");
