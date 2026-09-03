import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const courtesyStart = appSource.indexOf("function hasCourtesyExpression");
const courtesyEnd = appSource.indexOf("function isAffirmativeScriptedReply", courtesyStart);
assert.notEqual(courtesyStart, -1, "日頃のお礼判定がありません");
assert.notEqual(courtesyEnd, -1, "日頃のお礼判定の終端がありません");
const courtesyContext = {};
vm.createContext(courtesyContext);
vm.runInContext(appSource.slice(courtesyStart, courtesyEnd), courtesyContext);

for (const text of [
  "日頃は大変お世話になり、ありがとうございます。",
  "いつもお世話になっております。ありがとうございます。",
  "平素はお世話になりまして、誠に感謝しております。",
  "日頃は当社をご利用いただき、ありがとうございます。",
  "ご愛顧いただき感謝しております。",
  "いつもありがとうございます。",
  "お世話になっております。",
  "お世話になっています。",
  "いつもお世話になってます。"
]) {
  assert.equal(courtesyContext.hasCourtesyExpression(text), true, `日頃のお礼として判定できません: ${text}`);
}

for (const text of [
  "ありがとうございます。",
  "ご連絡ありがとうございます。",
  "お世話になります。"
]) {
  assert.equal(courtesyContext.hasCourtesyExpression(text), false, `一般的なお礼を日頃のお礼と誤判定しています: ${text}`);
}

assert.match(
  appSource,
  /step\.key === "thanked_customer"[\s\S]*?return hasCourtesyExpression\(normalized\);/,
  "日頃のお礼の自然な言い回しが工程達成判定へ接続されていません"
);

const correctionStart = appSource.indexOf("const courtesyStep = scenario.steps.find");
const normalAnalysisStart = appSource.indexOf(
  "const combinedText = combinedScriptedReply(text, step);",
  correctionStart
);
assert.notEqual(correctionStart, -1, "日頃のお礼の言い直し分岐がありません");
assert.notEqual(normalAnalysisStart, -1, "通常の車検案内判定が見つかりません");
assert.ok(
  correctionStart < normalAnalysisStart,
  "お礼の言い直しが車検案内不足の判定より後にあります"
);

const correctionBlock = appSource.slice(correctionStart, normalAnalysisStart);
assert.match(correctionBlock, /step\.key === "explained_inspection_notice"/);
assert.match(correctionBlock, /hasCourtesyExpression\(text\)/);
assert.match(correctionBlock, /!hasClearInspectionPurposeNotice\(text\)/);
assert.match(correctionBlock, /item\.stepKey === "thanked_customer" && !item\.passed/);
assert.match(correctionBlock, /markScriptedStepPassed\(courtesyStep, text\)/);
assert.match(correctionBlock, /delete state\.scriptedPartialReplies\[step\.key\]/);
assert.match(correctionBlock, /courtesyStep\.customerResponse/);
assert.match(correctionBlock, /inspection_thanked_customer_customer/);
assert.match(correctionBlock, /return;/);

assert.match(
  audioDbSource,
  /inspection_thanked_customer_customer",\s*"利用へのお礼・お客様回答",\s*"こちらこそ。"\]/,
  "お礼の言い直し後の表示文と音声登録文が一致していません"
);
const courtesyAudio = new URL(
  "../audio-ondoku/inspection_thanked_customer_customer.mp3",
  import.meta.url
);
assert.equal(fs.existsSync(courtesyAudio), true, "お礼の言い直し後のまことMP3がありません");
assert.ok(fs.statSync(courtesyAudio).size > 1000, "お礼の言い直し後のMP3が空、または小さすぎます");

console.log("日頃のお礼の言い直しテスト: OK");
