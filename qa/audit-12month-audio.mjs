import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const qaDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(qaDir, "..");

function loadWindowScript(fileName) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(rootDir, fileName), "utf8"), context);
  return context.window;
}

const scenario = loadWindowScript("scenario.js").ROLEPLAY_SCENARIO;
const audioDb = loadWindowScript("audio-db.js").ROLEPLAY_AUDIO_DB;
const audioById = new Map(audioDb.items.map((item) => [item.id, item]));
const rows = [];

function add(source, text, audioId, role = "お客様") {
  rows.push({ source, text, audioId, role });
}

add("開始", scenario.initialCustomerMessage, scenario.audio.initial);
add("追加整備", "オイル交換もお願いします。", scenario.audio.additionalServiceRequest);
add("追加整備再確認", "そのほかは大丈夫です。", scenario.audio.additionalServiceNone);
scenario.serviceTimeQuestions.forEach((text, index) =>
  add("作業時間", text, scenario.audio.serviceTimeQuestions[index])
);
scenario.pickupRequests.forEach((text, index) =>
  add("引取依頼", text, scenario.audio.pickupRequests[index])
);
Object.entries(scenario.objections).forEach(([key, objection]) => {
  objection.customer.forEach((text, index) =>
    add(`断り理由:${key}`, text, scenario.audio.objections[key][index])
  );
});
add("引取受諾", "はい、お願いします。", scenario.audio.acceptedPickup);
add("システム終了", "引取を検出しました。ロープレを終了します。", scenario.audio.pickupDetectedEnd, "システム");
add("聞き返し", "おっしゃっていることがよく分からないんですけど。", scenario.audio.needsMoreContext);

const possibleAgreementTexts = [
  "土日なら行けるかもしれません。",
  "その時間なら行けそうです。",
  "それなら店に行ってみます。"
];
possibleAgreementTexts.forEach((text, index) =>
  add("来店同意", text, scenario.audio.possibleAgreements[index])
);

const followUpTexts = [
  "では、いつなら空いていますか？",
  "今週だと空いている日はありますか？",
  "午前中と午後ならどちらが空いていますか？"
];
followUpTexts.forEach((text, index) => add("日時確認", text, scenario.audio.followUps[index]));
add("予約確定", "では、その日にお願いします。", scenario.audio.closings[0]);
add("時刻選択", "では、早いほうでお願いします。", scenario.audio.appointmentEarlierTime);
add("時刻選択", "では、遅い時間でお願いします。", scenario.audio.appointmentLaterTime);
add("時刻選択", "では、その時間でお願いします。", scenario.audio.appointmentSingleTime);
add("午前・日付確認", "午前中がいいです。今週だと何日が空いていますか？", scenario.audio.appointmentMorningNeedDate);
add("午前・時刻確認", "では、午前中でお願いします。何時が空いていますか？", scenario.audio.appointmentMorningNeedTime);

[
  ["午前・時刻再質問", "何時が空いていますか？", "appointmentMorningTimeRepeat"],
  ["午前・時刻再質問", "午前中の何時が空いていますか？", "appointmentMorningTimeSpecific"],
  ["午前・日付再質問", "午前中で空いている日はいつですか？", "appointmentMorningDateRepeat"],
  ["午前・日付再質問", "今週だと何日が空いていますか？", "appointmentMorningDateSpecific"],
  ["時刻再質問", "何時が空いていますか？", "appointmentTimeRepeat"],
  ["時刻再質問", "何時に行けばいいんですか？", "appointmentTimeSpecific"]
].forEach(([source, text, audioId]) => add(source, text, audioId));

add("説明食い違い解消", "分かりました。では、負担の少ない方法を相談させてください。", scenario.audio.misunderstandingClarified);
add("家族相談", "ありがとうございます。家族と相談して、改めてご連絡します。", scenario.audio.familyFollowUp);
add("近隣店・家族来店", "近い店舗や家族と一緒なら、来店できるかもしれません。", scenario.audio.nearbyOrFamilyAgreement);
add("会話継続", "ありがとうございます。続けてお願いします。", scenario.audio.continueGeneric);

function audioFilePath(item) {
  if (!item?.file) return "";
  const basePath = item.voice && audioDb.voices?.[item.voice]
    ? audioDb.voices[item.voice].basePath
    : audioDb.basePath;
  return path.join(rootDir, basePath, item.file);
}

const audited = rows.map((row) => {
  const item = audioById.get(row.audioId);
  const registered = Boolean(item);
  const ready = item?.status === "ready";
  const fileExists = ready && fs.existsSync(audioFilePath(item));
  const textMatches = registered && item.text === row.text;
  return { ...row, item, registered, ready, fileExists, textMatches };
});

const missing = audited.filter((row) => !row.registered || !row.ready || !row.fileExists);
const mismatches = audited.filter((row) => row.registered && !row.textMatches);

console.log(`12カ月点検の実行時発話候補: ${audited.length}件`);
console.log(`登録済み・MP3あり・文面一致: ${audited.filter((row) => row.registered && row.ready && row.fileExists && row.textMatches).length}件`);
console.log(`音声不足: ${missing.length}件`);
console.log(`文面不一致: ${mismatches.length}件`);

if (missing.length) {
  console.log("\n[MP3または登録が不足]");
  missing.forEach((row) => console.log(`${row.audioId}\t${row.text}`));
}

if (mismatches.length) {
  console.log("\n[表示文と音声登録文が不一致]");
  mismatches.forEach((row) =>
    console.log(`${row.audioId}\t表示: ${row.text}\t登録: ${row.item.text}`)
  );
}

if (process.argv.includes("--markdown")) {
  console.log("\n| No. | 工程 | 役割 | 音声ID | 表示文 | 登録 | MP3 | 文面一致 |");
  console.log("|---:|---|---|---|---|---|---|---|");
  audited.forEach((row, index) => {
    const escape = (value) => String(value ?? "").replaceAll("|", "\\|");
    console.log(`| ${index + 1} | ${escape(row.source)} | ${row.role} | \`${row.audioId}\` | ${escape(row.text)} | ${row.ready ? "済" : "未"} | ${row.fileExists ? "あり" : "なし"} | ${row.textMatches ? "一致" : "未確認"} |`);
  });
}

if (missing.length || mismatches.length) process.exitCode = 1;
