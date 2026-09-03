import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const normalizeStart = appSource.indexOf("function normalizeLoanerHomophone");
const loanerEnd = appSource.indexOf("function hasInspectionAvailableFromInformation", normalizeStart);
assert.notEqual(normalizeStart, -1);
assert.notEqual(loanerEnd, -1);
const loanerContext = {};
vm.createContext(loanerContext);
vm.runInContext(appSource.slice(normalizeStart, loanerEnd), loanerContext);

const bookingStart = appSource.indexOf("function hasBookingContinuationConfirmation");
const bookingEnd = appSource.indexOf("function hasExplicitBookingContinuationConfirmation", bookingStart);
assert.notEqual(bookingStart, -1);
assert.notEqual(bookingEnd, -1);
const bookingContext = {
  normalizeScriptedText: loanerContext.normalizeScriptedText,
  isScriptedQuestion: (text) => /(?:でしょうか|ましょうか|ますか|ですか|ませんか|ございませんか|[?？])/.test(text)
};
vm.createContext(bookingContext);
vm.runInContext(appSource.slice(bookingStart, bookingEnd), bookingContext);

const loanerQuestions = [
  "作業中は代わりのお車は必要でしょうか？",
  "代車は必要ですか？",
  "代車はお使いになりますか？",
  "代車をご利用になりますか？",
  "代車はいかがでしょうか？",
  "代車はいかがいたしましょう",
  "代わりの車はどうされますか？",
  "代替車は必要でしょうか"
];
for (const text of loanerQuestions) {
  assert.equal(loanerContext.asksInspectionLoanerNeed(text), true, text);
}

for (const text of [
  "代車をご用意いたします。",
  "代車は必要ありません。",
  "代車の空きを確認します。",
  "代車という選択肢があります。"
]) {
  assert.equal(loanerContext.asksInspectionLoanerNeed(text), false, text);
}

const acceptedLoanerReplies = [
  "代車をご用意できます。",
  "代車をご準備いたします。",
  "代わりの車を手配しておきます。",
  "代車を一応ご依頼させていただきます。",
  "代車ですね。ご用意は、問題なくできます。",
  "代車をご用意できる？できます。"
];
for (const text of acceptedLoanerReplies) {
  assert.equal(loanerContext.hasInspectionLoanerConfirmation(text, true), true, text);
}
for (const text of [
  "代車をご用意できますか？",
  "代車をご用意できません。",
  "代車の空きを確認します。",
  "代車は空いていません。"
]) {
  assert.equal(loanerContext.hasInspectionLoanerConfirmation(text, true), false, text);
}

for (const text of [
  "このまま予約手続きを進めてもよろしいでしょうか？",
  "予約手続きを続けても大丈夫ですか？",
  "予約にもう少しお時間をいただけますか？",
  "よろしければご予約を進めたいのですが、いかがでしょうか？"
]) {
  assert.equal(bookingContext.hasBookingContinuationConfirmation(text), true, text);
}
for (const text of [
  "ご予約いただければ、代車をご用意できます。",
  "早めにご予約いただければ代車が空いています。",
  "予約できます。",
  "予約手続きには10分程度かかります。"
]) {
  assert.equal(bookingContext.hasBookingContinuationConfirmation(text), false, text);
}

const guidanceStart = appSource.indexOf("function hasInspectionDocumentGuidance");
const guidanceEnd = appSource.indexOf("function scriptedRequiredGroupsMatch", guidanceStart);
assert.notEqual(guidanceStart, -1);
assert.notEqual(guidanceEnd, -1);
const guidanceContext = {
  state: { transcript: [] },
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text),
  hasInspectionAppointmentProposalEvidence: (text) => /8月30日(?:午前)?10時/.test(text)
};
vm.createContext(guidanceContext);
vm.runInContext(appSource.slice(guidanceStart, guidanceEnd), guidanceContext);

for (const text of [
  "かしこまりました。",
  "承知しました。",
  "分かりました。",
  "わかりました",
  "ありがとうございます。",
  "ありがとう"
]) {
  assert.equal(guidanceContext.isInspectionAcknowledgementOnlyAfterAppointment(text), true, text);
}
for (const text of [
  "ありがとうございました。",
  "ありがとうございます。それでは当日のご案内です。",
  "かしこまりました。代車をご用意します。",
  "分かりましたか？"
]) {
  assert.equal(guidanceContext.isInspectionAcknowledgementOnlyAfterAppointment(text), false, text);
}

for (const text of [
  "恐れ入りますが、当日お持ち。",
  "当日の持ち物とお願いについて3点ほど確認させてください。",
  "また、受付に。",
  "それから。"
]) {
  assert.equal(guidanceContext.isInspectionGuidancePrefaceOrIncompleteFragment(text), true, text);
}
for (const text of [
  "当日は車検証をお持ちください。",
  "この携帯へのご連絡でよろしいでしょうか？",
  "受付の15分前にご来店ください。"
]) {
  assert.equal(guidanceContext.isInspectionGuidancePrefaceOrIncompleteFragment(text), false, text);
}

for (const text of [
  "それでは車検をお受けする日時ですが、ご都合はいかがでしょうか？",
  "予約日程はこのままでよろしいでしょうか？",
  "ご予定はお決まりでしたでしょうか？"
]) {
  assert.equal(guidanceContext.asksInspectionAvailabilityAgainAfterAppointment(text), true, text);
}
assert.equal(
  guidanceContext.asksInspectionAvailabilityAgainAfterAppointment("8月30日午前10時はいかがでしょうか？"),
  false
);

const documentOrders = [
  [
    "車検証、自賠責保険証明書、納税証明書をお持ちください。",
    "トランクや荷室は荷物を降ろした状態でご来店ください。"
  ],
  [
    "トランクや荷室は荷物を積まない状態でご来店ください。",
    "納税証明書、車検証、自賠責をお持ちください。"
  ]
];
for (const staffTexts of documentOrders) {
  guidanceContext.state.transcript = staffTexts.flatMap((text) => [
    { role: "staff", text },
    { role: "customer", text: "はい。" }
  ]);
  assert.equal(
    guidanceContext.hasInspectionDocumentGuidance(
      guidanceContext.inspectionStaffConversationEvidence("", "explained_documents")
    ),
    true,
    staffTexts.join(" / ")
  );
}

assert.match(
  appSource,
  /asksInspectionLoanerNeed\(text\)[\s\S]*?addMessage\("customer", "お願いします。"[\s\S]*?inspection_booking_invitation_accept_customer/,
  "代車利用質問の返答と登録MP3が一致しません"
);
assert.match(
  audioSource,
  /\["inspection_booking_invitation_accept_customer",\s*"[^"]+",\s*"お願いします。"\]/,
  "『お願いします。』の登録音声文が見つかりません"
);
assert.match(indexSource, /styles\.css\?v=20260829-3/);
assert.match(indexSource, /cloud-scenario\.js\?v=20260903-1/);
assert.match(indexSource, /scenario\.js\?v=20260903-1/);
assert.doesNotMatch(indexSource, /__CF\$cv\$params|challenge-platform/);

console.log(`車検誘致・拡張会話マトリクス: OK（${loanerQuestions.length + acceptedLoanerReplies.length + documentOrders.length + 26}パターン）`);
