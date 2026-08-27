import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const recoverStart = source.indexOf("function recoverEarlierInspectionStep");
const recoverEnd = source.indexOf("function recordOptionalShortcutEvidence", recoverStart);
assert.notEqual(recoverStart, -1, "順序が前後した過去工程の回収処理が見つかりません");
assert.notEqual(recoverEnd, -1, "過去工程の回収処理の終端が見つかりません");

const recoveryContext = {
  scenario: {
    steps: [
      { key: "explained_duration_and_wait" },
      { key: "proposed_appointment" },
      { key: "explained_documents" },
      { key: "explained_lock_and_arrival" },
      { key: "confirmed_reminder_contact" },
      { key: "recapped_appointment" }
    ]
  },
  state: { analyses: [] },
  scriptedStepMatches(text, step) {
    return text.includes(step.key);
  }
};
recoveryContext.markScriptedStepPassed = (step, evidence) => {
  recoveryContext.state.analyses.push({
    stepKey: step.key,
    passed: true,
    evidence: [evidence]
  });
};
vm.createContext(recoveryContext);
vm.runInContext(
  `${source.slice(recoverStart, recoverEnd)}\nthis.recoverEarlierInspectionStep = recoverEarlierInspectionStep;`,
  recoveryContext
);

const recoveredDocuments = recoveryContext.recoverEarlierInspectionStep(
  "explained_documents",
  5
);
assert.equal(
  recoveredDocuments?.key,
  "explained_documents",
  "予約復唱工程まで進んだ後の必要書類案内を回収できません"
);
const recoveredReminder = recoveryContext.recoverEarlierInspectionStep(
  "confirmed_reminder_contact",
  5
);
assert.equal(
  recoveredReminder?.key,
  "confirmed_reminder_contact",
  "必要書類より先に案内された3日前連絡を後から回収できません"
);
assert.equal(
  recoveryContext.recoverEarlierInspectionStep("explained_documents", 5),
  null,
  "確認済みの必要書類案内へ再び戻っています"
);

const advanceStart = source.indexOf("function advancePastPassedScriptedSteps");
const advanceEnd = source.indexOf("function findFurthestMatchingOptionalStepIndex", advanceStart);
assert.notEqual(advanceStart, -1, "確認済み工程の通過処理が見つかりません");
assert.notEqual(advanceEnd, -1, "確認済み工程の通過処理の終端が見つかりません");

const delayedContext = {
  normalizeScriptedText: (text) => String(text || "").replace(/\s+/g, ""),
  scenario: {
    steps: [
      { key: "current", customerResponse: "現在の発話への返答" },
      { key: "documents", customerResponse: "はい。" },
      { key: "next", customerResponse: "次の返答" }
    ]
  },
  state: {
    scriptStep: 1,
    analyses: [
      { stepKey: "documents", passed: true, evidence: ["以前の必要書類案内"] }
    ]
  }
};
vm.createContext(delayedContext);
vm.runInContext(
  `${source.slice(advanceStart, advanceEnd)}\nthis.advancePastPassedScriptedSteps = advancePastPassedScriptedSteps;`,
  delayedContext
);
const currentResponse = delayedContext.advancePastPassedScriptedSteps(
  delayedContext.scenario.steps[0],
  { currentEvidence: "今回の予約日時案内" }
);
assert.equal(
  currentResponse.key,
  "current",
  "以前の必要書類への『はい。』が無関係な後のターンで遅れて発話されています"
);
assert.equal(delayedContext.state.scriptStep, 2, "確認済み工程を内部的に通過できません");

delayedContext.state.scriptStep = 1;
delayedContext.state.analyses = [
  { stepKey: "documents", passed: true, evidence: ["今回の必要書類案内"] }
];
const sameTurnResponse = delayedContext.advancePastPassedScriptedSteps(
  delayedContext.scenario.steps[0],
  { currentEvidence: "今回の必要書類案内" }
);
assert.equal(
  sameTurnResponse.key,
  "documents",
  "同じ発話内で案内された後工程への自然な返答を選べません"
);

assert.match(
  source,
  /recoveredCoreStepAfterAppointment[\s\S]*?\? "はい。"[\s\S]*?inspection_thanked_customer_retry/,
  "日時確定後に過去の基本工程へ戻る発話を一般的な相づちへ抑制できません"
);
assert.match(
  source,
  /currentEvidence:\s*text/,
  "現在のスタッフ発話を使って遅延返答を防ぐ呼び出しがありません"
);

console.log("車検誘致・発話順序入れ替え整合テスト: OK");
