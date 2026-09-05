import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const context = {
  state: { transcript: [], proposedAppointment: null },
  scenario: {
    customerName: "佐藤様",
    expiryDate: "9月30日",
    availableFrom: "8月1日"
  }
};
vm.createContext(context);

function runSlice(startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start);
  assert.notEqual(start, -1, `${startName} が見つかりません`);
  assert.notEqual(end, -1, `${endName} が見つかりません`);
  vm.runInContext(source.slice(start, end), context);
}

runSlice("normalizeScriptedText", "hasSupportedInspectionDuration");
context.isScriptedQuestion = (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text);
runSlice("hasInspectionWaitingChoiceOffer", "hasInspectionLoanerConfirmation");
runSlice("hasBookingContinuationConfirmation", "isInspectionDurationProgressAcknowledgement");
runSlice("isInspectionDeadlineDateCandidate", "hasInspectionScheduleQuestionIntent");
runSlice("hasInspectionSelfIntroduction", "hasInspectionDocumentGuidance");
runSlice("asksInspectionDayPreference", "scriptedRetryForMissingDetails");
runSlice("isInspectionFinalClosingThanks", "rememberFutureScriptedAchievements");
runSlice("asksInspectionIdentityConfirmation", "repeatedInspectionCoreStepAfterAppointment");
runSlice("hasInspectionAvailablePeriodEvidence", "hasLockNutToolExpression");
runSlice("appointmentPeriodsMatch", "handleReply");

assert.equal(context.normalizeScriptedText("はちがつついたちのじゅうじ"), "8月1日の10時");
assert.match(context.normalizeScriptedText("9月までにいつか10時に行きます"), /いつか/);

assert.equal(context.asksInspectionDayPreference("9月5日土曜日、よろしいですか？"), false);
assert.equal(context.asksInspectionDayPreference("土曜日と日曜日、どちらがよろしいですか？"), true);

assert.equal(context.inspectionAppointmentProposalMatch("9月5日か9月12日の10時はいかがですか？"), null);
assert.equal(context.inspectionAppointmentProposalMatch("9月5日の10時か11時はいかがですか？"), null);
assert.equal(context.inspectionAppointmentProposalMatch("9月5日午後3時はいかがですか？").period, "午後");

assert.equal(context.hasExplicitBookingContinuationConfirmation("作業時間は90分ですが店内でお待ちいただけますか？"), false);
assert.equal(context.hasExplicitBookingContinuationConfirmation("このまま予約手続きを進めます。10分ほどお時間よろしいですか？"), true);

assert.equal(context.hasInspectionWaitingChoiceOffer("店内ではお待ちいただけません。"), false);
assert.equal(context.asksInspectionWaitingMethodConfirmation("店内ではお待ちいただけません。"), false);

assert.equal(context.hasInspectionSelfIntroduction("トヨタモビリティ帯広本別店の寺屋と申します"), true);
assert.equal(context.hasInspectionSelfIntroduction("トヨタモビリヒロの寺屋と申します"), true);
assert.equal(context.hasInspectionSelfIntroduction("トヨタモビリテ帯広の寺屋と申します"), true);
assert.equal(context.hasInspectionSelfIntroduction("トヨタモビリティ帯広本別店と申します"), false);
assert.equal(context.hasInspectionSelfIntroduction("トヨタモビリティの寺屋と申します"), false);

assert.equal(context.asksInspectionIdentityConfirmation("佐藤様のお電話でしょうか？"), true);
assert.equal(context.asksInspectionIdentityConfirmation("佐藤様のお車の調子はいかがですか？"), false);
assert.equal(context.asksInspectionIdentityConfirmation("佐藤様の予約はいつですか？"), false);

context.state.transcript = [
  { role: "staff", text: "車検満了日は9月30日です。" },
  { role: "staff", text: "8月1日10時から作業できます。" }
];
assert.equal(context.hasInspectionAvailablePeriodEvidence(""), false);
context.state.transcript[1].text = "8月1日以降に車検を受けられます。";
assert.equal(context.hasInspectionAvailablePeriodEvidence(""), true);

assert.equal(context.isInspectionFinalClosingThanks("まだ『ありがとうございました』とは言っていません。"), false);
assert.equal(context.isInspectionFinalClosingThanks("本日はありがとうございました。"), true);

context.state.proposedAppointment = { month: "9", day: "5", hour: "3", minute: 0, period: "午後" };
assert.equal(context.hasConfirmedInspectionAppointmentRecap("佐藤様、9月5日午前3時にお待ちしております。"), false);
assert.equal(context.hasConfirmedInspectionAppointmentRecap("9月5日午後3時にお待ちしております。"), false);
assert.equal(context.hasConfirmedInspectionAppointmentRecap("佐藤様、9月6日午後3時にお待ちしております。"), false);
assert.equal(context.hasConfirmedInspectionAppointmentRecap("佐藤様、9月5日午後3時にお待ちしております。"), true);

assert.doesNotMatch(source, /addMessage\("customer", "(?:代車は必要ありません。|代車をお願いします。|予約は先ほどの日時でお願いします。)"/);
assert.match(source, /const playbackWatchdog = window\.setTimeout\(\(\) => finishOnce\(\), 30000\)/);
assert.match(source, /\["network", "no-speech", "aborted"\]/);

console.log("車検誘致・監査指摘の否定例／境界値テスト: OK");
