import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const bookingConfirmationStart = appSource.indexOf("function hasBookingContinuationConfirmation");
const bookingConfirmationEnd = appSource.indexOf("function hasInspectionBookingInvitation", bookingConfirmationStart);
assert.notEqual(bookingConfirmationStart, -1, "予約手続き時間の判定が見つかりません");
assert.notEqual(bookingConfirmationEnd, -1, "予約手続き時間の判定終端が見つかりません");

const bookingConfirmationContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text)
};
vm.createContext(bookingConfirmationContext);
vm.runInContext(
  appSource.slice(bookingConfirmationStart, bookingConfirmationEnd),
  bookingConfirmationContext
);

assert.equal(
  bookingConfirmationContext.hasExplicitBookingContinuationConfirmation(
    "予約のお電話に15分程度お時間がかかりますが、よろしいでしょうか？"
  ),
  true,
  "予約文脈を含む15分の了承確認を認識できません"
);
assert.equal(
  bookingConfirmationContext.hasExplicitBookingContinuationConfirmation("もう少しお時間ありますか？"),
  false,
  "一般的な時間確認だけで予約手続きへ大幅に工程を飛ばしています"
);

const proposalStart = appSource.indexOf("function hasInspectionAppointmentProposalEvidence");
const proposalEnd = appSource.indexOf("function advancedPastScriptedStep", proposalStart);
assert.notEqual(proposalStart, -1, "予約日時の先行提案判定が見つかりません");
assert.notEqual(proposalEnd, -1, "予約日時の先行提案判定の終端が見つかりません");

const proposalContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text),
  asksInspectionDayPreference: (text) => /(?:平日|土日|週末|曜日)/.test(text)
    && /(?:どちら|希望|都合|よろしい|良い)/.test(text)
    && /(?:でしょうか|ますか|ですか|[?？])/.test(text)
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
assert.equal(
  proposalContext.hasInspectionAppointmentCoordinationEvidence("ありがとうございます。土曜日。時間は何時ぐらいからご都合よろしいでしょう。"),
  true,
  "曜日と希望時間帯の質問を日時調整の開始として認識できません"
);
assert.equal(
  proposalContext.hasInspectionAppointmentCoordinationEvidence("土曜日に改めてお電話します。"),
  false,
  "単なる曜日の言及を日時調整として誤認識しています"
);
assert.equal(
  proposalContext.hasInspectionAppointmentCoordinationEvidence("ご都合なんですが、いつぐらいとかご希望ありますでしょうか？"),
  true,
  "具体値のない希望日時質問を日時調整の開始として認識できません"
);
assert.equal(
  proposalContext.hasInspectionAppointmentCoordinationEvidence("いつもありがとうございます。ほかにご希望はありますか？"),
  false,
  "日程と無関係な希望確認を日時調整として誤認識しています"
);
assert.equal(
  proposalContext.hasInspectionAppointmentCoordinationEvidence("平日と土日では、どちらがよろしいでしょうか？"),
  true,
  "曜日だけの選択質問を日時調整の開始として認識できません"
);

const retryStart = appSource.indexOf("function scriptedRetryForMissingDetails");
const retryEnd = appSource.indexOf("function naturalScriptedRetryVariants", retryStart);
assert.notEqual(retryStart, -1, "不足項目の聞き返し関数が見つかりません");
assert.notEqual(retryEnd, -1, "不足項目の聞き返し関数の終端が見つかりません");

const retryContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  inspectionAppointmentDateCandidates: proposalContext.inspectionAppointmentDateCandidates,
  hasSupportedInspectionDuration: () => false,
  hasInspectionScheduleQuestionIntent: (text) => /(?:でしょうか|ますか|ですか|[?？]|(?:ご)?都合.{0,12}(?:よろしい|良い|いい)(?:でしょう)?)/.test(text),
  asksInspectionDayPreference: (text) => /(?:平日|土日|週末|曜日)/.test(text)
    && /(?:どちら|希望|都合|よろしい|良い)/.test(text)
    && /(?:でしょうか|ますか|ですか|[?？])/.test(text)
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

const weekdayTimePreferenceRetry = retryContext.scriptedRetryForMissingDetails(
  "ありがとうございます。土曜日。期間は何時ぐらいからご都合よろしいでしょう。",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(
  weekdayTimePreferenceRetry.text,
  "午前中でお願いします。何日の予定ですか？",
  "曜日と時間帯を尋ねられた後に、希望時間帯へ答えて日付だけを確認できません"
);
assert.equal(
  weekdayTimePreferenceRetry.audioId,
  "inspection_appointment_morning_need_date",
  "曜日・時間帯質問後の音声IDが一致していません"
);

const openPreferenceRetry = retryContext.scriptedRetryForMissingDetails(
  "ご都合なんですが、いつぐらいとかご希望ありますでしょうか？",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(
  openPreferenceRetry.text,
  "具体的な日時を教えてください。",
  "希望日時を質問された後に既存の具体日時確認へ進みません"
);

const dayChoiceRetry = retryContext.scriptedRetryForMissingDetails(
  "ありがとうございます。平日と土日では、どちらがよろしいでしょうか？",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(dayChoiceRetry.text, "土日がいいです。", "曜日選択質問へ希望曜日を回答できません");
assert.equal(
  dayChoiceRetry.audioId,
  "inspection_day_preference_answer",
  "曜日選択質問後の既存音声IDが一致していません"
);

const availabilityDayChoice = "8月11日以降でしたら作業可能です。平日と週末ではどちらがよろしいでしょうか？";
const availabilityDayChoiceRetry = retryContext.scriptedRetryForMissingDetails(
  availabilityDayChoice,
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(
  availabilityDayChoiceRetry.text,
  "土日がいいです。",
  "入庫可能日を予約日と誤認し、曜日希望への回答を省略しています"
);
assert.equal(
  availabilityDayChoiceRetry.missingDetail,
  "appointmentDate",
  "入庫可能日の案内後に具体的な予約日が確定扱いになっています"
);

const availabilityThenTimeRetry = retryContext.scriptedRetryForMissingDetails(
  `${availabilityDayChoice} 今のところ空いていますが、朝10時半はいかがでしょうか？`,
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(
  availabilityThenTimeRetry.text,
  "何日の予定ですか？",
  "入庫可能日と時刻を合成して予約確定へ進んでいます"
);

assert.match(
  appSource,
  /step\.key === "confirmed_booking_time"[\s\S]*?hasInspectionAppointmentCoordinationEvidence\(text\)[\s\S]*?skippedAnalysis\.canAdvance = true[\s\S]*?skippedAnalysis\.blocked = false[\s\S]*?handleScriptedStaffReply\(text\)/,
  "予約手続き確認を未達として残し、日時調整へ進む処理が見つかりません"
);

assert.match(
  appSource,
  /bookingTimeIndex > state\.scriptStep[\s\S]*?hasExplicitBookingContinuationConfirmation\(text\)[\s\S]*?recordSkippedScriptedSteps[\s\S]*?state\.scriptStep = bookingTimeIndex[\s\S]*?handleScriptedStaffReply\(text\)/,
  "明確な予約時間確認へ回答し、前工程へ戻らない処理が見つかりません"
);

assert.match(
  audioDbSource,
  /inspection_appointment_time_missing_retry"[^\n]*"何時が空いていますか？"/,
  "時刻不足時のお客様発話が登録されていません"
);
assert.match(
  audioDbSource,
  /inspection_appointment_date_missing_retry"[^\n]*"何日の予定ですか？"/,
  "日付不足時のお客様発話が登録されていません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_appointment_time_missing_retry.mp3", import.meta.url)),
  true,
  "時刻不足時のMP3が見つかりません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_appointment_date_missing_retry.mp3", import.meta.url)),
  true,
  "日付不足時のMP3が見つかりません"
);
assert.match(
  audioDbSource,
  /inspection_appointment_morning_need_date"[^\n]*"午前中でお願いします。何日の予定ですか？"/,
  "曜日・時間帯質問後のお客様発話が登録されていません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_appointment_morning_need_date.mp3", import.meta.url)),
  true,
  "曜日・時間帯質問後のMP3が見つかりません"
);

console.log("予約手続き確認省略後の日時調整テスト: OK");
