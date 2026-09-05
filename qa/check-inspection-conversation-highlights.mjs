import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

const start = appSource.indexOf("function inspectionHighlightPassed");
const end = appSource.indexOf("function continueSpeechInputWithoutCustomerReply", start);
assert.notEqual(start, -1, "判定語の強調処理が見つかりません");
assert.notEqual(end, -1, "判定語の強調処理の終端が見つかりません");

const context = {
  scenario: {
    customerName: "佐藤様",
    vehicleName: "ヤリス",
    expiryDate: "9月30日",
    scoring: [
      ["confirmed_identity", "本人確認"],
      ["introduced_self", "店舗・担当者名"],
      ["thanked_customer", "日頃の利用へのお礼"],
      ["explained_inspection_notice", "車種・車検時期"],
      ["asked_availability", "都合確認"],
      ["explained_available_period", "車検満了日"],
      ["explained_duration_and_wait", "走行距離・時間・店内待ち"],
      ["explained_loaner", "代車予約"],
      ["confirmed_booking_time", "予約手続き確認"],
      ["proposed_appointment", "具体的な日時"],
      ["confirmed_waiting", "待ち方確認"],
      ["asked_vehicle_concerns", "気になる症状"],
      ["explained_documents", "荷物・必要書類"],
      ["explained_lock_and_arrival", "ロックナット・早着"],
      ["confirmed_reminder_contact", "3日前確認連絡"],
      ["recapped_appointment", "予約復唱"],
      ["closed_politely", "終話あいさつ"]
    ].map(([key, label]) => ({ key, label }))
  },
  state: { analyses: [], proposedAppointment: null },
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text),
  hasCourtesyExpression: (text) => /(?:いつも.*ありがとう|お世話になっております|日頃.*お世話.*ありがとう)/.test(text),
  hasClearInspectionPurposeNotice: (text) => /ヤリス/.test(text) && /車検/.test(text),
  hasInspectionBookingInvitation: (text) => /(?:予定|都合)/.test(text) && /(?:でしょうか|ますか|[?？])/.test(text),
  hasBookingContinuationConfirmation: (text) => /(?:予約|手続き).*(?:時間|よろしい|大丈夫)/.test(text),
  inspectionAppointmentProposalMatch: (text) => /8月30日(?:午前)?10時.*いかが/.test(text)
    ? { month: 8, day: 30, hour: 10 }
    : null,
  appointmentPeriodsMatch: () => true,
  inspectionTextHasSplitGuidanceKey: (text, key) => key === "explained_documents"
    ? /(?:荷物|荷室|トランク|車検証|自賠責|納税証明)/.test(text)
    : /(?:ロック|ナット|アダプター|工具|10分前|15分前)/.test(text),
  escapeHtml: (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[character])
};
vm.createContext(context);
vm.runInContext(
  `${appSource.slice(start, end)}\nthis.renderInspectionConversationHighlights = renderInspectionConversationHighlights;`,
  context
);

context.state.analyses = [{ stepKey: "confirmed_identity", passed: true }];
assert.match(
  context.renderInspectionConversationHighlights("佐藤様でしょうか。"),
  /conversation-keyword is-confirmed[^>]*>佐藤様<\/mark>/,
  "達成済みの本人確認語が緑表示になりません"
);

context.state.analyses = [];
const partialIntroduction = context.renderInspectionConversationHighlights(
  "私、トヨタモビリティ帯広の山田と申します。"
);
assert.match(partialIntroduction, /conversation-keyword is-partial/);
assert.match(partialIntroduction, /一部認識：店舗・担当者名/);

context.state.analyses = [{ stepKey: "introduced_self", passed: true }];
assert.match(
  context.renderInspectionConversationHighlights("私、トヨタモビリティ帯広の山田と申します。"),
  /conversation-keyword is-confirmed/,
  "名乗り達成後に該当語が緑へ更新されません"
);

context.state.analyses = [];
assert.match(
  context.renderInspectionConversationHighlights("車検証、自賠責、納税証明書をお持ちください。"),
  /conversation-keyword is-partial/,
  "空荷案内が不足する必要書類が黄色になりません"
);
context.state.analyses = [{ stepKey: "explained_documents", passed: true }];
assert.doesNotMatch(
  context.renderInspectionConversationHighlights("車検証、自賠責、納税証明書をお持ちください。"),
  /conversation-keyword is-partial/,
  "分割案内の達成後も過去の必要書類が黄色のままです"
);

context.state.analyses = [{ stepKey: "closed_politely", passed: true }];
assert.doesNotMatch(
  context.renderInspectionConversationHighlights("ありがとうございます。"),
  /conversation-keyword/,
  "会話途中の『ありがとうございます』を終話語として強調しています"
);
assert.match(
  context.renderInspectionConversationHighlights("ありがとうございました。"),
  /conversation-keyword is-confirmed/,
  "過去形の終話あいさつが強調されません"
);

assert.match(indexSource, /id="conversationHighlightLegend"/);
assert.match(indexSource, /確認済み/);
assert.match(indexSource, /一部認識/);
assert.match(styleSource, /\.conversation-keyword\.is-confirmed/);
assert.match(styleSource, /\.conversation-keyword\.is-partial/);
assert.match(
  appSource,
  /message\.role === "staff"[\s\S]*?scenario\.id === "vehicle-inspection-phone-followup"[\s\S]*?renderInspectionConversationHighlights/,
  "車検誘致のスタッフ発話だけに限定されていません"
);

console.log("車検誘致・会話ログ判定語強調テスト: OK");
