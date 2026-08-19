import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(appSource, /text: "おっしゃっていることがよく分からないんですけど。",\s*audioId: scenario\.audio\.needsMoreContext/);
assert.match(appSource, /if \(analysis\.pressured_customer \|\| analysis\.refused_pickup\) return "needs_more_context";/);
assert.doesNotMatch(appSource, /if \(analysis\.ambiguous\) return "needs_more_context";/);
assert.doesNotMatch(appSource, /すみません。もう一度、別の言い方でお願いします。/);
assert.doesNotMatch(appSource, /確認したい内容を、もう少し具体的に教えてください。/);
assert.match(appSource, /text: "何時に行けばいいんですか？",\s*audioId: "appointmentTimeSpecific"/);
assert.doesNotMatch(appSource, /10時や16時など、具体的な時刻を教えてください。/);
assert.match(appSource, /function repeatServiceTimeQuestionTurn\(\)/);
assert.match(appSource, /\.filter\(\(item\) => item\.text !== lastCustomerText\)/);
assert.match(
  appSource,
  /if \(!state\.serviceTimeExplained\) \{\s*return repeatServiceTimeQuestionTurn\(\);/
);
assert.match(appSource, /state\.resolutionType = state\.resolutionType \|\| "continuedWithMissingConfirmation";/);

console.log("12カ月点検・自然な再質問表現テスト: OK");
