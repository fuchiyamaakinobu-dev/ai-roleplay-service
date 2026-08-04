import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

assert.match(html, /id="customerSpeechPanel"[\s\S]*?id="requiredCustomerSpeech"[\s\S]*?id="confirmedCustomerSpeech"/);
assert.match(styles, /\.customer-speech-panel\s*\{/);
assert.match(styles, /\.customer-speech-list\s*\{[^}]*max-height:\s*92px;[^}]*overflow:\s*auto;/s);
assert.match(styles, /\.customer-speech-panel\[hidden\]/);

const renderStart = appSource.indexOf("function renderCustomerSpeechIndicator");
const renderEnd = appSource.indexOf("function renderProgress", renderStart);
assert.notEqual(renderStart, -1, "お客様発話チェックの描画関数が見つかりません");
assert.notEqual(renderEnd, -1, "お客様発話チェックの描画関数の終端が見つかりません");

const els = {
  customerSpeechPanel: { hidden: true },
  customerSpeechSummary: { textContent: "" },
  requiredCustomerSpeech: { innerHTML: "" },
  confirmedCustomerSpeech: { innerHTML: "", scrollTop: 0, scrollHeight: 80 }
};
const scenario = {
  id: "vehicle-inspection-phone-followup",
  scoring: [
    { key: "confirmed_identity", label: "本人確認" },
    { key: "introduced_self", label: "店舗・担当者名" }
  ],
  steps: [
    { key: "confirmed_identity", customerResponse: "そうです。" },
    { key: "introduced_self", customerResponse: "お世話になっております。" }
  ]
};
const state = {
  scriptStep: 1,
  analyses: [],
  transcript: [
    { role: "customer", text: "はい、もしもし。" },
    { role: "staff", text: "佐藤様でしょうか？" },
    { role: "customer", text: "そうです。" }
  ]
};
const context = { els, scenario, state, escapeHtml: (text) => String(text) };
vm.createContext(context);
vm.runInContext(appSource.slice(renderStart, renderEnd), context);

context.renderCustomerSpeechIndicator(true);
assert.equal(els.customerSpeechPanel.hidden, false, "車検誘致で発話チェックが表示されません");
assert.equal(els.customerSpeechSummary.textContent, "必要 1件／確認済み 2件");
assert.match(els.requiredCustomerSpeech.innerHTML, /店舗・担当者名/);
assert.match(els.requiredCustomerSpeech.innerHTML, /お世話になっております。/);
assert.doesNotMatch(els.requiredCustomerSpeech.innerHTML, /そうです。/);
assert.match(els.confirmedCustomerSpeech.innerHTML, /はい、もしもし。/);
assert.match(els.confirmedCustomerSpeech.innerHTML, /そうです。/);

state.scriptStep = 0;
state.analyses = [{ stepKey: "introduced_self", passed: true }];
context.renderCustomerSpeechIndicator(true);
assert.equal(els.customerSpeechSummary.textContent, "必要 1件／確認済み 2件");
assert.match(els.requiredCustomerSpeech.innerHTML, /本人確認/);
assert.doesNotMatch(els.requiredCustomerSpeech.innerHTML, /店舗・担当者名/);

context.renderCustomerSpeechIndicator(false);
assert.equal(els.customerSpeechPanel.hidden, true, "進行チェックOFFで発話チェックが非表示になりません");

scenario.id = "service-visit-promotion";
context.renderCustomerSpeechIndicator(true);
assert.equal(els.customerSpeechPanel.hidden, true, "12カ月点検に車検用発話チェックを表示しています");

console.log("お客様発話チェック表示テスト: OK");
