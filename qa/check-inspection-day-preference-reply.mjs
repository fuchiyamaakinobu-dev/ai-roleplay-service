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
  "曜日のご都合はいかがですか？"
]) {
  assert.equal(
    preferenceContext.asksInspectionDayPreference(phrase),
    true,
    `${phrase}を曜日希望の質問として認識できません`
  );
}

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
