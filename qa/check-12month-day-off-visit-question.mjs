import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(appSource, /function isDayOffVisitQuestion\(normalized, isQuestion\)/);
assert.match(
  appSource,
  /if \(analysis\.proposed_day_off_visit\) \{\s*state\.resolutionType = "dayOffAvailability";\s*return customerTurnFromAudio\(scenario\.audio\.possibleAgreements\[0\], "土日なら行けるかもしれません。"\);/
);

console.log("12カ月点検・休日来店確認テスト: OK");
