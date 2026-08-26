import assert from "node:assert/strict";
import fs from "node:fs";

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

console.log("音声入力・未完了発話の無音継続テスト: OK");
