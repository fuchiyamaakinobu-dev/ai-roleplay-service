import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function hasInspectionDocumentGuidance");
const helperEnd = appSource.indexOf("function scriptedRequiredGroupsMatch", helperStart);
assert.notEqual(helperStart, -1, "持参品と3日前連絡先の補助判定がありません");
assert.notEqual(helperEnd, -1, "補助判定の終端がありません");

const context = {
  state: { transcript: [] },
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text),
  hasInspectionAppointmentProposalEvidence: () => false
};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

const splitDocumentGuidance = [
  "まず、車検証と自賠責証書、納税証明書をお持ちください。",
  "トランクや荷室は荷物を積まない状態でご来店ください。"
].join(" ");
assert.equal(
  context.hasInspectionDocumentGuidance(splitDocumentGuidance),
  true,
  "必要書類と空荷を分割した案内を合算できません"
);
assert.equal(
  context.hasInspectionDocumentGuidance("車検証、自賠責証書、納税証明書をお持ちください。"),
  false,
  "空荷案内なしで持参品項目を達成しています"
);

context.state.transcript = [
  { role: "staff", text: "車検証、自賠責保険証明書、納税証明書をお持ちください。" },
  { role: "customer", text: "はい。" },
  { role: "staff", text: "トランクや荷室は荷物を積んでいない状態でご来店ください。" }
];
assert.equal(
  context.hasInspectionDocumentGuidance(
    context.inspectionStaffConversationEvidence("", "explained_documents")
  ),
  true,
  "途中にお客様の『はい』を挟んだ必要書類と空荷の案内を会話全体から合算できません"
);

context.state.transcript = [
  { role: "staff", text: "入庫の3日前に、私の方から改めてご連絡差し上げます。" },
  { role: "staff", text: "こちらの携帯番号でよろしいでしょうか。" }
];
assert.equal(
  context.hasInspectionReminderContactConfirmation("こちらの携帯番号でよろしいでしょうか。"),
  true,
  "3日前連絡と連絡先確認を別発話にした案内を会話全体から合算できません"
);
assert.equal(
  context.inspectionSplitGuidanceFragmentKey("入庫の3日前に改めてご連絡差し上げます。"),
  "confirmed_reminder_contact",
  "3日前連絡だけの途中案内を保持対象として判定できません"
);
assert.equal(
  context.inspectionSplitGuidanceFragmentKey("こちらの携帯番号でよろしいでしょうか。"),
  "confirmed_reminder_contact",
  "分割された連絡先確認を3日前連絡の続きとして判定できません"
);

context.state.transcript = [
  { role: "staff", text: "入庫の3日前に確認のお電話をいたします。" }
];
assert.equal(
  context.hasInspectionReminderContactConfirmation(""),
  false,
  "3日前連絡だけで連絡先確認まで達成扱いにしています"
);
assert.equal(
  context.inspectionSplitGuidanceFragmentKey("車検証と自賠責保険証明書をお持ちください。"),
  "explained_documents",
  "必要書類だけの途中案内を保持対象として判定できません"
);
assert.equal(
  context.inspectionSplitGuidanceFragmentKey("ロックナットの工具をお持ちください。"),
  "explained_lock_and_arrival",
  "ロックナット用具だけの途中案内を保持対象として判定できません"
);

for (const phrase of [
  "恐れ入りますが、当日お持ち。",
  "当日の持ち物とお願いについて、3点ほど確認させてください。",
  "また、受付に。"
]) {
  assert.equal(
    context.isInspectionGuidancePrefaceOrIncompleteFragment(phrase),
    true,
    `案内途中の前置き・言いかけとして認識できません: ${phrase}`
  );
}
assert.equal(
  context.isInspectionAcknowledgementOnlyAfterAppointment("かしこまりました。"),
  true,
  "予約確定後の単独受領表現を認識できません"
);
assert.equal(
  context.isInspectionAcknowledgementOnlyAfterAppointment("ありがとうございます。"),
  true,
  "予約確定後の単独のお礼を音声入力継続として認識できません"
);
assert.equal(
  context.isInspectionAcknowledgementOnlyAfterAppointment("ありがとうございました。"),
  false,
  "終話のお礼を単独受領表現として誤認識しています"
);

for (const phrase of [
  "入庫日の3日前に確認のお電話をしますが、この連絡先でよろしいでしょうか？",
  "3日前に再確認の連絡をしますが、今の電話でよろしいですか？",
  "3日前にご連絡しますが、この携帯で大丈夫でしょうか？"
]) {
  assert.equal(
    context.hasInspectionReminderContactConfirmation(phrase),
    true,
    `3日前の連絡先確認として認識できません: ${phrase}`
  );
}
assert.equal(
  context.hasInspectionReminderContactConfirmation("3日前に確認の電話をします。"),
  false,
  "連絡先を確認していない発話を達成扱いにしています"
);

assert.match(appSource, /やるしす\|ヤルシス/);
assert.match(
  appSource,
  /metric\.key === "explained_duration_and_wait" && !state\.inspectionMileageAsked/
);
assert.match(
  appSource,
  /optionalAfterAppointmentKeys[\s\S]*?!optionalAfterAppointmentKeys\.has\(analysis\.stepKey\)/,
  "入庫日時確定後の任意項目を聞き返し減点から除外していません"
);
assert.match(
  appSource,
  /splitGuidanceStep[\s\S]*?isInspectionGuidancePrefaceOrIncompleteFragment\(text\)[\s\S]*?continueSpeechInputWithoutCustomerReply\("音声入力中です。案内の続きを話してください。"\)/,
  "言いかけの分割案内へAI音声を挟まずスタッフ入力を継続する処理がありません"
);
assert.match(
  appSource,
  /splitGuidanceStep[\s\S]*?addMessage\("customer", "はい。",[\s\S]*?inspection_thanked_customer_retry/,
  "完結した分割案内へ採点対象外のあいづちを返す処理がありません"
);
assert.match(
  appSource,
  /asksInspectionAvailabilityAgainAfterAppointment\(text\)[\s\S]*?addMessage\("customer", "お願いします。"/,
  "予約確定後の日程再質問へ後戻りせず応答する処理がありません"
);

console.log("車検誘致・予約後の分割案内と連絡先確認テスト: OK");
