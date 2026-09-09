import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const voiceSpec = readFileSync(new URL("../docs/VOICE_AND_MIC_SPEC.md", import.meta.url), "utf8");

for (const value of ["500", "800", "1000", "1500", "2000"]) {
  assert.match(html, new RegExp(`<option value="${value}"`));
}

assert.match(html, /id="interactionDelaySelect"/);
assert.doesNotMatch(html, /id="replyDelaySelect"/);
assert.match(html, /id="speechDecisionDelaySelect"/);
assert.match(html, /<option value="1500" selected>1\.5秒（推奨）<\/option>/);
assert.match(html, /<option value="3000" selected>3秒（推奨）<\/option>/);
assert.match(html, /id="sendButton"/);
assert.match(app, /roleplayInteractionDelayMs/);
assert.match(app, /roleplaySpeechDecisionDelayMs/);
assert.match(app, /function interactionDelayMs\(\)/);
assert.match(app, /function speechDecisionDelayMs\(\)/);
assert.match(app, /\? interactionDelayMs\(\)/);
assert.doesNotMatch(app, /interactionDelayAlreadyElapsed/);
assert.match(app, /speechDecisionTimer = window\.setTimeout\([\s\S]*?speechDecisionDelayMs\(\)\);/);
assert.match(app, /previousMessage\?\.role === "staff"/);
assert.match(app, /state\.customerReplyPending/);
assert.match(app, /onCommitted: finished/);
assert.match(voiceSpec, /AIお客様の反応速度と、スタッフ音声の発話終了判定を別々に変更できる/);
assert.match(voiceSpec, /マイク開始待ち180ミリ秒は変更しない/);

console.log("customer reply delay QA: OK");
