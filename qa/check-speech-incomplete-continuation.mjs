import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const resultHandlerStart = source.indexOf('speechRecognition.addEventListener("result"');
const resultHandlerEnd = source.indexOf('speechRecognition.addEventListener("end"', resultHandlerStart);
const resultHandler = source.slice(resultHandlerStart, resultHandlerEnd);

assert.notEqual(resultHandlerStart, -1, "音声認識のresult処理が見つかりません");
assert.notEqual(resultHandlerEnd, -1, "音声認識のresult処理を切り出せません");
assert.match(
  resultHandler,
  /発言途中として相づちを返し、同じ未確認項目を継続します。/,
  "未完了発話を相づちへ渡す案内がありません"
);
assert.match(
  resultHandler,
  /stopSpeechInput\(\{ preserveSession: true \}\)[\s\S]*?replyForm\.requestSubmit\(\)/,
  "未完了発話を記録して相づち処理へ渡していません"
);
assert.doesNotMatch(
  source,
  /function acknowledgeAndContinue\(/,
  "発話途中に「はい」を再生する旧処理が残っています"
);

const completionStart = source.indexOf("function looksLikeCompleteJapaneseSentence");
const completionEnd = source.indexOf("function startRoleplay", completionStart);
assert.notEqual(completionStart, -1, "発話完了判定が見つかりません");
assert.notEqual(completionEnd, -1, "発話完了判定の終端が見つかりません");
const context = {
  hasTrailingServiceInquiry: () => false
};
vm.createContext(context);
vm.runInContext(source.slice(completionStart, completionEnd), context);

for (const phrase of [
  "お使いのヤリスが。",
  "それともし。",
  "当日は車検証をお持ちいただきますが。",
  "あや。いいしゃ。みつい",
  "あや。いいしゃ。みつい。",
  "車検証、自賠責保険証券。"
]) {
  assert.equal(
    context.looksLikeCompleteJapaneseSentence(phrase),
    false,
    `発話途中を完成文として自動送信しています: ${phrase}`
  );
}
for (const phrase of [
  "お使いのヤリスが9月30日に車検満了を迎えます。",
  "当日は車検証をお持ちください。",
  "代車はどうされるか"
]) {
  assert.equal(
    context.looksLikeCompleteJapaneseSentence(phrase),
    true,
    `完成した案内を発話途中として保持しています: ${phrase}`
  );
}

const questionClauseStart = source.indexOf("function inspectionLastQuestionClause");
const questionClauseEnd = source.indexOf("function startRoleplay", questionClauseStart);
assert.notEqual(questionClauseStart, -1, "最後の疑問節を取り出す処理が見つかりません");
const questionContext = {
  normalizeScriptedText(value) {
    return String(value || "").replace(/\s+/g, "");
  },
  looksLikeCompleteJapaneseSentence: () => true
};
vm.createContext(questionContext);
vm.runInContext(
  `${source.slice(questionClauseStart, questionClauseEnd)}\nthis.inspectionLastQuestionClause = inspectionLastQuestionClause; this.isInspectionIncompleteOrNoiseUtterance = isInspectionIncompleteOrNoiseUtterance;`,
  questionContext
);
assert.equal(
  questionContext.inspectionLastQuestionClause("作業は90分です。店内で待ちますか？また、代車は必要でしょうか？"),
  "代車は必要でしょうか？",
  "最後の読点から疑問符までを返答判断へ使えていません"
);
assert.equal(
  questionContext.inspectionLastQuestionClause("9月5日土曜日、よろしいですか？"),
  "よろしいですか？"
);
assert.equal(
  questionContext.isInspectionIncompleteOrNoiseUtterance("で、その次、なんでしたっけ？"),
  true,
  "スタッフの独り言を未完了・ノイズとして除外できません"
);
assert.equal(
  questionContext.isInspectionIncompleteOrNoiseUtterance("9月5日土曜日、よろしいですか？"),
  false,
  "日時を含む完成した質問を未完了扱いしています"
);

console.log("音声入力・未完了発話の相づち継続テスト: OK");
