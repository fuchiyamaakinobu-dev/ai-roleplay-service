import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function buildImprovementTalk(");
const end = source.indexOf("function proposalMatchesCustomerReason(", start);

assert.notEqual(start, -1, "改善トーク生成関数が見つかりません");
assert.notEqual(end, -1, "改善トーク生成関数を切り出せません");

const context = {};
vm.createContext(context);
vm.runInContext(`
  ${source.slice(start, end)}
  this.buildImprovementTalk = buildImprovementTalk;
`, context);

const reasonOnly = context.buildImprovementTalk(["asked_reason"], "work");
assert.match(reasonOnly, /引取をご希望される理由/);
assert.doesNotMatch(reasonOnly, /オイル交換|気になる点/);

const additionalServiceOnly = context.buildImprovementTalk(
  ["asked_additional_service"],
  "work"
);
assert.match(additionalServiceOnly, /オイル交換/);
assert.doesNotMatch(additionalServiceOnly, /引取をご希望される理由/);

const achievedAll = context.buildImprovementTalk([], "work");
assert.match(achievedAll, /必要な確認と提案ができています/);

const distanceTalk = context.buildImprovementTalk(["proposed_other_store"], "distance");
assert.match(distanceTalk, /近い店舗|ご家族/);

console.log("未達項目だけを使う改善トーク表示テスト: OK");
