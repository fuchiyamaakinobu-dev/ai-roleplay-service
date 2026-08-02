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
  context.scriptedStepMatches("ヤリスの車検のご案内です。", noticeStep),
  false,
  "時期または具体的な満了日がない案内を誤認識しています"
);
assert.equal(
  context.scriptedStepMatches("ヤリスの車検時期が近くなりました。", noticeStep),
  true,
  "従来の車検時期案内を認識できなくなっています"
);

console.log("車検時期・具体的満了日判定テスト: OK");
