import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function nextQuestionVariant(");
const end = source.indexOf("function normalizeFullWidthDigits(", start);

assert.notEqual(start, -1, "質問の重複防止関数が見つかりません");
assert.notEqual(end, -1, "質問の重複防止関数を切り出せません");

const context = {
  state: { questionRepeats: {} },
  customerTurn(text, audioId) {
    return { text, audioId };
  }
};
vm.createContext(context);
vm.runInContext(`
  ${source.slice(start, end)}
  this.nextQuestionVariant = nextQuestionVariant;
  this.customerQuestionTurn = customerQuestionTurn;
`, context);

const variants = [
  { text: "最初の質問ですか？", audioId: "first" },
  { text: "別の言い方で確認しますか？", audioId: "second" },
  { text: "具体的に教えてください。", audioId: "third" }
];

const questions = [
  context.customerQuestionTurn("test-question", variants),
  context.customerQuestionTurn("test-question", variants),
  context.customerQuestionTurn("test-question", variants),
  context.customerQuestionTurn("test-question", variants)
];

assert.deepEqual(
  questions.map((question) => question.text),
  [
    "最初の質問ですか？",
    "別の言い方で確認しますか？",
    "具体的に教えてください。",
    "別の言い方で確認しますか？"
  ]
);
assert.notEqual(questions[0].text, questions[1].text, "同じ質問を連続して返しました");
assert.notEqual(questions[1].text, questions[2].text, "再確認の質問を言い換えられません");
assert.notEqual(questions[2].text, questions[3].text, "候補を使い切った後に同じ質問を連続して返しました");

const separateQuestion = context.customerQuestionTurn("another-question", variants);
assert.equal(separateQuestion.text, "最初の質問ですか？", "質問目的ごとの履歴を分離できません");

console.log("お客様質問の重複防止テスト: OK");
