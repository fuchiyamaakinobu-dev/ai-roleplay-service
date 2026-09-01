import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioDb = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const start = source.indexOf("function asksInspectionWaitingMethodConfirmation");
const end = source.indexOf("function asksInspectionLoanerNeed", start);
assert.notEqual(start, -1, "来店可否と店内待ちを分ける判定がありません");
assert.notEqual(end, -1, "来店可否判定の終端がありません");

const context = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text)
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
const visitStart = source.indexOf("function asksInspectionVisitAttendance");
const visitEnd = source.indexOf("function hasInspectionAvailabilityRequest", visitStart);
assert.notEqual(visitStart, -1, "来店可否判定がありません");
vm.runInContext(source.slice(visitStart, visitEnd), context);

assert.equal(
  context.asksInspectionVisitAttendance("作業時間は一時間半ですが、ご来店いただけますでしょうか。"),
  true,
  "来店可否質問を認識できません"
);
assert.equal(
  context.asksInspectionWaitingMethodConfirmation("作業時間は一時間半ですが、ご来店いただけますでしょうか。"),
  false,
  "来店可否を店内待ち確認として誤認識しています"
);
assert.equal(
  context.asksInspectionWaitingMethodConfirmation("店内でお待ちいただけますか。"),
  true,
  "明確な店内待ち確認を認識できません"
);

const handlerStart = source.indexOf("function handleScriptedStaffReply");
const handlerEnd = source.indexOf("function handleReply", handlerStart);
const handler = source.slice(handlerStart, handlerEnd);
assert.match(
  handler,
  /hasSupportedInspectionDuration\(text\)[\s\S]*?asksInspectionVisitAttendance\(text\)[\s\S]*?!\/\(\?:待\|店内\)\/[\s\S]*?addMessage\("customer", "お店で待つことはできますか？",[\s\S]*?inspection_duration_wait_missing_retry/,
  "作業時間＋来店可否へ店内待ちだけを尋ねる分岐がありません"
);
assert.match(
  audioDb,
  /inspection_duration_wait_missing_retry",\s*"店内待ち案内不足・聞き返し",\s*"お店で待つことはできますか？"/,
  "店内待ち確認の表示文と登録音声文が一致していません"
);
const audio = new URL("../audio-ondoku/inspection_duration_wait_missing_retry.mp3", import.meta.url);
assert.equal(fs.existsSync(audio), true, "店内待ち確認MP3がありません");
assert.ok(fs.statSync(audio).size > 1000, "店内待ち確認MP3が空です");

console.log("車検誘致・来店可否と店内待ちの区別テスト: OK");
