import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

assert.match(
  appSource,
  /retry\.missingDetail === "waiting"[\s\S]*?state\.inspectionWaitingRequested = true/,
  "店内待ちを尋ねた状態を保持できません"
);
assert.match(
  appSource,
  /!state\.inspectionWaitingRequested && hasInspectionWaitingChoiceOffer\(combinedText\)[\s\S]*?markScriptedStepNotApplicable[\s\S]*?responseStep = waitingBranchLoanerStep/,
  "スタッフから店内待ちを提案した場合に代車を対象外として予約へ進めません"
);
assert.match(
  appSource,
  /state\.inspectionWaitingRequested\)[\s\S]*?出かける可能性があるので、一応代車を用意してほしいんですが、できますか？[\s\S]*?inspection_waiting_followup_loaner_request/,
  "お客様から店内待ちを確認した後に、外出に備えた代車希望へ進めません"
);
assert.match(
  scenarioSource,
  /key:\s*"explained_loaner"[\s\S]*?customerResponse:\s*"予約しようかな。"/,
  "代車項目を通過した後の予約発話が見つかりません"
);
assert.match(
  audioDbSource,
  /inspection_waiting_followup_loaner_request",\s*"店内待ち確認後・代車希望",\s*"出かける可能性があるので、一応代車を用意してほしいんですが、できますか？",\s*"pending"/,
  "店内待ち確認後の代車希望が、音声準備中として登録されていません"
);

const markerStart = appSource.indexOf("function markScriptedStepNotApplicable");
const markerEnd = appSource.indexOf("function scriptedStepMatches", markerStart);
assert.notEqual(markerStart, -1, "対象外記録関数が見つかりません");
assert.notEqual(markerEnd, -1, "対象外記録関数の終端が見つかりません");

const markerContext = { state: { analyses: [] } };
vm.createContext(markerContext);
vm.runInContext(appSource.slice(markerStart, markerEnd), markerContext);
markerContext.markScriptedStepNotApplicable(
  { key: "explained_loaner", expected: "代車説明" },
  "スタッフが店内待ちを提案"
);
assert.equal(markerContext.state.analyses.length, 1, "対象外判定が記録されません");
assert.equal(markerContext.state.analyses[0].notApplicable, true, "代車項目が対象外になりません");
assert.equal(markerContext.state.analyses[0].blocked, false, "対象外項目を聞き返し減点にしています");

const waitingOfferStart = appSource.indexOf("function hasInspectionWaitingChoiceOffer");
const waitingOfferEnd = appSource.indexOf("function hasInspectionAvailableFromInformation", waitingOfferStart);
assert.notEqual(waitingOfferStart, -1, "店内待ちの積極提案判定が見つかりません");
assert.notEqual(waitingOfferEnd, -1, "店内待ちの積極提案判定の終端が見つかりません");
const waitingOfferContext = { normalizeScriptedText: (text) => String(text).replace(/\s+/g, "") };
vm.createContext(waitingOfferContext);
vm.runInContext(appSource.slice(waitingOfferStart, waitingOfferEnd), waitingOfferContext);
assert.equal(
  waitingOfferContext.hasInspectionWaitingChoiceOffer("90分程度です。お店でお待ちいただくこともできますが、いかがでしょうか？"),
  true,
  "店内待ちを選択肢として提案した発話を認識できません"
);
assert.equal(
  waitingOfferContext.hasInspectionWaitingChoiceOffer("はい、お店でお待ちいただけます。"),
  false,
  "店内待ち質問への回答を、スタッフからの積極提案と誤認識しています"
);

const scoringStart = appSource.indexOf("function scoreScriptedRoleplay");
const scoringEnd = appSource.indexOf("function buildImprovementTalk", scoringStart);
assert.notEqual(scoringStart, -1, "車検誘致採点関数が見つかりません");
assert.notEqual(scoringEnd, -1, "車検誘致採点関数の終端が見つかりません");

const scoring = [
  { key: "explained_duration_and_wait", label: "作業時間・店内待ち", action: "店内待ちを説明する", points: 7 },
  { key: "explained_loaner", label: "代車予約", action: "代車を説明する", points: 6 },
  { key: "confirmed_booking_time", label: "予約手続き確認", action: "予約を確認する", points: 5 }
];
const scoringContext = {
  scenario: { scoring, recommendedTalk: "推奨" },
  state: {
    analyses: [
      { scripted: true, stepKey: "explained_duration_and_wait", explained_duration_and_wait: true, blocked: false },
      { scripted: true, stepKey: "explained_loaner", explained_loaner: false, blocked: false, notApplicable: true },
      { scripted: true, stepKey: "confirmed_booking_time", confirmed_booking_time: true, blocked: false }
    ]
  }
};
vm.createContext(scoringContext);
vm.runInContext(appSource.slice(scoringStart, scoringEnd), scoringContext);
const result = scoringContext.scoreScriptedRoleplay();
assert.equal(result.score, 100, "対象外の代車6点を除いた満点換算になりません");
assert.equal(result.improve.some((item) => item.includes("代車")), false, "対象外の代車が改善点に表示されます");
assert.equal(result.judgements.some((item) => item === "代車予約: 対象外（店内待ち提案済み）"), true, "代車の対象外表示がありません");

console.log("店内待ち後の代車分岐テスト: OK");
