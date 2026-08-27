import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

assert.match(html, /id="customerSpeechPanel"[\s\S]*?id="requiredCustomerSpeech"[\s\S]*?id="confirmedCustomerSpeech"/);
assert.doesNotMatch(html, /id="inspectionTestResponse"/);
assert.match(html, /スタッフ発話の代わりにボタンを押すと、対応するAIお客様音声が再生されます/);
assert.match(styles, /\.customer-speech-panel\s*\{/);
assert.match(styles, /\.inspection-checkpoint-list\s*\{[^}]*max-height:\s*150px;[^}]*overflow:\s*auto;/s);
assert.match(styles, /\.customer-speech-panel\[hidden\]/);

const audioContext = { window: {} };
vm.createContext(audioContext);
vm.runInContext(audioSource, audioContext);
const audioItems = new Map(audioContext.window.ROLEPLAY_AUDIO_DB.items.map((item) => [item.id, item]));
const buttonReplies = [...appSource.matchAll(/responseText:\s*"([^"]+)",[\s\S]{0,220}?audioId:\s*"([^"]+)"/g)];
assert.equal(buttonReplies.length, 19, "19項目すべてにAI返答音声が登録されていません");
buttonReplies.forEach(([, text, audioId]) => {
  const audioItem = audioItems.get(audioId);
  assert.ok(audioItem, `ボタン返答の音声IDが未登録です: ${audioId}`);
  assert.equal(audioItem.status, "ready", `ボタン返答の音声がreadyではありません: ${audioId}`);
  assert.equal(audioItem.text, text, `ボタン返答と音声登録文が不一致です: ${audioId}`);
});

const renderStart = appSource.indexOf("function renderCustomerSpeechIndicator");
const renderEnd = appSource.indexOf("function renderProgress", renderStart);
assert.notEqual(renderStart, -1, "お客様発話チェックの描画関数が見つかりません");
assert.notEqual(renderEnd, -1, "お客様発話チェックの描画関数の終端が見つかりません");

const els = {
  customerSpeechPanel: { hidden: true },
  customerSpeechSummary: { textContent: "" },
  requiredCustomerSpeech: { innerHTML: "" },
  speechNote: { textContent: "" },
  audioEnabled: { checked: true },
  confirmedCustomerSpeech: { innerHTML: "", scrollTop: 0, scrollHeight: 80 }
};
const scenario = {
  id: "vehicle-inspection-phone-followup",
  steps: [
    "confirmed_identity", "introduced_self", "thanked_customer",
    "explained_inspection_notice", "asked_availability", "explained_available_period",
    "explained_duration_and_wait", "explained_loaner", "confirmed_booking_time",
    "proposed_appointment", "confirmed_waiting", "asked_vehicle_concerns",
    "explained_documents", "explained_lock_and_arrival", "confirmed_reminder_contact",
    "recapped_appointment", "closed_politely"
  ].map((key) => ({ key, state: key }))
};
const state = {
  started: true,
  ended: false,
  scriptStep: 1,
  analyses: [],
  inspectionMileageAsked: false,
  inspectionButtonChecks: {},
  customerReplyPending: false,
  transcript: [
    { role: "customer", text: "はい、もしもし。" },
    { role: "staff", text: "佐藤様でしょうか？" },
    { role: "customer", text: "そうです。" }
  ]
};
const addedMessages = [];
let finished = false;
const context = {
  els,
  scenario,
  state,
  escapeHtml: (text) => String(text),
  normalizeScriptedText: (text) => String(text).replace(/\s+/g, ""),
  isScriptedQuestion: (text) => /(?:でしょうか|ますか|ですか|[?？])/.test(text),
  asksInspectionAdditionalServiceFollowUp: (text) => /(?:追加|ほか|その他).*(?:作業|整備|オイル交換)/.test(text),
  asksInspectionWaitingMethodConfirmation: (text) => /待.*(?:ますか|でしょうか)/.test(text),
  hasSupportedInspectionDuration: (text) => /(?:60|75|90)分/.test(text),
  stopSpeechInput() {},
  stopCustomerPlayback() {},
  addMessage(role, text, options = {}) {
    const message = { role, text, ...options };
    state.transcript.push(message);
    addedMessages.push(message);
    if (typeof options.onCommitted === "function") options.onCommitted();
  },
  markScriptedStepPassed(step, evidence) {
    if (!state.analyses.some((analysis) => analysis.stepKey === step.key && analysis.passed)) {
      state.analyses.push({ stepKey: step.key, passed: true, evidence: [evidence] });
    }
  },
  finishRoleplay() { finished = true; },
  renderProgress() {}
};
vm.createContext(context);
vm.runInContext(appSource.slice(renderStart, renderEnd), context);

context.renderCustomerSpeechIndicator(true);
assert.equal(els.customerSpeechPanel.hidden, false, "車検誘致で進行チェックポイントが表示されません");
assert.equal(els.customerSpeechSummary.textContent, "完了 1／19");
assert.match(els.requiredCustomerSpeech.innerHTML, /開始挨拶/);
assert.match(els.requiredCustomerSpeech.innerHTML, /開始挨拶: 確認済み/);
assert.match(els.requiredCustomerSpeech.innerHTML, /is-done/);
assert.match(els.requiredCustomerSpeech.innerHTML, /店舗・担当者名/);
assert.match(els.requiredCustomerSpeech.innerHTML, /data-inspection-button-key="identity"/);
assert.match(els.requiredCustomerSpeech.innerHTML, /data-inspection-staff-text="佐藤様でしょうか。"/);
assert.match(els.requiredCustomerSpeech.innerHTML, /data-inspection-audio-id="inspection_confirmed_identity_customer"/);
assert.match(els.requiredCustomerSpeech.innerHTML, /<button class="inspection-checkpoint/);
assert.equal(els.confirmedCustomerSpeech.innerHTML, "");

state.scriptStep = 0;
state.analyses = [
  { stepKey: "confirmed_identity", passed: true },
  { stepKey: "introduced_self", passed: true }
];
context.renderCustomerSpeechIndicator(true);
assert.equal(els.customerSpeechSummary.textContent, "完了 3／19");
assert.match(els.requiredCustomerSpeech.innerHTML, /本人確認: 確認済み/);
assert.match(els.requiredCustomerSpeech.innerHTML, /店舗・担当者名: 確認済み/);

state.inspectionMileageAsked = true;
state.transcript.push({
  role: "staff",
  text: "現在の走行距離は何キロですか。基本作業は90分です。気になる点やオイル交換はありますか。"
});
context.renderCustomerSpeechIndicator(true);
assert.match(els.requiredCustomerSpeech.innerHTML, /調子確認: 確認済み/);
assert.match(els.requiredCustomerSpeech.innerHTML, /追加作業確認: 確認済み/);
assert.match(els.requiredCustomerSpeech.innerHTML, /走行距離確認: 確認済み/);
assert.match(els.requiredCustomerSpeech.innerHTML, /作業時間案内: 確認済み/);

const decodeAttribute = (value) => value
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">");
const renderedButtons = [...els.requiredCustomerSpeech.innerHTML.matchAll(
  /<button[\s\S]*?data-inspection-button-key="([^"]+)"[\s\S]*?data-inspection-staff-text="([^"]+)"[\s\S]*?data-inspection-response="([^"]+)"[\s\S]*?data-inspection-audio-id="([^"]+)"[\s\S]*?<\/button>/g
)].map((match) => ({
  inspectionButtonKey: decodeAttribute(match[1]),
  inspectionStaffText: decodeAttribute(match[2]),
  inspectionResponse: decodeAttribute(match[3]),
  inspectionAudioId: decodeAttribute(match[4])
}));
assert.equal(renderedButtons.length, 19);

state.scriptStep = 0;
state.analyses = [];
state.transcript = [{ role: "customer", text: "はい、もしもし。" }];
state.inspectionMileageAsked = false;
state.inspectionButtonChecks = {};
renderedButtons.forEach((dataset) => {
  context.handleInspectionCheckpointTest({
    target: { closest: () => ({ dataset }) }
  });
});
const passedKeys = new Set(state.analyses.filter((analysis) => analysis.passed).map((analysis) => analysis.stepKey));
scenario.steps.forEach((step) => {
  assert.ok(passedKeys.has(step.key), `ボタン進行で未達の工程があります: ${step.key}`);
});
assert.equal(JSON.stringify(state.proposedAppointment), JSON.stringify({ month: 8, day: 30, hour: 10 }));
assert.equal(finished, true, "終了挨拶ボタンで採点終了へ進みません");
assert.equal(addedMessages.filter((message) => message.role === "staff").length, 19);
assert.ok(
  addedMessages.filter((message) => message.role === "staff").every((message) => message.hiddenFromConversation),
  "ボタンに対応する内部スタッフセリフが会話画面へ表示されます"
);
assert.equal(addedMessages.filter((message) => message.role === "customer").length, 19);
assert.ok(
  addedMessages.filter((message) => message.role === "customer").every((message) => message.audioId),
  "ボタンに対応するAIお客様MP3が指定されていません"
);
assert.match(els.speechNote.textContent, /ボタンをスタッフ発話として反映しました/);
assert.match(appSource, /filter\(\(\{ message \}\) => !message\.hiddenFromConversation\)/);

context.renderCustomerSpeechIndicator(false);
assert.equal(els.customerSpeechPanel.hidden, true, "進行チェックOFFで発話チェックが非表示になりません");

scenario.id = "service-visit-promotion";
context.renderCustomerSpeechIndicator(true);
assert.equal(els.customerSpeechPanel.hidden, true, "12カ月点検に車検用発話チェックを表示しています");

console.log("車検誘致・進行チェックポイント表示テスト: OK");
