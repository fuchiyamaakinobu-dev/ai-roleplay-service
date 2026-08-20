import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioDbSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");

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
assert.equal(durationVariants.length, 1, "未登録の自動生成音声が候補へ残っています");
assert.equal(durationVariants[0].text, "どれくらい時間がかかるのですか？");
assert.equal(durationVariants[0].audioId, "inspection_explained_duration_and_wait_retry");

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
assert.equal(expiryVariants.length, 2, "登録済みの満了日音声以外が候補へ混入しています");
assert.equal(expiryVariants.every((item) => Boolean(item.audioId)), true, "音声IDのない聞き返し候補があります");

const bookingRetryVariants = context.naturalScriptedRetryVariants(
  {
    text: "今、このまま予約できますか？",
    audioId: "inspection_confirmed_booking_time_retry"
  },
  { key: "confirmed_booking_time" }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(bookingRetryVariants)),
  [{ text: "今、このまま予約できますか？", audioId: "inspection_confirmed_booking_time_retry" }],
  "予約確認の聞き返しにブラウザー標準音声の自動生成文が残っています"
);

const missingAppointmentAudio = [
  {
    id: "inspection_missing_appointment_repeat",
    text: "入庫する日と時間を教えてください。"
  },
  {
    id: "inspection_missing_appointment_specific",
    text: "何月何日の何時に行けばよいですか？"
  }
];

for (const { id, text } of missingAppointmentAudio) {
  assert.match(source, new RegExp(`audioId: "${id}"`), `${id} が会話処理で使用されていません`);
  assert.match(
    audioDbSource,
    new RegExp(`\\["${id}",\\s*"[^"]+",\\s*"${text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"\\]`),
    `${id} の表示文と音声登録文が一致していません`
  );
  const audioPath = new URL(`../audio-ondoku/${id}.mp3`, import.meta.url);
  assert.equal(fs.existsSync(audioPath), true, `${id} のまことMP3がありません`);
  assert.ok(fs.statSync(audioPath).size > 1000, `${id} のまことMP3が空または破損しています`);
}

console.log("車検誘致・登録済みまこと音声限定テスト: OK");
