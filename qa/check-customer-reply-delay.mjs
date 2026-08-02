import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const voiceSpec = readFileSync(new URL("../docs/VOICE_AND_MIC_SPEC.md", import.meta.url), "utf8");

for (const value of ["0", "500", "1000", "1500", "2000", "3000"]) {
  assert.match(html, new RegExp(`<option value="${value}"`));
}

assert.match(html, /id="replyDelaySelect"/);
assert.match(html, /id="sendButton"/);
assert.match(app, /roleplayCustomerReplyDelayMs/);
assert.match(app, /\["0", "500", "1000", "1500", "2000", "3000"\]\.includes\(savedCustomerReplyDelay\)/);
assert.match(app, /previousMessage\?\.role === "staff"/);
assert.match(app, /state\.customerReplyPending/);
assert.match(app, /onCommitted: finished/);
assert.match(voiceSpec, /音声認識結果の完結を判定する2秒/);
assert.match(voiceSpec, /マイク開始待ち180ミリ秒は変更しない/);

console.log("customer reply delay QA: OK");
