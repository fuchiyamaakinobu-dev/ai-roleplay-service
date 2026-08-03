import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function normalizeScriptedText");
const helperEnd = appSource.indexOf("function analyzeScriptedStaff", helperStart);
assert.notEqual(helperStart, -1, "車検誘致用の数字正規化関数が見つかりません");
assert.notEqual(helperEnd, -1, "作業時間判定関数の終端が見つかりません");

const context = { state: { inspectionMileageAsked: true } };
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

for (const phrase of [
  "60分です",
  "75分を予定しています",
  "90分程度です",
  "1時間です",
  "1時間15分です",
  "1時間30分です",
  "１時間３０分です",
  "一時間半です"
]) {
  assert.equal(context.hasSupportedInspectionDuration(phrase), true, `${phrase}を有効時間として認識できません`);
}

for (const phrase of ["45分です", "2時間です", "1時間45分です"]) {
  assert.equal(context.hasSupportedInspectionDuration(phrase), false, `${phrase}を有効時間として誤認識しています`);
}

const publishedLegacyDurationStep = {
  key: "explained_duration_and_wait",
  requiredGroups: [["1時間", "一時間", "60分"], ["待", "店内"]]
};
function requiredGroupsMatch(text, step) {
  const normalized = context.normalizeScriptedText(text);
  const matchedGroups = step.requiredGroups.map((group) =>
    group.filter((word) => normalized.includes(word))
  );
  return context.scriptedRequiredGroupsMatch(normalized, step, matchedGroups);
}

const durationTalk = "作業時間は基本作業ですと90分程度となります。";
const waitingTalk = "お店でお待ちいただくこともできます。";
assert.equal(
  requiredGroupsMatch(durationTalk, publishedLegacyDurationStep),
  false,
  "90分だけで店内待ちまで達成扱いにしています"
);
assert.equal(
  requiredGroupsMatch(waitingTalk, publishedLegacyDurationStep),
  false,
  "店内待ちだけで作業時間まで達成扱いにしています"
);
assert.equal(
  requiredGroupsMatch(`${durationTalk} ${waitingTalk}`, publishedLegacyDurationStep),
  true,
  "公開データに旧キーワードが残る場合、90分と店内待ちを合算して認識できません"
);

assert.match(
  scenarioSource,
  /requiredGroups:\s*\[\["9月30日"\],\s*\["満了",\s*"車検"\]\]/,
  "車検満了日だけで達成する必須条件になっていません"
);
assert.doesNotMatch(
  scenarioSource,
  /requiredGroups:\s*\[\["9月30日"\],\s*\["8月1日"\]/,
  "入庫可能日が必須条件に残っています"
);
assert.match(
  scenarioSource,
  /key:\s*"explained_duration_and_wait"[\s\S]*?customerResponse:\s*"代車は貸してもらえますか？"/,
  "有効な作業時間の案内後に代車希望へ進めません"
);
assert.match(
  appSource,
  /inspectionAvailabilityFollowUpPending[\s\S]*?いつから車検を受けられるんですか？/,
  "満了日だけの案内後に入庫可能日の任意質問へ進めません"
);
assert.match(
  appSource,
  /if \(state\.inspectionAvailabilityFollowUpPending\)[\s\S]*?!hasSupportedInspectionDuration\(text\)[\s\S]*?どれくらい時間がかかるのですか？/,
  "任意質問への回答後に作業時間へ進めません"
);
assert.match(
  appSource,
  /step\.key === "explained_duration_and_wait"[\s\S]*?state\.inspectionMileageAsked[\s\S]*?hasSupportedInspectionDuration\(normalized\)[\s\S]*?hasWaiting/,
  "Firestore公開データより確定済み作業時間判定を優先できません"
);
assert.match(
  audioDbSource,
  /inspection_available_from_optional_question",\s*"入庫可能日・任意質問",\s*"いつから車検を受けられるんですか？"/,
  "任意質問の表示文と音声登録文が一致していません"
);
assert.match(
  scenarioSource,
  /retryResponse:\s*"車検はいつまでですか？"/,
  "満了日不足時の初回質問が自然な表現になっていません"
);
assert.match(
  appSource,
  /alternatives:\s*\[[\s\S]*?車検はいつまでですか？[\s\S]*?いつまでに受けなきゃダメですか？/,
  "満了日不足時の質問を自然な別表現へ切り替えられません"
);
assert.doesNotMatch(
  scenarioSource + audioDbSource,
  /車検の満了日はいつですか？/,
  "お客様発話に社内用語の『満了日』が残っています"
);
assert.match(
  audioDbSource,
  /inspection_expiry_deadline_retry",\s*"車検期限・聞き返し（言い換え）",\s*"いつまでに受けなきゃダメですか？"\]/,
  "言い換え質問の表示文と音声登録文が一致していません"
);
assert.doesNotMatch(
  audioDbSource,
  /inspection_(?:explained_available_period_retry|expiry_deadline_retry)"[^\]]*"pending"/,
  "提供済みの車検期限音声が準備待ちのままです"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_explained_available_period_retry.mp3", import.meta.url)),
  true,
  "『車検はいつまでですか？』の音声ファイルがありません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_expiry_deadline_retry.mp3", import.meta.url)),
  true,
  "『いつまでに受けなきゃダメですか？』の音声ファイルがありません"
);

const questionStart = appSource.indexOf("function isScriptedQuestion");
const specificEnd = appSource.indexOf("function hasCourtesyExpression", questionStart);
assert.notEqual(questionStart, -1, "車検誘致の個別判定関数が見つかりません");
assert.notEqual(specificEnd, -1, "車検誘致の個別判定関数の終端が見つかりません");
context.scenario = { customerName: "佐藤様", expiryDate: "9月30日" };
vm.runInContext(appSource.slice(questionStart, specificEnd), context);

assert.equal(
  context.scriptedStepSpecificMatches(
    context.normalizeScriptedText("車検満了日は９月３０日です"),
    { key: "explained_available_period" }
  ),
  true,
  "満了日だけの案内を達成として認識できません"
);
assert.equal(
  context.scriptedStepSpecificMatches(
    context.normalizeScriptedText("8月1日以降に作業できます"),
    { key: "explained_available_period" }
  ),
  false,
  "入庫可能日だけの案内を満了日として誤認識しています"
);

console.log("車検満了日・作業時間判定テスト: OK");
