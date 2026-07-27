import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function rememberCompletedCheckpoints(");
const nextMessageStart = source.indexOf("function nextCustomerMessage(", start);
const end = source.indexOf("function selectAppointmentTimeOption(", nextMessageStart);

assert.notEqual(start, -1, "確認済み項目の保存関数が見つかりません");
assert.notEqual(nextMessageStart, -1, "お客様返答関数が見つかりません");
assert.notEqual(end, -1, "確認済み項目とお客様返答関数を読み込めません");

const context = {
  state: {
    currentState: "VISIT_PROPOSAL",
    serviceTimeExplained: true,
    appointmentDateConfirmed: false,
    appointmentTimeConfirmed: false,
    appointmentTime: null,
    additionalServiceAnswered: false,
    additionalServiceResumeState: null,
    currentObjection: "work",
    pickupReason: "work",
    ended: false
  },
  scenario: {
    scoring: [{ key: "asked_additional_service" }],
    audio: {
      additionalServiceRequest: "additional-service-request",
      additionalServiceNone: "additional-service-none",
      closings: ["closing"]
    }
  },
  appointmentFollowUpCount: 0,
  customerTurn(text, audioId = "") {
    return { text, audioId };
  },
  customerTurnFromAudio(audioId, fallbackText = "") {
    return { text: fallbackText, audioId };
  },
  selectContextualCustomerResponse(analysis) {
    return analysis.proposed_time
      ? { text: "その時間なら行けそうです。", audioId: "agreement" }
      : null;
  },
  selectAppointmentTimeOption() {
    return null;
  },
  appointmentFollowUpTurn() {
    context.appointmentFollowUpCount += 1;
    return { text: "では、いつなら空いていますか？", audioId: "follow-up" };
  }
};
vm.createContext(context);
vm.runInContext(`
  ${source.slice(start, end)}
  this.rememberCompletedCheckpoints = rememberCompletedCheckpoints;
  this.nextCustomerMessage = nextCustomerMessage;
`, context);

context.rememberCompletedCheckpoints({
  explained_service_time: false,
  has_schedule_date: true,
  has_schedule_time: true,
  schedule_time_options: ["16"]
});
assert.equal(context.state.appointmentDateConfirmed, true);
assert.equal(context.state.appointmentTimeConfirmed, true);
assert.equal(context.state.appointmentTime, "16");

context.state.currentState = "ADDITIONAL_SERVICE_REQUEST";
context.rememberCompletedCheckpoints({
  explained_service_time: true,
  has_schedule_date: false,
  has_schedule_time: false,
  schedule_time_options: []
});
assert.equal(context.state.serviceTimeExplained, true);
assert.equal(context.state.appointmentDateConfirmed, true);
assert.equal(context.state.appointmentTimeConfirmed, true);
assert.equal(context.state.appointmentTime, "16");

context.state.currentState = "INSPECTION_REQUEST_RECEIVED";
context.state.appointmentDateConfirmed = false;
context.state.appointmentTimeConfirmed = false;
context.state.appointmentTime = null;
context.rememberCompletedCheckpoints({
  explained_service_time: false,
  has_schedule_date: true,
  has_schedule_time: true,
  schedule_time_options: ["10"]
});
assert.equal(context.state.appointmentDateConfirmed, false);
assert.equal(context.state.appointmentTimeConfirmed, false);
assert.equal(context.state.appointmentTime, null);

context.state.currentState = "VISIT_PROPOSAL";
context.state.appointmentDateConfirmed = false;
context.state.appointmentTimeConfirmed = false;
context.state.appointmentTime = null;
const appointmentAgreement = context.nextCustomerMessage({
  explained_service_time: false,
  asked_additional_service: false,
  asked_vehicle_concern: false,
  has_schedule_date: true,
  has_schedule_time: true,
  schedule_time_options: ["16"],
  proposed_time: true
});
assert.equal(appointmentAgreement.text, "その時間なら行けそうです。");
assert.equal(context.state.currentState, "ALTERNATIVE_PROPOSAL");
assert.equal(context.state.appointmentDateConfirmed, true);
assert.equal(context.state.appointmentTimeConfirmed, true);

const oilRequest = context.nextCustomerMessage({
  explained_service_time: false,
  asked_additional_service: true,
  asked_vehicle_concern: true,
  has_schedule_date: false,
  has_schedule_time: false,
  schedule_time_options: []
});
assert.equal(oilRequest.text, "オイル交換もお願いします。");
assert.equal(context.state.currentState, "ADDITIONAL_SERVICE_REQUEST");

const closing = context.nextCustomerMessage({
  explained_service_time: true,
  asked_additional_service: false,
  asked_vehicle_concern: false,
  has_schedule_date: false,
  has_schedule_time: false,
  schedule_time_options: []
});
assert.equal(context.state.serviceTimeExplained, true);
assert.equal(context.state.appointmentDateConfirmed, true);
assert.equal(context.state.appointmentTimeConfirmed, true);
assert.equal(context.state.ended, true);
assert.equal(context.appointmentFollowUpCount, 0);
assert.doesNotMatch(closing.text, /いつなら空いていますか/);

console.log("確認済み項目への逆戻り防止テスト: OK");
