import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const helperStart = appSource.indexOf("function normalizeScriptedText");
const helperEnd = appSource.indexOf("function hasSupportedInspectionDuration", helperStart);
assert.notEqual(helperStart, -1, "判定用の音声認識正規化関数が見つかりません");
assert.notEqual(helperEnd, -1, "判定用の音声認識正規化関数の終端が見つかりません");

const context = {};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

const cases = [
  ["さとうさまでしょうか", "佐藤さまでしょうか"],
  ["とよたもびりてぃおびひろのふちやまともうします", "トヨタモビリティ帯広の渕山ともうします"],
  ["やりすのしゃけんがくがつさんじゅうにちまでです", "ヤリスの車検が9月30日までです"],
  ["ごりよういただきかんしゃしております", "ご利用いただき感謝しております"],
  ["ごつごうやよていはいかがでしょうか", "ご都合や予定はいかがでしょうか"],
  ["そうこうきょりはなんきろですか", "走行距離は何キロですか"],
  ["いちじかんじゅうごふんでてんないでおまちいただけます", "1時間15分で店内でおまちいただけます"],
  ["だいしゃをはやめによやくいただければよういできます", "代車を早めに予約いただければ用意できます"],
  ["きになるところやちょうしのわるいところはございませんか", "気になるところや調子のわるいところはございませんか"],
  ["にもつとのうぜいしょうめいしょ、しゃけんしょう、じばいせきをごじゅんびください", "荷物と納税証明書、車検証、自賠責をご準備ください"],
  ["ろっくなっときーをもち、じゅうごふんまえにきてください", "ロックナットキーをもち、15分前にきてください"],
  ["さんにちまえにれんらくします。けいたいでよろしいですか", "3日前に連絡します。携帯でよろしいですか"],
  ["はちがつついたちのじゅうじ", "8月1日の10時"],
  ["9月の一日はいかがでしょうか", "9月1日はいかがでしょうか"],
  ["てんけんいがいのごようめいやきになるところはありませんか", "点検いがいのご用命や気になるところはありませんか"],
  ["しごとでらいてんがむずかしいのですね", "仕事で来店がむずかしいのですね"],
  ["どにちかちかくのおみせはいかがでしょうか", "土日か近くのお店はいかがでしょうか"]
];

for (const [spoken, expected] of cases) {
  assert.equal(
    context.normalizeScriptedText(spoken),
    expected,
    `${spoken} のひらがな表記を判定用に補正できません`
  );
}

assert.equal(
  context.normalizeScriptedText("ごじつれんらくします"),
  "ごじつ連絡します",
  "『ごじつ』を5時として誤補正しています"
);
assert.equal(
  context.normalizeScriptedText("作業に一日かかります"),
  "作業に一日かかります",
  "作業期間の『一日』を予約日の1日に誤補正しています"
);
assert.match(
  appSource,
  /function analyzeStaff\(text\)\s*\{[\s\S]*?const normalized = normalizeScriptedText\(text\);/,
  "12カ月点検のスタッフ発話判定にひらがな補正が適用されていません"
);
assert.match(
  appSource,
  /const text = normalizeLoanerHomophone\(els\.staffInput\.value\.trim\(\)\);/,
  "会話表示・保存ログまで判定用の漢字表記へ置換しないでください"
);

console.log("音声認識・ひらがな表記補正テスト: OK");
