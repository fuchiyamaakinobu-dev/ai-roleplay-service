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
assert.match(html, /id="stickyContext"/);
assert.match(html, /id="customerInfoPanel"[\s\S]*?id="customerInfoText"/);
assert.match(html, /進行チェックポイント/);
assert.match(html, /class="inspection-checkpoint-list" id="requiredCustomerSpeech"/);
assert.doesNotMatch(html, /必要な発話（今後の基本発話）/);
assert.doesNotMatch(html, /確認できた発話（実際の発話）/);
assert.match(styles, /\.progress-item\.is-warning/);
assert.match(styles, /\.progress-item\.is-na/);
assert.match(
  styles,
  /\.inspection-checkpoint\.is-done\s*\{[^}]*background:\s*#e9edf2;[^}]*opacity:\s*0\.62;/s,
  "達成済みチェックポイントがグレーアウトされません"
);
assert.match(
  styles,
  /\.sticky-context\s*\{[^}]*position:\s*sticky;[^}]*top:\s*8px;/s,
  "お客様情報と進行チェックの領域が画面上部へ固定されていません"
);
assert.match(source, /roleplayProgressVisible/);
assert.match(
  source,
  /function renderCustomerInfo\(\)[\s\S]*?vehicle-inspection-phone-followup[\s\S]*?車検満了日\$\{scenario\.expiryDate\}[\s\S]*?\$\{scenario\.availableFrom\}以降作業可能/,
  "車検誘致のお客様情報をシナリオデータから作成できません"
);
assert.match(
  source,
  /els\.stickyContext\.hidden = !customerVisible && !visible/,
  "進行チェックOFF時に車検のお客様情報まで非表示になります"
);
assert.match(
  source,
  /els\.progressPanel\.hidden = !visible \|\| usesInspectionCheckpoints/,
  "車検誘致で従来の6段階進行カードが非表示になりません"
);

const checkpointLabels = [
  "開始挨拶", "本人確認", "店舗・担当者名", "日頃のお礼", "車検期日案内",
  "ご都合確認", "調子確認", "追加作業確認", "走行距離確認", "作業時間案内",
  "店内待ち確認", "代車案内", "予約手続き時間", "入庫日時確定", "荷物・必要書類",
  "ロックナット・15分前", "3日前確認連絡", "予約内容復唱", "終了挨拶"
];
checkpointLabels.forEach((label) => {
  assert.match(source, new RegExp(`label: "${label}"`), `チェック項目「${label}」がありません`);
});
const indicatorStart = source.indexOf("function renderCustomerSpeechIndicator(");
const indicatorEnd = source.indexOf("function renderProgress(", indicatorStart);
const indicatorSource = source.slice(indicatorStart, indicatorEnd);
assert.doesNotMatch(
  indicatorSource,
  /customerResponse|retryResponse|confirmedMessages/,
  "進行チェックに長いお客様セリフが残っています"
);
assert.match(indicatorSource, /完了 \$\{completedCount\}／\$\{checkpoints\.length\}/);

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
  { state: "PHONE_OPENING", key: "introduced_self" },
  { state: "PHONE_OPENING", key: "thanked_customer", advanceOnFailure: true }
];
assert.equal(context.scriptedProgressStatus({ state: "PHONE_OPENING" }), "done");

state.analyses = [
  { confirmed_identity: true },
  { introduced_self: true },
  { thanked_customer: false }
];
assert.equal(
  context.scriptedProgressStatus({ state: "PHONE_OPENING" }),
  "done",
  "お礼が未達でも、本人確認と名乗りが済めば表示は確認済みになります"
);

state.analyses = [{ confirmed_identity: true }];
assert.equal(context.scriptedProgressStatus({ state: "PHONE_OPENING" }), "");

scenario.steps = [{ state: "VEHICLE_CHECK", key: "documents", optionalAfterAppointment: true }];
state.ended = true;
assert.equal(context.scriptedProgressStatus({ state: "VEHICLE_CHECK" }), "na");

console.log("進行チェック表示テスト: OK");
