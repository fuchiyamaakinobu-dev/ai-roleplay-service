import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const index = fs.readFileSync(new URL("index.html", root), "utf8");
const html = fs.readFileSync(new URL("judgement-glossary.html", root), "utf8");
const source = fs.readFileSync(new URL("judgement-glossary.js", root), "utf8");
const css = fs.readFileSync(new URL("judgement-glossary.css", root), "utf8");
const scenarioSource = fs.readFileSync(new URL("scenario.js", root), "utf8");

assert.match(index, /href="\.\/judgement-glossary\.html"/, "ロープレ画面に判定単語帳へのリンクがありません");
assert.match(html, /id="glossarySearch"/, "単語帳の検索欄がありません");
assert.match(html, /data-filter="score"/, "採点項目の絞り込みがありません");
assert.match(html, /data-filter="alias"/, "音声認識補正の絞り込みがありません");
assert.match(html, /単語1つだけでは達成になりません/, "複数条件を必要とする注意書きがありません");
assert.match(html, /judgement-glossary\.js\?v=20260829-3/, "公開後に古い判定単語帳がキャッシュされる可能性があります");
assert.match(css, /\.card-grid/, "単語帳カードの表示スタイルがありません");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(scenarioSource, context);
const scoring = context.window.VEHICLE_INSPECTION_SCENARIO.scoring;
assert.equal(scoring.length, 17, "車検誘致の採点項目が17項目ではありません");
assert.equal(scoring.reduce((sum, metric) => sum + metric.points, 0), 100, "車検誘致の配点合計が100点ではありません");

scoring.forEach((metric) => {
  assert.match(source, new RegExp(`\\b${metric.key}\\s*:`), `単語帳に${metric.key}がありません`);
});

assert.match(source, /質問・確認の形が必要/, "質問形が必要な項目の説明がありません");
assert.match(source, /直前にお客様が代車を希望した場合だけ有効/, "代車の文脈条件が説明されていません");
assert.match(source, /別々の発話でも会話全体で合算/, "順不同・分割発話の説明がありません");
assert.match(source, /ありがとうございます（現在形）と区別/, "終話のお礼の現在形・過去形が区別されていません");
assert.match(source, /ヤルシス → ヤリス/, "既知の車種誤変換が単語帳にありません");
assert.match(source, /代償 → 代車/, "既知の代車誤変換が単語帳にありません");
assert.match(source, /○○と申します/, "担当者名を集約した『○○と申します』が単語帳にありません");
assert.match(source, /○○でございます/, "『○○でございます』が単語帳にありません");
assert.match(source, /○○と言います/, "『○○と言います』が単語帳にありません");
assert.match(source, /トヨタモビリティ帯広本別店/, "支店名を含む正式な店舗名の例が単語帳にありません");
assert.match(source, /くがつの30日 → 9月30日/, "月だけがひらがなの混在日付補正が単語帳にありません");
assert.match(source, /別々の発話でも会話全体で合算/, "3日前連絡と連絡先確認の分割判定が単語帳にありません");
assert.doesNotMatch(source, /渕山と申します|後藤ともうします/, "単語帳の担当者名が特定の個人名へ固定されています");

console.log("車検誘致・判定単語帳テスト: OK");
