import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

assert.match(html, /id="customerSpeechPanel"[\s\S]*?id="requiredCustomerSpeech"[\s\S]*?id="confirmedCustomerSpeech"/);
assert.match(html, /id="inspectionTestResponse"/);
assert.match(html, /ロープレ開始後、ボタンを押すと対応するAIお客様の返答を試聴できます（採点対象外）/);
assert.match(styles, /\.customer-speech-panel\s*\{/);
assert.match(styles, /\.inspection-checkpoint-list\s*\{[^}]*max-height:\s*150px;[^}]*overflow:\s*auto;/s);
assert.match(styles, /\.customer-speech-panel\[hidden\]/);

const audioContext = { window: {} };
vm.createContext(audioContext);
vm.runInContext(audioSource, audioContext);
const audioItems = new Map(audioContext.window.ROLEPLAY_AUDIO_DB.items.map((item) => [item.id, item]));
const testReplies = [...appSource.matchAll(/testText:\s*"([^"]+)",[\s\S]{0,120}?testAudioId:\s*"([^"]+)"/g)];
assert.equal(testReplies.length, 19, "19項目すべてに模擬AI返答が登録されていません");
testReplies.forEach(([, text, audioId]) => {
  const audioItem = audioItems.get(audioId);
  assert.ok(audioItem, `模擬返答の音声IDが未登録です: ${audioId}`);
  assert.equal(audioItem.status, "ready", `模擬返答の音声がreadyではありません: ${audioId}`);
  assert.equal(audioItem.text, text, `模擬返答の表示文と音声登録文が不一致です: ${audioId}`);
});

const renderStart = appSource.indexOf("function renderCustomerSpeechIndicator");
const renderEnd = appSource.indexOf("function renderProgress", renderStart);
assert.notEqual(renderStart, -1, "お客様発話チェックの描画関数が見つかりません");
assert.notEqual(renderEnd, -1, "お客様発話チェックの描画関数の終端が見つかりません");

const els = {
  customerSpeechPanel: { hidden: true },
  customerSpeechSummary: { textContent: "" },
  requiredCustomerSpeech: { innerHTML: "" },
  inspectionTestResponse: { hidden: true, textContent: "" },
  speechNote: { textContent: "" },
  audioEnabled: { checked: true },
  confirmedCustomerSpeech: { innerHTML: "", scrollTop: 0, scrollHeight: 80 }
};
const scenario = {
  id: "vehicle-inspection-phone-followup",
  steps: [
    { key: "confirmed_identity" },
    { key: "introduced_self" }
  ]
};
const state = {
  started: true,
  ended: false,
  scriptStep: 1,
  analyses: [],
  inspectionMileageAsked: false,
  customerReplyPending: false,
  transcript: [
    { role: "customer", text: "はい、もしもし。" },
    { role: "staff", text: "佐藤様でしょうか？" },
    { role: "customer", text: "そうです。" }
  ]
};
let playedAudio = null;
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
  audioPath: (audioId) => `audio/${audioId}.mp3`,
  playAudio: (src, text, manual) => { playedAudio = { src, text, manual }; },
  speakCustomerText() {},
  startSpeechInputAfterCustomer() {}
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
assert.match(els.requiredCustomerSpeech.innerHTML, /data-inspection-test-response="そうです。"/);
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

const transcriptLengthBeforeTest = state.transcript.length;
const analysesLengthBeforeTest = state.analyses.length;
context.handleInspectionCheckpointTest({
  target: {
    closest: () => ({
      dataset: {
        inspectionTestResponse: "そうです。",
        inspectionTestAudioId: "inspection_confirmed_identity_customer"
      }
    })
  }
});
assert.equal(els.inspectionTestResponse.hidden, false);
assert.equal(els.inspectionTestResponse.textContent, "模擬AIお客様：そうです。");
assert.match(els.speechNote.textContent, /会話ログ・進行・採点には反映されません/);
assert.deepEqual(playedAudio, {
  src: "audio/inspection_confirmed_identity_customer.mp3",
  text: "そうです。",
  manual: true
});
assert.equal(state.transcript.length, transcriptLengthBeforeTest, "模擬返答が会話ログへ混入しました");
assert.equal(state.analyses.length, analysesLengthBeforeTest, "模擬返答が採点結果へ混入しました");

context.renderCustomerSpeechIndicator(false);
assert.equal(els.customerSpeechPanel.hidden, true, "進行チェックOFFで発話チェックが非表示になりません");

scenario.id = "service-visit-promotion";
context.renderCustomerSpeechIndicator(true);
assert.equal(els.customerSpeechPanel.hidden, true, "12カ月点検に車検用発話チェックを表示しています");

console.log("車検誘致・進行チェックポイント表示テスト: OK");
