import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(
  source,
  /step\.key === "proposed_appointment"\s*\? "inspection-retry:proposed_appointment:general"/,
  "日付不足と時刻不足の確認回数が共通化されていません"
);
assert.match(
  source,
  /const maySkipRepeatedQuestion = step\.key !== "closed_politely"/,
  "入庫日時の確認を一度で打ち切る処理がありません"
);
assert.match(
  source,
  /step\.key === "proposed_appointment" && alreadyAsked[\s\S]*?inspectionAppointmentIncomplete = true/,
  "二度目の日時不足を予約日時未確定として記録できません"
);
assert.match(
  source,
  /\(state\.proposedAppointment \|\| state\.inspectionAppointmentIncomplete\)[\s\S]*?isInspectionFinalClosingThanks/,
  "予約日時未確定時に最終のお礼で終話できません"
);
assert.equal(
  (source.match(/state\.inspectionAppointmentIncomplete = false;/g) || []).length >= 3,
  true,
  "開始・リセット・後日の日時確定で未確定状態を解除できません"
);

const scoreStart = source.indexOf("function scoreScriptedRoleplay()");
const scoreEnd = source.indexOf("function buildImprovementTalk", scoreStart);
assert.notEqual(scoreStart, -1, "車検誘致の採点処理が見つかりません");
assert.notEqual(scoreEnd, -1, "車検誘致の採点処理の終端が見つかりません");

const scoring = [
  ["confirmed_identity", 4], ["introduced_self", 6], ["thanked_customer", 4],
  ["explained_inspection_notice", 8], ["asked_availability", 5],
  ["explained_available_period", 7], ["explained_duration_and_wait", 7],
  ["explained_loaner", 6], ["confirmed_booking_time", 5],
  ["proposed_appointment", 8], ["confirmed_waiting", 4],
  ["asked_vehicle_concerns", 6], ["explained_documents", 8],
  ["explained_lock_and_arrival", 7], ["confirmed_reminder_contact", 6],
  ["recapped_appointment", 5], ["closed_politely", 4]
].map(([key, points]) => ({ key, points, label: key, action: key }));

const achieved = Object.fromEntries(scoring.map(({ key }) => [key, true]));
achieved.proposed_appointment = false;
achieved.recapped_appointment = false;

const context = {
  scenario: {
    scoring,
    steps: [],
    recommendedTalk: "推奨トーク"
  },
  state: {
    analyses: [{
      scripted: true,
      stepKey: "proposed_appointment",
      blocked: true,
      passed: false
    }],
    inspectionMileageAsked: true
  },
  inspectionConversationMetricAchieved(metricKey) {
    return achieved[metricKey];
  }
};
vm.createContext(context);
vm.runInContext(
  `${source.slice(scoreStart, scoreEnd)}\nthis.scoreScriptedRoleplay = scoreScriptedRoleplay;`,
  context
);

const result = context.scoreScriptedRoleplay();
assert.equal(result.score, 67, "日時8点・復唱5点・最低条件20点の減点結果が67点になりません");
assert.equal(
  result.improve[0],
  "具体的な入庫日と来店時間が確定していません（最低条件未達：20点減点）",
  "採点結果の先頭に予約日時未確定が表示されません"
);
assert.ok(
  result.judgements.some((item) => item.includes("最低条件未達・20点減点")),
  "判定ポイントに最低条件未達が表示されません"
);
assert.ok(
  !result.improve.some((item) => item.includes("聞き返しが1回")),
  "日時不足への一度確認が2点と重複減点されています"
);

console.log("車検誘致・予約日時未確定の進行と採点テスト: OK");
