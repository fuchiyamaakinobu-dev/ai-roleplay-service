import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const start = source.indexOf("function mergedProgressAchievements(");
const end = source.indexOf("function renderProgress(", start);

assert.notEqual(start, -1, "進行チェックの実績集約関数が見つかりません");
assert.notEqual(end, -1, "進行チェックの状態判定関数を読み込めません");
assert.match(html, /id="progressEnabled"/);
assert.match(html, /id="progressPanel"/);
assert.match(styles, /\.progress-item\.is-warning/);
assert.match(styles, /\.progress-item\.is-na/);
assert.match(
  styles,
  /\.progress-panel\s*\{[^}]*position:\s*sticky;[^}]*top:\s*8px;/s,
  "進行チェックが画面上部へ固定されていません"
);
assert.match(source, /roleplayProgressVisible/);

const state = {
  started: true,
  ended: false,
  currentState: "INSPECTION_REQUEST_RECEIVED",
  pickupReason: null,
  resolutionType: null,
  serviceTimeNeedsReconfirmation: false,
  appointmentDateConfirmed: false,
  appointmentTimeConfirmed: false,
  additionalServiceAnswered: false,
  additionalServiceReconfirmed: false,
  analyses: []
};
const scenario = { mode: "service", steps: [] };
const context = {
  state,
  scenario,
  isServiceTimeRequirementSatisfied(explained, needsReconfirmation) {
    return Boolean(explained && !needsReconfirmation);
  }
};
vm.createContext(context);
vm.runInContext(`
  ${source.slice(start, end)}
  this.mergedProgressAchievements = mergedProgressAchievements;
  this.serviceProgressStatus = serviceProgressStatus;
  this.scriptedProgressStatus = scriptedProgressStatus;
`, context);

assert.equal(context.serviceProgressStatus({ state: "START" }, {}), "done");
assert.equal(
  context.serviceProgressStatus({ state: "INSPECTION_REQUEST_RECEIVED" }, {}),
  "active"
);
assert.equal(
  context.serviceProgressStatus(
    { state: "INSPECTION_REQUEST_RECEIVED" },
    { acknowledged_request: true }
  ),
  "done"
);
assert.equal(
  context.serviceProgressStatus({ state: "ADDITIONAL_SERVICE_RECONFIRMATION" }, {}),
  "na"
);

state.additionalServiceAnswered = true;
state.additionalServiceReconfirmed = true;
assert.equal(
  context.serviceProgressStatus({ state: "ADDITIONAL_SERVICE_RECONFIRMATION" }, {}),
  "done"
);

state.serviceTimeNeedsReconfirmation = true;
assert.equal(
  context.serviceProgressStatus(
    { state: "SERVICE_TIME_QUESTION" },
    { explained_service_time: true }
  ),
  "warning"
);
state.serviceTimeNeedsReconfirmation = false;
assert.equal(
  context.serviceProgressStatus(
    { state: "SERVICE_TIME_QUESTION" },
    { explained_service_time: true }
  ),
  "done"
);

state.pickupReason = "work";
assert.equal(
  context.serviceProgressStatus({ state: "ALTERNATIVE_PROPOSAL" }, { proposed_time: true }),
  "done"
);
state.pickupReason = "distance";
assert.equal(
  context.serviceProgressStatus({ state: "ALTERNATIVE_PROPOSAL" }, { proposed_other_store: true }),
  "done"
);

assert.equal(
  context.serviceProgressStatus({ state: "APPOINTMENT_CONFIRMATION" }, {}),
  ""
);
state.appointmentDateConfirmed = true;
state.appointmentTimeConfirmed = true;
assert.equal(
  context.serviceProgressStatus({ state: "APPOINTMENT_CONFIRMATION" }, {}),
  "done"
);

state.analyses = [{ introduced_self: true }, { confirmed_identity: true }];
scenario.mode = "staff-led-scripted";
scenario.steps = [
  { state: "PHONE_OPENING", key: "confirmed_identity" },
  { state: "PHONE_OPENING", key: "introduced_self" }
];
assert.equal(context.scriptedProgressStatus({ state: "PHONE_OPENING" }), "done");

state.analyses = [{ confirmed_identity: true }];
assert.equal(context.scriptedProgressStatus({ state: "PHONE_OPENING" }), "");

scenario.steps = [{ state: "VEHICLE_CHECK", key: "documents", optionalAfterAppointment: true }];
state.ended = true;
assert.equal(context.scriptedProgressStatus({ state: "VEHICLE_CHECK" }), "na");

console.log("進行チェック表示テスト: OK");
