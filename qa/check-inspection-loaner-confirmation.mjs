import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");

const normalizeStart = appSource.indexOf("function normalizeLoanerHomophone");
const helperEnd = appSource.indexOf("function hasInspectionAvailableFromInformation", normalizeStart);
assert.notEqual(normalizeStart, -1, "車検誘致の文字正規化関数が見つかりません");
assert.notEqual(helperEnd, -1, "代車承諾判定の終端が見つかりません");

const helperContext = {};
vm.createContext(helperContext);
vm.runInContext(appSource.slice(normalizeStart, helperEnd), helperContext);

for (const text of [
  "作業中は代わりのお車は必要でしょうか？",
  "代車はお使いになりますか？",
  "代車はいかがいたしましょう",
  "代わりのお車は必要でしょうか",
  "当日はご来店頂けますでしょうか？また作業中、代わりのお車などあった方がよろしいでしょうか。"
]) {
  assert.equal(
    helperContext.asksInspectionLoanerNeed(text),
    true,
    `代車利用希望の質問として認識できません: ${text}`
  );
}
assert.equal(
  helperContext.asksInspectionLoanerNeed("代車をご用意いたします。"),
  false,
  "代車手配の確定案内を利用希望の質問として誤認識しています"
);

for (const text of [
  "代車をご用意します。",
  "代車の方もご用意させていただくような形になりますね。",
  "代車も問題なくご用意できるかと思います。",
  "あ、はい。代車ですね。ええ、ご用意は。ええ、問題なくできるかと思います。",
  "代車。用意。できる。",
  "代車。用意。出来る。",
  "代車をご用意できると思います。",
  "代車をご準備させていただいております。",
  "代車を準備しておきます。",
  "代車を手配いたします。",
  "かしこまりました。代車を一応ご依頼させていただきます。",
  "代車を依頼いたします。",
  "台車をご用意できます。",
  "代償もご用意できます。",
  "代わりの車をご用意いたします。"
]) {
  assert.equal(
    helperContext.hasInspectionLoanerConfirmation(text),
    true,
    `代車手配の承諾を認識できません: ${text}`
  );
}

assert.equal(
  helperContext.normalizeLoanerHomophone("ご予約いただければ、代償もご用意できます。"),
  "ご予約いただければ、代車もご用意できます。",
  "音声認識の『代償』を『代車』へ補正できません"
);

for (const text of [
  "代わりの車をご用意いたします。",
  "代わりの車をご用意いたします。車検を受ける時、日程等はいつ頃よろしいでしょうか。",
  "代車をご用意いたします。日程はいつ頃よろしいでしょうか。 代車の方はご用意いたします。"
]) {
  assert.equal(
    helperContext.hasInspectionLoanerConfirmation(text, true),
    true,
    `後続の質問を含む代車手配承諾を認識できません: ${text}`
  );
}

assert.equal(
  helperContext.hasInspectionLoanerConfirmation("大丈夫ですよ。ご用意させていただきます。", true),
  true,
  "直前の代車希望を受けた省略形の手配承諾を認識できません"
);
assert.equal(
  helperContext.hasInspectionLoanerConfirmation("大丈夫ですよ。ご用意させていただきます。"),
  false,
  "代車希望の文脈がない省略形を代車手配の承諾として誤認識しています"
);
assert.equal(
  helperContext.hasInspectionLoanerConfirmation("大丈夫ですよ。", true),
  true,
  "代車希望直後の『大丈夫ですよ』を手配可能の返答として認識できません"
);
assert.equal(
  helperContext.hasInspectionLoanerConfirmation("大丈夫です。", true),
  true,
  "代車希望直後の『大丈夫です』を手配可能の返答として認識できません"
);
assert.equal(
  helperContext.hasInspectionLoanerConfirmation(
    "ご予約いただければ、代車の方はご用意できる？できます。",
    true
  ),
  true,
  "代車案内の言い直し後にある『できます』を手配承諾として認識できません"
);
for (const text of ["大丈夫。", "だいじょうぶ。", "だいじょうぶです。"]) {
  assert.equal(
    helperContext.hasInspectionLoanerConfirmation(text, true),
    true,
    `代車希望直後の短い承諾を認識できません: ${text}`
  );
}
assert.equal(
  helperContext.hasInspectionLoanerConfirmation("空いてますよ。", true),
  true,
  "代車希望直後の『空いてますよ』を手配可能の返答として認識できません"
);
for (const text of [
  "大丈夫ですか？",
  "空いていません。",
  "空いてません。",
  "代車をご用意しますか？",
  "代車ですね。ご用意できますか？",
  "代車。用意。できる？",
  "代車。用意。出来る？",
  "代車を依頼できますか？",
  "大丈夫？",
  "だいじょうぶ？"
] ) {
  assert.equal(
    helperContext.hasInspectionLoanerConfirmation(text, true),
    false,
    `質問または否定を代車手配可能として誤認識しています: ${text}`
  );
}
assert.equal(
  helperContext.hasInspectionLoanerConfirmation("大丈夫です。"),
  false,
  "代車希望の文脈がない『大丈夫です』を代車手配として誤認識しています"
);
assert.equal(
  helperContext.hasInspectionLoanerConfirmation("だいじょうぶ。"),
  false,
  "代車希望の文脈がない『だいじょうぶ』を代車手配として誤認識しています"
);

for (const text of [
  "代車をご用意できません。",
  "代車の用意は難しいです。",
  "代車について確認します。",
  "代車をご用意できるか確認します。",
  "代車を依頼できるか確認します。",
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
  state: {
    inspectionMileageAsked: true,
    inspectionWaitingRequested: true,
    inspectionLoanerRequested: true
  },
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
    "大丈夫です。",
    loanerStep,
    [[], [], [], []]
  ),
  true,
  "代車希望直後の『大丈夫です』を達成にできません"
);
assert.equal(
  matcherContext.scriptedRequiredGroupsMatch(
    "空いてますよ。",
    loanerStep,
    [[], [], [], []]
  ),
  true,
  "代車希望直後の『空いてますよ』を達成にできません"
);
assert.equal(
  matcherContext.scriptedRequiredGroupsMatch(
    "大丈夫ですよ。ご用意させていただきます。",
    loanerStep,
    [[], [], [], ["ご用意"]]
  ),
  true,
  "代車希望直後の『ご用意させていただきます』を達成にできません"
);
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
    "代車も問題なくご用意できるかと思います。",
    loanerStep,
    [["代車"], [], [], ["ご用意"]]
  ),
  true,
  "『ご用意できるかと思います』を代車手配の承諾として認識できません"
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

matcherContext.state.inspectionLoanerRequested = false;
assert.equal(
  matcherContext.scriptedRequiredGroupsMatch(
    "代車をご用意します。",
    loanerStep,
    [["代車"], [], [], ["ご用意"]]
  ),
  false,
  "スタッフから先に案内する通常分岐の『早め・予約』条件を省略しています"
);

assert.equal(
  matcherContext.scriptedRequiredGroupsMatch(
    "代車をご準備させていただいております。",
    { key: "confirmed_waiting" },
    [[]]
  ),
  true,
  "スタッフが手配済みの代車を案内しても待ち方を確定できません"
);

const markerStart = appSource.indexOf("function markScriptedStepNotApplicable");
const markerEnd = appSource.indexOf("function scriptedStepMatches", markerStart);
assert.notEqual(markerStart, -1, "工程達成記録関数が見つかりません");
assert.notEqual(markerEnd, -1, "工程達成記録関数の終端が見つかりません");
const markerContext = { state: { analyses: [] } };
vm.createContext(markerContext);
vm.runInContext(appSource.slice(markerStart, markerEnd), markerContext);
markerContext.markScriptedStepPassed(
  { key: "confirmed_waiting", expected: "待ち方確認" },
  "代車利用確認済み"
);
assert.equal(markerContext.state.analyses[0].confirmed_waiting, true, "代車利用を待ち方確認済みにできません");
assert.equal(markerContext.state.analyses[0].blocked, false, "代車利用後の待ち方を聞き返し減点にしています");

assert.match(
  appSource,
  /role === "customer"[\s\S]*?inspectionLoanerRequested = true/,
  "お客様の代車希望を会話履歴から保持できません"
);
assert.match(
  appSource,
  /asksInspectionLoanerNeed\(text\)[\s\S]*?inspectionLoanerRequested = true[\s\S]*?markScriptedStepPassed\(waitingStep[\s\S]*?addMessage\("customer", "お願いします。"/,
  "代車利用の直接質問へ『お願いします。』と答えて希望を記憶する処理が見つかりません"
);
assert.match(
  appSource,
  /resolvedWaitingStep\?\.key === "confirmed_waiting"[\s\S]*?inspectionLoanerConfirmed[\s\S]*?markScriptedStepPassed[\s\S]*?state\.scriptStep \+= 1/,
  "代車手配後に店内待ち確認を繰り返さない処理が見つかりません"
);
assert.match(
  appSource,
  /step\.key === "explained_loaner"[\s\S]*?responseStep\.key === "confirmed_waiting"[\s\S]*?hasInspectionLoanerConfirmation\(combinedText\)[\s\S]*?text: "お願いします。"[\s\S]*?inspection_booking_invitation_accept_customer/,
  "代車手配の承諾へ『お願いします。』と回答する処理が見つかりません"
);
assert.match(
  appSource,
  /state\.inspectionLoanerConfirmed[\s\S]*?hasInspectionLoanerConfirmation\(text, true\)[\s\S]*?addMessage\("customer", "お願いします。"/,
  "確認済みの代車手配が繰り返された場合に『お願いします。』と回答できません"
);
assert.match(
  appSource,
  /state\.inspectionLoanerRequested \|\| state\.inspectionLoanerConfirmed[\s\S]*?hasInspectionLoanerConfirmation\(text, true\)[\s\S]*?state\.inspectionLoanerConfirmed = true[\s\S]*?addMessage\("customer", "お願いします。"/,
  "代車希望直後の手配承諾へ『お願いします。』と回答して確定状態を保持できません"
);
assert.match(
  scenarioSource,
  /key:\s*"explained_loaner"[\s\S]*?customerResponse:\s*"予約しようかな。"/,
  "代車手配を承諾した後の『予約しようかな。』が設定されていません"
);

console.log("代車手配承諾の重複質問防止テスト: OK");
