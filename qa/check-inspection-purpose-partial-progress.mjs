import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const helperStart = source.indexOf("function normalizeScriptedText");
const helperEnd = source.indexOf("function scriptedRequiredGroupsMatch", helperStart);

assert.notEqual(helperStart, -1, "車検誘致の正規化関数が見つかりません");
assert.notEqual(helperEnd, -1, "車検用件判定関数の終端が見つかりません");

const context = {
  scenario: {
    vehicleName: "ヤリス",
    expiryDate: "9月30日"
  }
};
vm.createContext(context);
vm.runInContext(source.slice(helperStart, helperEnd), context);

assert.equal(
  context.hasClearInspectionPurposeNotice("車検の時期が近くなりましたのでご連絡させていただきました"),
  true,
  "車検の用件が明確な発話を認識できません"
);
assert.equal(
  context.hasClearInspectionPurposeNotice("お使いのヤリスですが9月30日までとなりましたが、ご予定はお決まりでしたでしょうか"),
  true,
  "登録車種・満了日・予定確認を車検案内の文脈として認識できません"
);
assert.equal(
  context.hasClearInspectionPurposeNotice("点検の時期が近くなりましたのでご連絡しました"),
  false,
  "車検と明示していない発話を車検用件として誤認識しています"
);
assert.equal(
  context.hasClearInspectionPurposeNotice("お使いのヤリスですが、ご予定はお決まりでしたでしょうか"),
  false,
  "登録満了日のない曖昧な予定確認を車検案内として誤認識しています"
);
assert.equal(
  context.hasClearInspectionPurposeNotice("お世話になっております"),
  false,
  "用件を含まない挨拶を車検用件として誤認識しています"
);
assert.match(
  source,
  /explainedPurposeWithoutRequiredDetails[\s\S]*?analysis\.canAdvance = true;[\s\S]*?analysis\.blocked = false;/,
  "必要情報が不足した車検用件を未達のまま進める処理が見つかりません"
);

console.log("車検用件の部分説明進行テスト: OK");
