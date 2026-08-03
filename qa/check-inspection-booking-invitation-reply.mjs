import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function hasInspectionBookingInvitation");
const helperEnd = appSource.indexOf("function scriptedRequiredGroupsMatch", helperStart);
assert.notEqual(helperStart, -1, "電話予約提案の判定関数が見つかりません");
assert.notEqual(helperEnd, -1, "電話予約提案の判定関数の終端が見つかりません");
const context = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text)
};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

assert.equal(
  context.hasInspectionBookingInvitation("よろしければこのお電話でご予約できますが、いかがでしょうか？"),
  true,
  "この電話での予約提案を都合確認として認識できません"
);
assert.equal(
  context.hasInspectionBookingInvitation("ご予約はいかがでしょうか？"),
  true,
  "短い予約提案を都合確認として認識できません"
);
assert.equal(
  context.hasInspectionBookingInvitation("この電話で予約できます"),
  false,
  "質問ではない予約説明を都合確認として誤認識しています"
);
assert.equal(
  context.hasInspectionBookingInvitation("代車は予約できますか？"),
  false,
  "代車予約の質問を入庫予約提案として誤認識しています"
);

const crossingStart = appSource.indexOf("function advancedPastScriptedStep");
const crossingEnd = appSource.indexOf("function scriptedRequiredGroupsMatch", crossingStart);
assert.notEqual(crossingStart, -1, "複合発話の通過項目判定が見つかりません");
const crossingContext = {};
vm.createContext(crossingContext);
vm.runInContext(appSource.slice(crossingStart, crossingEnd), crossingContext);
const steps = [
  { key: "explained_inspection_notice" },
  { key: "asked_availability" },
  { key: "explained_available_period" },
  { key: "explained_duration_and_wait" }
];
assert.equal(
  crossingContext.advancedPastScriptedStep(0, 3, steps, "asked_availability"),
  true,
  "車検案内・予約提案・満了日をまとめた発話で肯定返答を選べません"
);
assert.equal(
  crossingContext.advancedPastScriptedStep(2, 3, steps, "asked_availability"),
  false,
  "都合確認を終えた後の発話を予約提案分岐として誤認識しています"
);

assert.match(scenarioSource, /requiredGroups:\s*\[\["ご都合",\s*"予定",\s*"日程",\s*"予約"\]\]/);
assert.match(appSource, /text:\s*"お願いします。"[\s\S]*?audioId:\s*"inspection_booking_invitation_accept_customer"/);
assert.match(appSource, /text:\s*"お願いしようと思っていました。"[\s\S]*?audioId:\s*"inspection_booking_invitation_intent_customer"/);
assert.match(
  appSource,
  /startingScriptStep[\s\S]*?advancedPastScriptedStep\([\s\S]*?"asked_availability"/,
  "複数ステップをまとめた予約提案で肯定返答を優先していません"
);
assert.match(audioDbSource, /inspection_booking_invitation_accept_customer"[^\n]*"お願いします。"/);
assert.match(audioDbSource, /inspection_booking_invitation_intent_customer"[^\n]*"お願いしようと思っていました。"/);

for (const fileName of [
  "inspection_booking_invitation_accept_customer.mp3",
  "inspection_booking_invitation_intent_customer.mp3"
]) {
  const audioFile = new URL(`../audio-ondoku/${fileName}`, import.meta.url);
  assert.ok(fs.existsSync(audioFile), `${fileName} がありません`);
  assert.ok(fs.statSync(audioFile).size > 10000, `${fileName} が小さすぎます`);
}

console.log("車検誘致・電話予約提案への肯定返答テスト: OK");
