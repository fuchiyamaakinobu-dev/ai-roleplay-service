import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const repo = new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1");
const elements = new Map();
const speechMetrics = { starts: 0, stops: 0 };

class MockSpeechRecognition {
  addEventListener() {}
  start() { speechMetrics.starts += 1; }
  stop() { speechMetrics.stops += 1; }
  abort() {}
}

function element(selector) {
  if (!elements.has(selector)) {
    elements.set(selector, {
      value: "",
      textContent: "",
      innerHTML: "",
      checked: false,
      disabled: false,
      scrollTop: 0,
      scrollHeight: 0,
      dataset: {},
      classList: { toggle() {}, add() {}, remove() {} },
      addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
      closest() { return null; },
      requestSubmit() {},
      focus() {}
    });
  }
  return elements.get(selector);
}

const windowObject = {
  setTimeout() { return 1; },
  clearTimeout() {},
  print() {},
  SpeechRecognition: MockSpeechRecognition
};
const context = {
  window: windowObject,
  document: { querySelector: element },
  localStorage: { getItem() { return null; }, setItem() {} },
  Audio: class {},
  console
};
windowObject.window = windowObject;
vm.createContext(context);
vm.runInContext(fs.readFileSync(`${repo}/scenario.js`, "utf8"), context);
vm.runInContext(fs.readFileSync(`${repo}/audio-db.js`, "utf8"), context);
vm.runInContext(fs.readFileSync(`${repo}/app.js`, "utf8"), context);

function run(expression) {
  return vm.runInContext(expression, context);
}


run(`addMessage = commitMessage; scenario = scenarios.find(item => item.id === "vehicle-inspection-phone-followup"); startRoleplay();`);
const replies = [];
for (const text of ["もしもし、佐藤様のお電話ですか？","いつもお世話になっております。私、トヨタモビリティ帯広本別店の原田といいます。本日は佐藤様のヤリスの車検の件でお電話させていただきました。","佐藤様、日頃はいつもご利用いただき、ありがとうございます。ヤリスの車検が9月30日満了になっております。ツー車検のご予定はお決まりでしょうか。","ありがとうございます。佐藤様の。ヤリスの車検、8月1日以降から詐欺を開始できます。もしよろしければ日数の合格にさせていただきたいんですが、よろしいですか？","佐藤様のお車、今、走行距離数は何キロでございますか？","何かヤリスのことで気になることはございますか？あと、オイル交換などはいかがですか？","他に何か気になる点、見てほしいところなどございますか？","佐藤様、今のお話ですと。ご来店いただいて。90分ほどで作業できますが、いかがですか？","はい、ぜひお待ちいただいて。ええ、整備の内容等もご説明させていただきたいと思います。もし差し支えなければなんですが。ああ、何か。ああ、用事があったりした場合の代車等ご用意いたしますか？"]) { run('addMessage("staff", '+JSON.stringify(text)+'); handleScriptedStaffReply('+JSON.stringify(text)+');'); const reply = JSON.parse(run("JSON.stringify(state.transcript.at(-1))")); replies.push(reply); }
assert.equal(replies[1].text, "お世話になっております。");
assert.equal(replies[2].text, "案内のはがきが来ていましたよ。");
assert.equal(replies[8].text, "代車を用意してもらえますか？");
for (const index of [1,2,8]) assert.ok(fs.statSync(repo + '/' + replies[index].audioSrc).size > 1000);
assert.equal(run('state.proposedAppointment'), null);
console.log("9月12日の実会話3応答・既存MP3・満了日誤認防止: OK");
