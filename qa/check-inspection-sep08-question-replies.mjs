import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const additionalStart = source.indexOf("function asksInspectionAdditionalServiceFollowUp");
const additionalEnd = source.indexOf("function asksInspectionOilChangeOffer", additionalStart);
const availabilityStart = source.indexOf("function hasInspectionAvailabilityRequest");
const availabilityEnd = source.indexOf("function hasDirectInspectionBookingInvitation", availabilityStart);
assert.notEqual(additionalStart, -1);
assert.notEqual(additionalEnd, -1);
assert.notEqual(availabilityStart, -1);
assert.notEqual(availabilityEnd, -1);

const context = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ですか|ますか|ませんか|[?？])/.test(text),
  hasInspectionBookingInvitation: () => false
};
vm.createContext(context);
vm.runInContext(
  `${source.slice(additionalStart, additionalEnd)}\n${source.slice(availabilityStart, availabilityEnd)}\n`
    + "this.asksInspectionAdditionalServiceFollowUp = asksInspectionAdditionalServiceFollowUp;"
    + "this.hasInspectionAvailabilityRequest = hasInspectionAvailabilityRequest;",
  context
);

assert.equal(
  context.hasInspectionAvailabilityRequest("佐藤様、いつがご都合良いでしょうか？"),
  true
);
assert.equal(
  context.hasInspectionAvailabilityRequest("それで佐藤様のご都合をお伺いしたかったのですが。"),
  true
);
assert.equal(
  context.asksInspectionAdditionalServiceFollowUp("あと気になるところございませんか"),
  true
);
assert.equal(
  context.asksInspectionAdditionalServiceFollowUp("気になるところはありませんか？"),
  true
);
assert.equal(
  context.asksInspectionAdditionalServiceFollowUp("本日はありがとうございました。"),
  false
);

// 確定済み日時の再提示には、確定内容を変更しない相づち「はい。」を返す。
// 複数質問が一つの認識結果にまとまった場合は最後の「店内待ち」質問を優先する。
assert.match(
  source,
  /state\.proposedAppointment[\s\S]*?hasInspectionAppointmentProposalEvidence\(text\)[\s\S]*?addMessage\("customer", "はい。"[\s\S]*?inspection_thanked_customer_retry/
);
assert.match(
  source,
  /const decisionText = inspectionLastQuestionClause\(text\)[\s\S]*?asksInspectionWaitingMethodConfirmation\(decisionText\)/
);
assert.match(
  source,
  /hasInspectionAppointmentProposalEvidence\(text\)[\s\S]*?!asksInspectionWaitingMethodConfirmation\(decisionText\)[\s\S]*?!asksInspectionLoanerNeed\(decisionText\)/
);

console.log("Sep. 8 inspection question-reply checks passed.");
