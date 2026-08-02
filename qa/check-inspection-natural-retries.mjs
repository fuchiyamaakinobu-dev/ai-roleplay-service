import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.doesNotMatch(
  source,
  /必要な内容がまだ確認できていません|確認に必要な情報を、具体的にご案内いただけますか/,
  "評価者視点の文章がAIお客様の発話に残っています"
);
assert.match(
  source,
  /警告：案内が不足しています。現在の確認項目:/,
  "案内不足が会話欄外の警告に表示されません"
);
assert.match(
  source,
  /naturalScriptedRetryVariants\(retry, step\)/,
  "自然な聞き返し候補が会話処理で使用されていません"
);

const start = source.indexOf("function naturalScriptedRetryVariants");
const end = source.indexOf("function isPhoneGreetingOnly", start);
assert.notEqual(start, -1, "自然な聞き返し候補の生成関数が見つかりません");
assert.notEqual(end, -1, "聞き返し候補生成関数の終端が見つかりません");

const context = {};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const durationVariants = context.naturalScriptedRetryVariants(
  {
    text: "どれくらい時間がかかるのですか？",
    audioId: "inspection_explained_duration_and_wait_retry"
  },
  { key: "explained_duration_and_wait" }
);
assert.equal(durationVariants.length, 3, "聞き返し候補が3種類ありません");
assert.equal(new Set(durationVariants.map((item) => item.text)).size, 3, "聞き返しが重複しています");
assert.equal(durationVariants[0].text, "どれくらい時間がかかるのですか？");
assert.match(durationVariants[1].text, /どれくらい時間がかかるのですか？/);
assert.match(durationVariants[2].text, /どれくらい時間がかかるのですか？/);

const expiryVariants = context.naturalScriptedRetryVariants(
  {
    text: "車検はいつまでですか？",
    audioId: "inspection_explained_available_period_retry",
    alternatives: [
      { text: "車検はいつまでですか？", audioId: "inspection_explained_available_period_retry" },
      { text: "いつまでに受けなきゃダメですか？", audioId: "inspection_expiry_deadline_retry" }
    ]
  },
  { key: "explained_available_period" }
);
assert.equal(expiryVariants.length, 3, "満了日の聞き返し候補が3種類ありません");
assert.equal(new Set(expiryVariants.map((item) => item.text)).size, 3, "満了日の聞き返しが重複しています");

console.log("車検誘致・自然な聞き返し表現テスト: OK");
