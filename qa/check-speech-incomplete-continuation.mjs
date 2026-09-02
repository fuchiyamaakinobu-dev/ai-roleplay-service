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
  /発言が途中のため、音声入力を続けています。/,
  "未完了発話で音声入力を継続する案内がありません"
);
assert.doesNotMatch(
  resultHandler,
  /acknowledgeAndContinue|speechRecognition\.abort|SpeechSynthesisUtterance\("はい"\)/,
  "スタッフ発話の途中でAI相づちを再生するか、音声認識を中断しています"
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
  "当日は車検証をお持ちください。"
]) {
  assert.equal(
    context.looksLikeCompleteJapaneseSentence(phrase),
    true,
    `完成した案内を発話途中として保持しています: ${phrase}`
  );
}

console.log("音声入力・未完了発話の無音継続テスト: OK");
