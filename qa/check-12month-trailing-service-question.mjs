import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function hasTrailingServiceInquiry(");
const end = source.indexOf("function analyzeStaff(", start);

assert.notEqual(start, -1, "語尾省略の追加整備確認判定が見つかりません");
assert.notEqual(end, -1, "語尾省略判定を切り出せません");
assert.match(source.slice(end, end + 500), /hasTrailingServiceInquiry\(normalized\)/);
const sentenceCompletionStart = source.indexOf("function looksLikeCompleteJapaneseSentence(");
const sentenceCompletionEnd = source.indexOf("function startRoleplay(", sentenceCompletionStart);
assert.notEqual(sentenceCompletionStart, -1, "文章完結判定が見つかりません");
assert.match(
  source.slice(sentenceCompletionStart, sentenceCompletionEnd),
  /hasTrailingServiceInquiry\(normalized\)/,
  "語尾省略の質問を音声認識の完結発話として扱っていません"
);

const sentenceContext = {
  hasTrailingServiceInquiry: () => false
};
vm.createContext(sentenceContext);
vm.runInContext(
  source.slice(sentenceCompletionStart, sentenceCompletionEnd),
  sentenceContext
);
for (const phrase of [
  "ええと。それから。",
  "それから。",
  "それと、",
  "そして。",
  "続いて。",
  "えっと。"
]) {
  assert.equal(
    sentenceContext.looksLikeCompleteJapaneseSentence(phrase),
    false,
    `接続語で終わる途中発話を完成文として自動送信しています: ${phrase}`
  );
}
for (const phrase of [
  "それから3日前に確認のお電話をいたします。",
  "続いて必要書類をご案内します。"
]) {
  assert.equal(
    sentenceContext.looksLikeCompleteJapaneseSentence(phrase),
    true,
    `接続語の後まで話した完成文を未完了扱いにしています: ${phrase}`
  );
}

const context = {};
vm.createContext(context);
vm.runInContext(`
  ${source.slice(start, end)}
  this.hasTrailingServiceInquiry = hasTrailingServiceInquiry;
`, context);

assert.equal(context.hasTrailingServiceInquiry("基本作業は1時間ですが、気になる所、調子の悪い、オイル交換は"), true);
assert.equal(context.hasTrailingServiceInquiry("何か気になるところは"), true);
assert.equal(context.hasTrailingServiceInquiry("調子の悪い所は"), true);
assert.equal(context.hasTrailingServiceInquiry("オイル交換などは"), true);
assert.equal(context.hasTrailingServiceInquiry("オイル交換とかは"), true);
assert.equal(context.hasTrailingServiceInquiry("気になる点は。"), true);
assert.equal(context.hasTrailingServiceInquiry("気になる点など"), true);
assert.equal(context.hasTrailingServiceInquiry("オイル交換とか。"), true);
assert.equal(context.hasTrailingServiceInquiry("オイル交換を実施します"), false);
assert.equal(context.hasTrailingServiceInquiry("気になる所を確認しました"), false);

console.log("12カ月点検・語尾省略の追加整備確認テスト: OK");
