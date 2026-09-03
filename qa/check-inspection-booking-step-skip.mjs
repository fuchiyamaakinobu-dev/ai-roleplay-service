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
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text),
  asksInspectionDayPreference: (text) => /(?:平日|土日|週末|曜日)/.test(text)
    && /(?:どちら|希望|都合|よろしい|良い|いかが)/.test(text)
    && /(?:でしょうか|ますか|ですか|[?？])/.test(text)
};
vm.createContext(proposalContext);
const normalizeStart = appSource.indexOf("function normalizeScriptedText");
const normalizeEnd = appSource.indexOf("function hasSupportedInspectionDuration", normalizeStart);
assert.notEqual(normalizeStart, -1, "予約日時判定用の正規化関数が見つかりません");
assert.notEqual(normalizeEnd, -1, "予約日時判定用の正規化関数終端が見つかりません");
vm.runInContext(appSource.slice(normalizeStart, normalizeEnd), proposalContext);
vm.runInContext(appSource.slice(proposalStart, proposalEnd), proposalContext);

assert.equal(
  proposalContext.hasInspectionAppointmentProposalEvidence("今月なんですが、8月20日はいかがでしょうか？"),
  true,
  "具体的な日付の先行提案を認識できません"
);
assert.equal(
  proposalContext.hasInspectionAppointmentProposalEvidence(
    "佐藤様のヤリスは8月1日からできますので、9月の5日土曜日、よろしいですか？"
  ),
  true,
  "『よろしいですか』で提示した具体的な日付を先行提案として認識できません"
);
const firstDayCandidates = proposalContext.inspectionAppointmentDateCandidates(
  "9月の一日はいかがでしょうか？"
);
assert.equal(firstDayCandidates.length, 1, "漢字の『一日』を予約日として認識できません");
assert.equal(firstDayCandidates[0].month, "9", "漢字の『一日』を含む予約月が一致しません");
assert.equal(firstDayCandidates[0].day, "1", "漢字の『一日』を1日として認識できません");
const firstDayAppointment = proposalContext.inspectionAppointmentProposalMatch(
  "9月の一日の10時はいかがでしょうか？"
);
assert.equal(firstDayAppointment?.month, "9", "漢字の『一日』を含む予約日時の月が一致しません");
assert.equal(firstDayAppointment?.day, "1", "漢字の『一日』を含む予約日時の日が一致しません");
assert.equal(firstDayAppointment?.hour, "10", "漢字の『一日』を含む予約日時の時刻が一致しません");
assert.equal(firstDayAppointment?.minute, 0, "分指定のない予約日時を0分として保持できません");
const kanaMonthFirstDayAppointment = proposalContext.inspectionAppointmentProposalMatch(
  "よろしければくがつの一日の10時半から作業できるのですが、いかがでしょうか？"
);
assert.equal(kanaMonthFirstDayAppointment?.month, "9", "『くがつの一日』を9月1日として認識できません");
assert.equal(kanaMonthFirstDayAppointment?.day, "1", "『くがつの一日』の日付が一致しません");
assert.equal(kanaMonthFirstDayAppointment?.hour, "10", "10時半の時が一致しません");
assert.equal(kanaMonthFirstDayAppointment?.minute, 30, "10時半の30分を保持できません");
const explicitMinuteAppointment = proposalContext.inspectionAppointmentProposalMatch(
  "9月1日10時30分はいかがでしょうか？"
);
assert.equal(explicitMinuteAppointment?.minute, 30, "10時30分の分を保持できません");
assert.equal(
  proposalContext.hasInspectionAppointmentProposalEvidence("8月20日です。"),
  false,
  "質問・提案ではない日付の言及を先行提案として扱っています"
);
assert.equal(
  proposalContext.hasInspectionAppointmentProposalEvidence("9月12日土曜日の10時半から作業可能でございます。"),
  true,
  "具体的日時と作業可能を伝えた断定形を予約提案として認識できません"
);
assert.equal(
  proposalContext.hasInspectionAppointmentProposalEvidence("9月12日10時半から作業できます。"),
  true,
  "『作業できます』を含む具体的日時提案を認識できません"
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
assert.equal(
  proposalContext.hasInspectionAppointmentCoordinationEvidence("まず日程ですが、ご希望の日にちはございますでしょうか？"),
  true,
  "希望日の質問を日時調整の開始として認識できません"
);
assert.equal(
  proposalContext.hasInspectionAppointmentCoordinationEvidence("希望の日程を教えてください。"),
  true,
  "希望日を尋ねる依頼表現を日時調整として認識できません"
);

const contextualDayCandidates = proposalContext.inspectionAppointmentDateCandidates(
  "車検は8月1日以降いつでも可能です。来週の火曜日ではいかがでしょうか。次の9日土曜日はいかがでしょうか。"
);
assert.equal(contextualDayCandidates.length, 1, "月の文脈がある『9日土曜日』を予約日として保持できません");
assert.equal(contextualDayCandidates[0].month, "8", "省略された予約日の月を直前の文脈から取得できません");
assert.equal(contextualDayCandidates[0].day, "9", "省略された予約日の日を取得できません");
const contextualAppointment = proposalContext.inspectionAppointmentProposalMatch(
  "車検は8月1日以降いつでも可能です。次の9日土曜日はいかがでしょうか。10時はいかがでしょうか。"
);
assert.equal(contextualAppointment?.month, "8", "月を省略した予約日時の月が一致しません");
assert.equal(contextualAppointment?.day, "9", "月を省略した予約日時の日が一致しません");
assert.equal(contextualAppointment?.hour, "10", "月を省略した日付と後続の時刻を合わせて予約日時を確定できません");

const retryStart = appSource.indexOf("function scriptedRetryForMissingDetails");
const retryEnd = appSource.indexOf("function naturalScriptedRetryVariants", retryStart);
assert.notEqual(retryStart, -1, "不足項目の聞き返し関数が見つかりません");
assert.notEqual(retryEnd, -1, "不足項目の聞き返し関数の終端が見つかりません");

const retryContext = {
  normalizeScriptedText: proposalContext.normalizeScriptedText,
  inspectionAppointmentDateCandidates: proposalContext.inspectionAppointmentDateCandidates,
  asksOpenInspectionDatePreference: proposalContext.asksOpenInspectionDatePreference,
  hasSupportedInspectionDuration: () => false,
  hasInspectionScheduleQuestionIntent: (text) => /(?:でしょうか|ますか|ですか|[?？]|(?:ご)?都合.{0,12}(?:よろしい|良い|いい)(?:でしょう)?)/.test(text),
  asksInspectionDayPreference: (text) => /(?:平日|土日|週末|曜日)/.test(text)
    && /(?:どちら|希望|都合|よろしい|良い|いかが)/.test(text)
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

const firstDayOnlyRetry = retryContext.scriptedRetryForMissingDetails(
  "9月の一日はいかがでしょうか？",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(
  firstDayOnlyRetry.text,
  "何時が空いていますか？",
  "漢字の『一日』を認識した後に日付を繰り返し質問しています"
);
assert.equal(
  firstDayOnlyRetry.missingDetail,
  "appointmentTime",
  "漢字の『一日』を認識した後の不足項目が時刻になっていません"
);

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
  "お願いしたいんですけど、いつできますか？",
  "希望日時を質問された後に自然な空き日確認へ進みません"
);
assert.equal(
  openPreferenceRetry.audioId,
  "inspection_asked_availability_customer",
  "希望日質問後の車検誘致用音声IDが一致していません"
);

const preferredDateRetry = retryContext.scriptedRetryForMissingDetails(
  "まず日程でございますが、ご希望の日にちとかございますでしょうか？",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(
  preferredDateRetry.text,
  "お願いしたいんですけど、いつできますか？",
  "希望日の質問に『具体的な日時を教えてください』と回答しています"
);
assert.equal(
  preferredDateRetry.audioId,
  "inspection_asked_availability_customer",
  "希望日の質問に登録済みまこと音声を使用していません"
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

const contextualDayOnlyRetry = retryContext.scriptedRetryForMissingDetails(
  "車検は8月1日以降いつでも可能です。来週の火曜日ではいかがでしょうか。次の9日土曜日はいかがでしょうか。",
  { key: "proposed_appointment", retryResponse: "具体的な日時を教えてください。" }
);
assert.equal(
  contextualDayOnlyRetry.text,
  "何時が空いていますか？",
  "月の文脈がある『9日土曜日』の提示後に曜日希望を繰り返しています"
);
assert.equal(
  contextualDayOnlyRetry.audioId,
  "inspection_appointment_time_missing_retry",
  "日付提示後の既存まこと音声を使用していません"
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
assert.match(
  audioDbSource,
  /inspection_asked_availability_customer"[^\n]*"お願いしたいんですけど、いつできますか？"/,
  "希望日質問後の表示文と音声登録文が一致していません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_asked_availability_customer.mp3", import.meta.url)),
  true,
  "希望日質問後のまことMP3が見つかりません"
);

console.log("予約手続き確認省略後の日時調整テスト: OK");
