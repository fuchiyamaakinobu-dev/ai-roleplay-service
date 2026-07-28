import assert from "node:assert/strict";
import fs from "node:fs";

const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const expected = "遠いし運転に自信が無いのでお店には行けません。";
const retired = "遠いし運転に自信が無いので本別には行けません。";

assert.match(scenarioSource, new RegExp(expected));
assert.match(audioSource, new RegExp(expected));
assert.doesNotMatch(scenarioSource, new RegExp(retired));
assert.doesNotMatch(audioSource, new RegExp(retired));
assert.match(audioSource, /id: "objectionDistance03"[\s\S]+file: "customer_objection_distance_03\.mp3"/);

console.log("距離・運転不安のお客様発話テスト: OK");
