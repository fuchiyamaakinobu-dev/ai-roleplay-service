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
  /asksInspectionLoanerNeed\(text\)[\s\S]*?inspectionWaitingMethod === "store"[\s\S]*?待っています。[\s\S]*?inspection_confirmed_waiting_customer/,
  "店内待ち確定後に登録済み音声で待ち方を維持する分岐がありません"
);
assert.match(
  source,
  /inspectionWaitingMethod === "loaner"[\s\S]*?asksInspectionWaitingMethodConfirmation\(decisionText\)[\s\S]*?お願いします。[\s\S]*?inspection_booking_invitation_accept_customer/,
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
  /confirmedInspectionAppointmentMatches\(text\)[\s\S]*?異なる日時でも再確認せず[\s\S]*?continueSpeechInputWithoutCustomerReply/,
  "確定後に異なる予約日時を再確認せず進める処理がありません"
);
assert.match(
  source,
  /const sameAppointment = confirmedInspectionAppointmentMatches\(text\);[\s\S]*?if \(sameAppointment\)[\s\S]*?continueSpeechInputWithoutCustomerReply/,
  "確認済みの同一日時へAIが回答を繰り返しています"
);
assert.match(
  source,
  /asksGeneralInspectionAvailability[\s\S]*?!hasDirectInspectionBookingInvitation\(decisionText\)[\s\S]*?availabilityStepIndex >= 0[\s\S]*?お願いしたいんですけど、いつできますか？/,
  "現在工程の前後を問わず、一般的な都合確認への返答を優先できません"
);
assert.match(
  source,
  /inspection-general-availability-answer[\s\S]*?questionRepeats\[availabilityReplyKey\][\s\S]*?同じ返答を繰り返さず[\s\S]*?continueSpeechInputWithoutCustomerReply/,
  "回答済みの都合確認に同じお客様発話を繰り返しています"
);
assert.match(
  source,
  /durationOnlyWithoutWaiting[\s\S]*?step\.key !== "explained_duration_and_wait"[\s\S]*?お店で待つことはできますか？[\s\S]*?inspection_duration_wait_missing_retry/,
  "順序が前後した作業時間案内から、店内待ちだけを確認できません"
);
assert.match(
  source,
  /questionRepeats\[retryKey\][\s\S]*?同じ質問を繰り返さず[\s\S]*?continueSpeechInputWithoutCustomerReply/,
  "店内待ち確認を一度だけに制限できません"
);
assert.match(
  source,
  /asksWhetherInspectionPlanIsDecided = \/\(\?:ご\)\?予定\/[\s\S]*?if \(asksWhetherInspectionPlanIsDecided\) return true/,
  "『予定＋疑問形』を車検語の誤変換に左右されず判定できません"
);

console.log("直近実施ログ・会話矛盾再発防止テスト: OK");
