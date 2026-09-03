import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(
  source,
  /inspectionWaitingMethod:\s*null/,
  "店内待ち・代車の確定方法を保持する状態がありません"
);
assert.equal(
  (source.match(/state\.inspectionWaitingMethod = null/g) || []).length,
  2,
  "シナリオ切替と開始時に待ち方を初期化できません"
);
assert.match(
  source,
  /asksInspectionLoanerNeed\(text\)[\s\S]*?inspectionWaitingMethod === "store"[\s\S]*?代車は必要ありません。/,
  "店内待ち確定後に代車を断る分岐がありません"
);
assert.match(
  source,
  /inspectionWaitingMethod === "loaner"[\s\S]*?asksInspectionWaitingMethodConfirmation\(text\)[\s\S]*?代車をお願いします。/,
  "代車確定後に店内待ちへ変更しない分岐がありません"
);
assert.match(
  source,
  /finalCustomerResponseText === "待っています。"[\s\S]*?inspectionWaitingMethod = "store"/,
  "店内待ちの確定を保存できません"
);
assert.match(
  source,
  /hasInspectionReminderContactConfirmation\(text\)[\s\S]*?asksInspectionReminderContactDestination\(text\)[\s\S]*?inspectionReminderContactAnswered[\s\S]*?この携帯にお願いします。/,
  "3日前確認連絡の連絡先質問へ明確に回答できません"
);
assert.match(
  source,
  /\(state\.proposedAppointment \|\| state\.inspectionAppointmentIncomplete\)[\s\S]*?isInspectionFinalClosingThanks\(text\)[\s\S]*?inspection_closed_politely_customer[\s\S]*?finishRoleplay/,
  "最終のお礼を連絡先確認より先に処理して終話できません"
);
assert.match(
  source,
  /repeatedInspectionCoreStepAfterAppointment\(text\)[\s\S]*?continueSpeechInputWithoutCustomerReply/,
  "予約確定後の本人確認・名乗り・用件への逆戻りを無音で抑止できません"
);
assert.match(
  source,
  /state\.scriptStep = closingIndex;[\s\S]*?state\.inspectionClosingPending = true;[\s\S]*?handleScriptedStaffReply\(text\);/,
  "終話待ちの状態で前工程へ戻らない処理がありません"
);
assert.match(
  source,
  /confirmedInspectionAppointmentMatches\(text\)[\s\S]*?予約は先ほどの日時でお願いします。/,
  "確定後に異なる予約日時へ自動変更しない処理がありません"
);
assert.match(
  source,
  /const sameAppointment = confirmedInspectionAppointmentMatches\(text\);[\s\S]*?if \(sameAppointment\)[\s\S]*?continueSpeechInputWithoutCustomerReply/,
  "確認済みの同一日時へAIが回答を繰り返しています"
);
assert.match(
  source,
  /availabilityStepIndex > state\.scriptStep[\s\S]*?hasInspectionAvailabilityRequest\(text\)[\s\S]*?お願いしたいんですけど、いつできますか？/,
  "前工程と同じ発話内の都合確認より定型返答を優先しています"
);

console.log("直近実施ログ・会話矛盾再発防止テスト: OK");
