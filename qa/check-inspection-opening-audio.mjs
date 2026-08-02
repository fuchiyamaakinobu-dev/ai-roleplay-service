import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenario = readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDb = readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const ringbackFile = new URL("../audio-ondoku/inspection_call_ringback.mp3", import.meta.url);

assert.match(scenario, /ringbackAudioId: "inspection_call_ringback"/);
assert.match(scenario, /openingCustomerMessage: "はい、もしもし。"/);
assert.match(scenario, /openingCustomerAudioId: "inspection_phone_greeting_customer"/);
assert.match(audioDb, /\["inspection_call_ringback", "電話冒頭・呼び出し音", "（呼び出し音）"\]/);
assert.match(app, /playAudio\(ringbackSrc, "", false, playGreeting\)/);
assert.match(app, /startStaffLedOpening\(\)/);
assert.match(app, /addMessage\("system", staffLedStartInstruction\(\)\)/);
assert.ok(existsSync(ringbackFile), "呼び出し音ファイルがありません");
assert.ok(statSync(ringbackFile).size > 10000, "呼び出し音ファイルが小さすぎます");

console.log("車検誘致・開始呼び出し音テスト: OK");
