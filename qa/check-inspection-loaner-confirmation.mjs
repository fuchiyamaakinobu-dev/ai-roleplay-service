import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const normalizeStart = appSource.indexOf("function normalizeLoanerHomophone");
const helperEnd = appSource.indexOf("function hasInspectionAvailableFromInformation", normalizeStart);
assert.notEqual(normalizeStart, -1, "車検誘致の文字正規化関数が見つかりません");
assert.notEqual(helperEnd, -1, "代車承諾判定の終端が見つかりません");

const helperContext = {};
vm.createContext(helperContext);
vm.runInContext(appSource.slice(normalizeStart, helperEnd), helperContext);

for (const text of [
  "代車をご用意します。",
  "代車の方もご用意させていただくような形になりますね。",
  "代車を準備しておきます。",
  "代車を手配いたします。",
  "台車をご用意できます。"
]) {
  assert.equal(
    helperContext.hasInspectionLoanerConfirmation(text),
    true,
    `代車手配の承諾を認識できません: ${text}`
  );
}

for (const text of [
  "代車をご用意できません。",
  "代車の用意は難しいです。",
  "代車について確認します。",
  "代車ですね。"
]) {
  assert.equal(
    helperContext.hasInspectionLoanerConfirmation(text),
    false,
    `代車手配の未承諾を達成扱いにしています: ${text}`
  );
}

const matcherStart = appSource.indexOf("function scriptedRequiredGroupsMatch");
const matcherEnd = appSource.indexOf("function analyzeScriptedStaff", matcherStart);
assert.notEqual(matcherStart, -1, "必須語句判定関数が見つかりません");
assert.notEqual(matcherEnd, -1, "必須語句判定関数の終端が見つかりません");

const matcherContext = {
  state: { inspectionMileageAsked: true, inspectionWaitingRequested: true },
  scenario: {},
  hasSupportedInspectionDuration: () => false,
  hasInspectionLoanerConfirmation: helperContext.hasInspectionLoanerConfirmation,
  hasInspectionBookingInvitation: () => false,
  normalizeScriptedText: helperContext.normalizeScriptedText
};
vm.createContext(matcherContext);
vm.runInContext(appSource.slice(matcherStart, matcherEnd), matcherContext);

const loanerStep = { key: "explained_loaner" };
assert.equal(
  matcherContext.scriptedRequiredGroupsMatch(
    "代車の方もご用意させていただくような形になりますね。",
    loanerStep,
    [["代車"], [], [], ["ご用意"]]
  ),
  true,
  "早め・予約がなくても、依頼後の明確な代車手配を達成にできません"
);
assert.equal(
  matcherContext.scriptedRequiredGroupsMatch(
    "代車をご用意できません。",
    loanerStep,
    [["代車"], [], [], ["ご用意"]]
  ),
  false,
  "代車を用意できない回答を達成扱いにしています"
);

matcherContext.state.inspectionWaitingRequested = false;
assert.equal(
  matcherContext.scriptedRequiredGroupsMatch(
    "代車をご用意します。",
    loanerStep,
    [["代車"], [], [], ["ご用意"]]
  ),
  false,
  "スタッフから先に案内する通常分岐の『早め・予約』条件を省略しています"
);

console.log("代車手配承諾の重複質問防止テスト: OK");
