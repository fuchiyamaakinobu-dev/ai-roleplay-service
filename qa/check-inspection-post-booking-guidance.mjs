import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const helperStart = appSource.indexOf("function hasInspectionDocumentGuidance");
const helperEnd = appSource.indexOf("function scriptedRequiredGroupsMatch", helperStart);
assert.notEqual(helperStart, -1, "持参品と3日前連絡先の補助判定がありません");
assert.notEqual(helperEnd, -1, "補助判定の終端がありません");

const context = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text)
};
vm.createContext(context);
vm.runInContext(appSource.slice(helperStart, helperEnd), context);

const splitDocumentGuidance = [
  "まず、車検証と自賠責証書、納税証明書をお持ちください。",
  "トランクや荷室は荷物を積まない状態でご来店ください。"
].join(" ");
assert.equal(
  context.hasInspectionDocumentGuidance(splitDocumentGuidance),
  true,
  "必要書類と空荷を分割した案内を合算できません"
);
assert.equal(
  context.hasInspectionDocumentGuidance("車検証、自賠責証書、納税証明書をお持ちください。"),
  false,
  "空荷案内なしで持参品項目を達成しています"
);

for (const phrase of [
  "入庫日の3日前に確認のお電話をしますが、この連絡先でよろしいでしょうか？",
  "3日前に再確認の連絡をしますが、今の電話でよろしいですか？",
  "3日前にご連絡しますが、この携帯で大丈夫でしょうか？"
]) {
  assert.equal(
    context.hasInspectionReminderContactConfirmation(phrase),
    true,
    `3日前の連絡先確認として認識できません: ${phrase}`
  );
}
assert.equal(
  context.hasInspectionReminderContactConfirmation("3日前に確認の電話をします。"),
  false,
  "連絡先を確認していない発話を達成扱いにしています"
);

assert.match(appSource, /やるしす\|ヤルシス/);
assert.match(
  appSource,
  /metric\.key === "explained_duration_and_wait" && !state\.inspectionMileageAsked/
);
assert.match(
  appSource,
  /optionalAfterAppointmentKeys[\s\S]*?!optionalAfterAppointmentKeys\.has\(analysis\.stepKey\)/,
  "入庫日時確定後の任意項目を聞き返し減点から除外していません"
);

console.log("車検誘致・予約後の分割案内と連絡先確認テスト: OK");
