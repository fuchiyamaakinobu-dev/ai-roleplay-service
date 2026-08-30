import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const beginStart = source.indexOf("function beginAutomaticSpeechInput");
const beginEnd = source.indexOf("function startSpeechInputAfterCustomer", beginStart);
assert.notEqual(beginStart, -1, "音声認識の自動開始処理が見つかりません");
assert.notEqual(beginEnd, -1, "音声認識の自動開始処理の終端が見つかりません");

const timers = [];
const micStates = [];
let startCount = 0;
const invalidState = new Error("recognition is still stopping");
invalidState.name = "InvalidStateError";
const context = {
  state: { started: true, ended: false },
  speechListening: false,
  speechRecognition: {
    start() {
      startCount += 1;
      if (startCount === 1) throw invalidState;
    }
  },
  speechInputStartTimer: null,
  els: { speechNote: { textContent: "" } },
  clearStaffInput() {},
  updateMicButton(listening) {
    micStates.push(listening);
  },
  window: {
    clearTimeout(timer) {
      timer.cancelled = true;
    },
    setTimeout(callback, delay) {
      const timer = { callback, delay, cancelled: false };
      timers.push(timer);
      return timer;
    }
  }
};
vm.createContext(context);
vm.runInContext(
  `${source.slice(beginStart, beginEnd)}\nthis.beginAutomaticSpeechInput = beginAutomaticSpeechInput;`,
  context
);

assert.equal(
  context.beginAutomaticSpeechInput("音声入力中です。案内の続きを話してください。"),
  false,
  "停止完了前の最初の開始失敗を成功扱いにしています"
);
assert.equal(startCount, 1);
assert.equal(timers.length, 1, "InvalidStateError後の再試行が予約されません");
assert.equal(timers[0].delay, 120, "停止完了待ちの再試行間隔が想定外です");
assert.equal(context.els.speechNote.textContent, "音声入力の再開を待っています。");

timers.shift().callback();
assert.equal(startCount, 2, "音声認識を再試行していません");
assert.equal(context.speechListening, true, "再試行成功後もマイク状態がOFFです");
assert.equal(micStates.at(-1), true, "再試行成功後にマイクボタンがONへ戻りません");

const handlerStart = source.indexOf("function handleScriptedStaffReply");
const handlerEnd = source.indexOf("function handleReply", handlerStart);
const handlerSource = source.slice(handlerStart, handlerEnd);
assert.match(
  handlerSource,
  /isInspectionAcknowledgementOnlyAfterAppointment\(text\)[\s\S]*?continueSpeechInputWithoutCustomerReply\("音声入力中です。案内の続きを話してください。"\)/,
  "予約確定後の単独受領表現から音声入力継続へ進みません"
);
assert.match(
  source,
  /isInspectionAcknowledgementOnlyAfterAppointment[\s\S]*?ありがとうございます/,
  "予約確定後の単独の『ありがとうございます。』を音声入力継続として扱えません"
);

const stopStart = source.indexOf("function stopSpeechInput");
const stopEnd = source.indexOf("els.startButton.addEventListener", stopStart);
const stopSource = source.slice(stopStart, stopEnd);
assert.match(
  stopSource,
  /speechInputStartTimer[\s\S]*?clearTimeout\(speechInputStartTimer\)[\s\S]*?speechInputStartTimer = null/,
  "手動停止時に保留中の自動再開を解除していません"
);

console.log("車検誘致・予約承諾後のマイク自動再開テスト: OK");
