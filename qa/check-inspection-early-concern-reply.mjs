import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function normalizeScriptedText");
const helperEnd = appSource.indexOf("function hasCourtesyExpression", helperStart);
assert.notEqual(helperStart, -1, "車検誘致の会話判定関数が見つかりません");
assert.notEqual(helperEnd, -1, "車検誘致の会話判定関数の終端が見つかりません");

const context = {
  state: { inspectionMileageAsked: false },
  scenario: { customerName: "佐藤様", expiryDate: "9月30日" }
};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

const additionalFollowUpStart = appSource.indexOf("function asksInspectionAdditionalServiceFollowUp");
const additionalFollowUpEnd = appSource.indexOf("function analyzeStaff", additionalFollowUpStart);
assert.notEqual(additionalFollowUpStart, -1, "追加作業再確認の判定関数が見つかりません");
assert.notEqual(additionalFollowUpEnd, -1, "追加作業再確認の判定関数の終端が見つかりません");
const additionalFollowUpContext = {
  normalizeScriptedText: (text) => String(text).replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|ませんか|ございませんか|[?？])/.test(text)
};
vm.createContext(additionalFollowUpContext);
vm.runInContext(
  appSource.slice(additionalFollowUpStart, additionalFollowUpEnd),
  additionalFollowUpContext
);

for (const phrase of [
  "その他の追加作業はございますでしょうか？",
  "その他何か、追加する整備などはございますでしょうか？",
  "そのほかに整備しておくことはありますか？",
  "かしこまりました。その他、気になるところはございませんでしょうか？"
]) {
  assert.equal(
    additionalFollowUpContext.asksInspectionAdditionalServiceFollowUp(phrase),
    true,
    `${phrase} をオイル交換後の追加作業再確認として認識できません`
  );
}
assert.equal(
  additionalFollowUpContext.asksInspectionAdditionalServiceFollowUp("お店で待つことはできますか？"),
  false,
  "店内待ちの質問を追加作業再確認として誤認識しています"
);
for (const phrase of [
  "不明点等はございますでしょうか？",
  "何かご不明な点はございますか？",
  "ほかにご質問はありませんか？"
]) {
  assert.equal(
    additionalFollowUpContext.asksInspectionForCustomerQuestions(phrase),
    true,
    `${phrase} をお客様の質問有無確認として認識できません`
  );
}
assert.equal(
  additionalFollowUpContext.asksInspectionForCustomerQuestions("不明点をご説明します。"),
  false,
  "質問ではない不明点の説明を質問有無確認として誤認識しています"
);

const concernStep = {
  key: "asked_vehicle_concerns",
  requiredGroups: [["気になる", "不具合", "調子", "具合"]]
};
for (const phrase of [
  "何かお使いになっていて気になるところはございませんでしょうか？",
  "調子の悪いところはございますでしょうか？",
  "何か気になることや調子が悪いこと、オイル交換等はいかがいたしましょうか。",
  "お車で何か不具合はありませんか？",
  "佐藤様、ヤリスの車検の他に、どこか不都合なところ、見てほしいところ、整備などございますか？"
]) {
  assert.equal(
    context.scriptedStepMatches(phrase, concernStep),
    true,
    `${phrase} を車両状態の質問として認識できません`
  );
}
assert.equal(
  context.asksInspectionVehicleConcerns(
    "かしこまりました。代車の方もご用意いたします。佐藤様、ヤリスの車検の他に、どこか不都合なところ、見てほしいところ、整備などございますか？"
  ),
  true,
  "代車承諾と同時に尋ねた『不都合・見てほしいところ』を車両状態確認として認識できません"
);
assert.equal(
  context.scriptedStepMatches("調子は良いですね。", concernStep),
  false,
  "質問ではない車両状態の言及を誤認識しています"
);

const earlyConcernStart = appSource.indexOf("const concernStepIndex = scenario.steps.findIndex");
const closingIntentStart = appSource.indexOf("const closingIntent = hasScriptedClosingIntent", earlyConcernStart);
assert.notEqual(earlyConcernStart, -1, "前倒し車両状態確認の分岐がありません");
assert.notEqual(closingIntentStart, -1, "前倒し車両状態確認が通常判定より前にありません");
const earlyConcernBlock = appSource.slice(earlyConcernStart, closingIntentStart);
assert.match(earlyConcernBlock, /scriptedStepMatches\(text, concernStep\)/);
assert.match(earlyConcernBlock, /analyzeScriptedStaff\(text, concernStep\)/);
assert.match(earlyConcernBlock, /state\.scriptedPartialReplies\[step\.key\]/);
assert.match(earlyConcernBlock, /オイル交換もお願いしたいです。/);
assert.match(earlyConcernBlock, /inspection_asked_vehicle_concerns_customer/);
assert.match(
  earlyConcernBlock,
  /askedConcernsEarly[\s\S]*?オイル交換もお願いしたいです。/,
  "代車案内より後の車両状態質問へオイル交換希望を優先できません"
);
assert.match(
  appSource,
  /responseStep\.key === "asked_vehicle_concerns"[\s\S]*?text:\s*"オイル交換もお願いしたいです。"[\s\S]*?audioId:\s*"inspection_asked_vehicle_concerns_customer"/,
  "Firestore公開データに旧返答が残る場合の優先返答がありません"
);

assert.match(
  scenarioSource,
  /key:\s*"asked_vehicle_concerns"[\s\S]*?customerResponse:\s*"オイル交換もお願いしたいです。"/,
  "通常の車両状態確認後のお客様返答が更新されていません"
);
assert.match(
  audioDbSource,
  /inspection_asked_vehicle_concerns_customer",\s*"車両状態確認・オイル交換希望",\s*"オイル交換もお願いしたいです。"\]/,
  "表示文と音声登録文が一致していません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_asked_vehicle_concerns_customer.mp3", import.meta.url)),
  true,
  "オイル交換希望の男性音声ファイルがありません"
);
assert.doesNotMatch(
  scenarioSource + audioDbSource,
  /inspection_asked_vehicle_concerns_customer"[^\n]*別にないです。|key:\s*"asked_vehicle_concerns"[\s\S]*?customerResponse:\s*"別にないです。"/,
  "車両状態確認後の旧返答が残っています"
);

const additionalServiceFollowUpStart = appSource.indexOf(
  "if (hasInspectionOilChangeRequest() && asksInspectionAdditionalServiceFollowUp(text))"
);
const currentStepAnalysisStart = appSource.indexOf(
  "const combinedText = combinedScriptedReply(text, step);",
  additionalServiceFollowUpStart
);
assert.notEqual(additionalServiceFollowUpStart, -1, "追加作業再確認への専用分岐がありません");
assert.notEqual(currentStepAnalysisStart, -1, "現在工程の通常判定がありません");
assert.ok(
  additionalServiceFollowUpStart < currentStepAnalysisStart,
  "追加作業再確認が現在工程の不足確認より後に判定されています"
);
const additionalServiceFollowUpBlock = appSource.slice(
  additionalServiceFollowUpStart,
  currentStepAnalysisStart
);
assert.match(additionalServiceFollowUpBlock, /そのほかは大丈夫です。/);
assert.match(additionalServiceFollowUpBlock, /inspection_additional_service_none_customer/);
assert.match(additionalServiceFollowUpBlock, /state\.scriptedPartialReplies\[step\.key\]/);
assert.match(
  appSource,
  /asksInspectionForCustomerQuestions\(text\)[\s\S]*?addMessage\("customer", "そのほかは大丈夫です。"[\s\S]*?inspection_additional_service_none_customer/,
  "不明点の有無確認へ『そのほかは大丈夫です。』と返す処理がありません"
);
assert.match(
  audioDbSource,
  /inspection_additional_service_none_customer",\s*"追加作業再確認・ほかはなし",\s*"そのほかは大丈夫です。"\]/,
  "追加作業再確認の表示文と音声登録文が一致していません"
);
const additionalServiceNoneAudio = new URL(
  "../audio-ondoku/inspection_additional_service_none_customer.mp3",
  import.meta.url
);
assert.equal(
  fs.existsSync(additionalServiceNoneAudio),
  true,
  "追加作業再確認用のまこと音声ファイルがありません"
);
assert.ok(
  fs.statSync(additionalServiceNoneAudio).size > 1000,
  "追加作業再確認用MP3が空、または小さすぎます"
);

console.log("inspection early concern reply checks passed");
