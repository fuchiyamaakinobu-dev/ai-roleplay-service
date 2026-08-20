import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

const preferenceStart = appSource.indexOf("function asksInspectionDayPreference");
const preferenceEnd = appSource.indexOf("function scriptedRetryForMissingDetails", preferenceStart);
assert.notEqual(preferenceStart, -1, "曜日希望質問の判定関数が見つかりません");
assert.notEqual(preferenceEnd, -1, "曜日希望質問の判定関数の終端が見つかりません");

const preferenceContext = {
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|ませんか|ございませんか|[?？])/.test(text)
};
vm.createContext(preferenceContext);
vm.runInContext(appSource.slice(preferenceStart, preferenceEnd), preferenceContext);

for (const phrase of [
  "平日と週末ですと、どちらがよろしいでしょうか。",
  "土日と平日ならどちらがご希望ですか？",
  "曜日のご都合はいかがですか？",
  "来週の火曜日ではいかがでしょうか？"
]) {
  assert.equal(
    preferenceContext.asksInspectionDayPreference(phrase),
    true,
    `${phrase}を曜日希望の質問として認識できません`
  );
}

const storedExpiryStart = appSource.indexOf("function shouldAnswerDayPreferenceFromStoredExpiry");
const storedExpiryEnd = appSource.indexOf("function scriptedRetryForMissingDetails", storedExpiryStart);
assert.notEqual(storedExpiryStart, -1, "満了日案内済みの曜日回答判定が見つかりません");
assert.notEqual(storedExpiryEnd, -1, "満了日案内済みの曜日回答判定の終端が見つかりません");
const storedExpiryContext = {
  state: { inspectionExpiryEvidence: "ヤリスの車検は9月30日までです" },
  normalizeScriptedText: (text) => String(text).replace(/\s+/g, ""),
  asksInspectionDayPreference: preferenceContext.asksInspectionDayPreference
};
vm.createContext(storedExpiryContext);
vm.runInContext(appSource.slice(storedExpiryStart, storedExpiryEnd), storedExpiryContext);
assert.equal(
  storedExpiryContext.shouldAnswerDayPreferenceFromStoredExpiry(
    "平日と土日どちらがよろしいでしょうか？",
    { key: "explained_available_period" }
  ),
  true,
  "前の発話で満了日を案内済みでも、曜日だけを回答する判定になりません"
);
storedExpiryContext.state.inspectionExpiryEvidence = "";
assert.equal(
  storedExpiryContext.shouldAnswerDayPreferenceFromStoredExpiry(
    "平日と土日どちらがよろしいでしょうか？",
    { key: "explained_available_period" }
  ),
  false,
  "満了日未案内なのに、期限を確認せず曜日だけ回答しています"
);

for (const phrase of [
  "平日と週末があります。",
  "車検はいつまでですか？",
  "9月30日が満了日です。"
]) {
  assert.equal(
    preferenceContext.asksInspectionDayPreference(phrase),
    false,
    `${phrase}を曜日希望の質問として誤認識しています`
  );
}

assert.match(
  appSource,
  /asksInspectionDayPreference\(normalized\)[\s\S]*?土日がいいです。ちなみに、車検はいつまでですか？[\s\S]*?inspection_day_preference_and_expiry_question/,
  "曜日希望へ答えながら車検期限を確認する分岐がありません"
);
assert.match(
  appSource,
  /inspectionExpiryEvidence[\s\S]*?step\.key === "explained_available_period"[\s\S]*?answeredDayPreferenceAfterExpiry[\s\S]*?土日がいいです。[\s\S]*?inspection_day_preference_answer/,
  "以前の発話で満了日を案内済みの場合に、期限を聞き直さず曜日だけ回答できません"
);
assert.match(
  audioDbSource,
  /inspection_day_preference_answer",\s*"満了日案内済み・曜日希望回答",\s*"土日がいいです。"\s*\]/,
  "満了日案内済みの曜日回答音声が再生可能として登録されていません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_day_preference_answer.mp3", import.meta.url)),
  true,
  "満了日案内済みの曜日回答MP3がありません"
);
assert.match(
  appSource,
  /週末のほうが都合がいいです。それと、車検はいつまでに受ければよいですか？[\s\S]*?inspection_weekend_preference_and_expiry_question/,
  "自然な週末希望の言い換え候補がありません"
);
assert.match(
  audioDbSource,
  /inspection_weekend_preference_and_expiry_question",\s*"週末希望回答・車検期限確認",\s*"週末のほうが都合がいいです。それと、車検はいつまでに受ければよいですか？"\s*\]/,
  "週末希望の言い換え音声が再生可能として登録されていません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_weekend_preference_and_expiry_question.mp3", import.meta.url)),
  true,
  "週末希望の言い換えMP3がありません"
);
assert.match(
  audioDbSource,
  /inspection_day_preference_and_expiry_question",\s*"曜日希望回答・車検期限確認",\s*"土日がいいです。ちなみに、車検はいつまでですか？"\]/,
  "曜日希望回答・車検期限確認の音声が再生可能として登録されていません"
);
assert.equal(
  fs.existsSync(new URL("../audio-ondoku/inspection_day_preference_and_expiry_question.mp3", import.meta.url)),
  true,
  "曜日希望回答・車検期限確認のMP3がありません"
);

console.log("車検誘致・曜日希望質問への返答テスト: OK");
