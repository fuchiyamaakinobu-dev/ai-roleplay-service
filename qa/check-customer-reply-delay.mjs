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
assert.doesNotMatch(html, /id="speechDecisionDelaySelect"/);
assert.match(html, /<option value="1500" selected>1\.5秒（推奨）<\/option>/);
assert.match(html, /id="sendButton"/);
assert.match(app, /roleplayInteractionDelayMs/);
assert.match(app, /function interactionDelayMs\(\)/);
assert.match(app, /\? interactionDelayMs\(\)/);
assert.match(app, /&& !interactionDelayAlreadyElapsed/);
assert.match(app, /interactionDelayAlreadyElapsed = true;[\s\S]*?requestSubmit\(\);[\s\S]*?interactionDelayAlreadyElapsed = false;/);
assert.match(app, /speechDecisionTimer = window\.setTimeout\([\s\S]*?interactionDelayMs\(\)\);/);
assert.match(app, /previousMessage\?\.role === "staff"/);
assert.match(app, /state\.customerReplyPending/);
assert.match(app, /onCommitted: finished/);
assert.match(voiceSpec, /「AIお客様の反応速度」1項目へ統合|1つの設定で変更できる/);
assert.match(voiceSpec, /マイク開始待ち180ミリ秒は変更しない/);

console.log("customer reply delay QA: OK");
