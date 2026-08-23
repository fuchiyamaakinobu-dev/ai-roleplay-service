import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const voiceSpec = readFileSync(new URL("../docs/VOICE_AND_MIC_SPEC.md", import.meta.url), "utf8");

for (const value of ["0", "500", "1000", "1500", "2000", "3000"]) {
  assert.match(html, new RegExp(`<option value="${value}"`));
}

assert.match(html, /id="replyDelaySelect"/);
assert.match(html, /id="speechDecisionDelaySelect"/);
for (const value of ["500", "800", "1000", "1500", "2000"]) {
  assert.match(html, new RegExp(`<option value="${value}"`));
}
assert.match(html, /<option value="1500" selected>1\.5秒（推奨）<\/option>/);
assert.match(html, /id="sendButton"/);
assert.match(app, /roleplayCustomerReplyDelayMs/);
assert.match(app, /\["0", "500", "1000", "1500", "2000", "3000"\]\.includes\(savedCustomerReplyDelay\)/);
assert.match(app, /roleplaySpeechDecisionDelayMs/);
assert.match(app, /\["500", "800", "1000", "1500", "2000"\]\.includes\(savedSpeechDecisionDelay\)/);
assert.match(app, /speechDecisionTimer = window\.setTimeout\([\s\S]*?speechDecisionDelayMs\(\)\);/);
assert.match(app, /previousMessage\?\.role === "staff"/);
assert.match(app, /state\.customerReplyPending/);
assert.match(app, /onCommitted: finished/);
assert.match(voiceSpec, /発話完了判定時間は0\.5秒・0\.8秒・1秒・1\.5秒・2秒から選択/);
assert.match(voiceSpec, /マイク開始待ち180ミリ秒は変更しない/);

console.log("customer reply delay QA: OK");
