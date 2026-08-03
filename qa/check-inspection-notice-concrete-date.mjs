import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const helperStart = source.indexOf("function normalizeScriptedText");
const helperEnd = source.indexOf("function hasCourtesyExpression", helperStart);

assert.notEqual(helperStart, -1, "車検誘致の正規化関数が見つかりません");
assert.notEqual(helperEnd, -1, "車検案内判定関数の終端が見つかりません");

const context = {
  scenario: {
    vehicleName: "ヤリス",
    expiryDate: "9月30日"
  }
};
vm.createContext(context);
vm.runInContext(source.slice(helperStart, helperEnd), context);

const noticeStep = {
  key: "explained_inspection_notice",
  requiredGroups: [["ヤリス"], ["車検"], ["近", "時期"]]
};
const availabilityStep = {
  key: "asked_availability",
  requiredGroups: [["ご都合", "予定", "日程"]]
};
const expiryStep = {
  key: "explained_available_period",
  requiredGroups: [["9月30日"], ["満了", "車検"]]
};

const combinedTalk = "お使いでいらっしゃいますヤリスでございますが、車検が9月30日までとなっておりますので、ご案内のお電話でございました。ご都合の方はいかがかと思いまして、お電話してみたんですが、いかがでしょうか？";
const spokenDateTalk = "お使いでいらっしゃいますヤリスでございますが、車検が9月の30日までとなっておりますので、そのご連絡でございました。ご都合の方はいかがでしょうか？";
const earlyTalk = "お使いでいらっしゃいますヤリスでございますが、9月30日までとなりました。ご都合の方はいかがかと思いまして、お電話をしてみました。";
const followUpTalk = "車検のご予定はお決まりでしたでしょうか？";
const carriedTalk = `${earlyTalk} ${followUpTalk}`;

assert.equal(
  context.scriptedStepMatches(combinedTalk, noticeStep),
  true,
  "具体的な満了日を車検時期の案内として認識できません"
);
assert.equal(
  context.scriptedStepMatches(combinedTalk, availabilityStep),
  true,
  "同じ発話の都合確認を認識できません"
);
assert.equal(
  context.scriptedStepMatches(combinedTalk, expiryStep),
  true,
  "同じ発話の満了日案内を認識できません"
);
assert.equal(
  context.normalizeScriptedText("車検が9月の30日までです"),
  "車検が9月30日までです",
  "月日の間に入った助詞を正規化できません"
);
assert.equal(
  context.scriptedStepMatches(spokenDateTalk, noticeStep),
  true,
  "『9月の30日』を具体的な車検時期として認識できません"
);
assert.equal(
  context.scriptedStepMatches(spokenDateTalk, availabilityStep),
  true,
  "『9月の30日』と同じ発話の都合確認を認識できません"
);
assert.equal(
  context.scriptedStepMatches(spokenDateTalk, expiryStep),
  true,
  "『9月の30日』を登録済み満了日として認識できません"
);
assert.equal(
  context.scriptedStepMatches("ヤリスの車検のご案内です。", noticeStep),
  false,
  "時期または具体的な満了日がない案内を誤認識しています"
);
assert.equal(
  context.scriptedStepMatches("ヤリスの車検時期が近くなりました。", noticeStep),
  true,
  "従来の車検時期案内を認識できなくなっています"
);
assert.equal(
  context.scriptedStepMatches(earlyTalk, noticeStep),
  false,
  "車検という説明がない発話を単独で車検案内として誤認識しています"
);
assert.equal(
  context.scriptedStepMatches(followUpTalk, noticeStep),
  false,
  "車種と時期がない補足発話を単独で車検案内として誤認識しています"
);
assert.equal(
  context.scriptedStepMatches(carriedTalk, noticeStep),
  true,
  "直前の車種・満了日と次の車検説明を合わせて認識できません"
);
assert.equal(
  context.scriptedStepMatches(carriedTalk, availabilityStep),
  true,
  "引き継いだ発話の都合確認を認識できません"
);
assert.equal(
  context.scriptedStepMatches(carriedTalk, expiryStep),
  true,
  "引き継いだ発話の満了日案内を認識できません"
);
assert.match(
  source,
  /scriptedStepCanAdvanceOnFailure\(step\)[\s\S]*?state\.scriptedPartialReplies\[followingStep\.key\]/,
  "お礼を省略して進んだ発話が次の項目へ引き継がれません"
);
assert.match(
  source,
  /scriptedStepMatches\(combinedText, nextStep\)/,
  "補足前後の発話を連続項目の判定に使用していません"
);

console.log("車検時期・具体的満了日判定テスト: OK");
