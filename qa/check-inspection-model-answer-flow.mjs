import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function normalizeLoanerHomophone");
const helperEnd = appSource.indexOf("function hasInspectionLoanerConfirmation", helperStart);
assert.notEqual(helperStart, -1, "車検誘致の正規化関数が見つかりません");
assert.notEqual(helperEnd, -1, "待ち方判定関数の終端が見つかりません");

const context = {};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

for (const phrase of [
  "店内でお待ちいただけますか？",
  "店内でお待ちになりますか？",
  "お店で待っていただけますか？"
]) {
  assert.equal(
    context.asksInspectionWaitingMethodConfirmation(phrase),
    true,
    `待ち方の確認として認識できません: ${phrase}`
  );
}
assert.equal(
  context.asksInspectionWaitingMethodConfirmation("お店でお待ちいただくこともできます。"),
  false,
  "店内待ちが可能という案内を待ち方の質問として誤認識しています"
);

const waitingBranchStart = appSource.indexOf("const waitingBranchLoanerStep = scenario.steps[state.scriptStep]");
const waitingBranchEnd = appSource.indexOf("// スタッフが複数項目を一度に話した場合", waitingBranchStart);
assert.notEqual(waitingBranchStart, -1, "待ち方から代車へ進む分岐が見つかりません");
const waitingBranch = appSource.slice(waitingBranchStart, waitingBranchEnd);
assert.match(waitingBranch, /asksInspectionWaitingMethodConfirmation\(combinedText\)/);
assert.match(waitingBranch, /出かける可能性があるので、一応代車を用意してほしいんですが、できますか？/);
assert.match(waitingBranch, /inspection_waiting_followup_loaner_request/);

for (const [pattern, label] of [
  [/customerResponse:\s*"オイル交換もお願いしたいです。"/, "オイル交換希望"],
  [/customerResponse:\s*"予約しようかな。"/, "代車承諾後"],
  [/customerResponse:\s*"大丈夫ですよ。"/, "予約手続き確認後"],
  [/customerResponse:\s*"では、その日でお願いします。"/, "日時提示後"],
  [/appointmentDate:\s*"8月30日10時"/, "模範予約日時"]
]) {
  assert.match(scenarioSource, pattern, `${label}の模範返答がシナリオにありません`);
}

for (const [audioId, text] of [
  ["inspection_asked_vehicle_concerns_customer", "オイル交換もお願いしたいです。"],
  ["inspection_current_mileage_customer", "今、3万キロくらいです。"],
  ["inspection_waiting_followup_loaner_request", "出かける可能性があるので、一応代車を用意してほしいんですが、できますか？"],
  ["inspection_explained_loaner_customer", "予約しようかな。"],
  ["inspection_confirmed_booking_time_customer", "大丈夫ですよ。"],
  ["inspection_proposed_appointment_customer", "では、その日でお願いします。"]
]) {
  assert.ok(audioDbSource.includes(`"${audioId}"`), `${audioId} が音声DBにありません`);
  assert.ok(audioDbSource.includes(`"${text}"`), `${audioId} の表示文が一致しません`);
  const audioPath = new URL(`../audio-ondoku/${audioId}.mp3`, import.meta.url);
  assert.equal(fs.existsSync(audioPath), true, `${audioId} のMP3がありません`);
  assert.ok(fs.statSync(audioPath).size > 1000, `${audioId} のMP3が小さすぎます`);
}

assert.match(
  appSource,
  /resolvedWaitingStep\?\.key === "confirmed_waiting"[\s\S]*?inspectionLoanerConfirmed[\s\S]*?state\.scriptStep \+= 1/,
  "代車確定後に店内待ちを再質問しない処理がありません"
);

console.log("車検誘致・模範解答ルート整合テスト: OK");
