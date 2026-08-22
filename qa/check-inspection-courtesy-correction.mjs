import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const correctionStart = appSource.indexOf("const courtesyStep = scenario.steps.find");
const normalAnalysisStart = appSource.indexOf(
  "const answeredDayPreferenceAfterExpiry",
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
