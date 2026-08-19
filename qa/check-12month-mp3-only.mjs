import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

assert.match(appSource, /function registered12MonthCustomerMessage/);
assert.match(appSource, /scenario\.id !== "service-12month-visit-promotion"/);
assert.match(appSource, /fallbackAudioId = scenario\.audio\.continueGeneric/);
assert.match(audioSource, /id: "appointmentTimeSpecific"[\s\S]+text: "何時に行けばいいんですか？"[\s\S]+file: "customer_appointment_time_specific\.mp3"[\s\S]+status: "ready"/);

console.log("12カ月点検・登録済みMP3限定テスト: OK");
