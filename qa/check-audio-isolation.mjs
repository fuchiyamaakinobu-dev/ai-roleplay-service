import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `${start} が見つかりません`);
  assert.notEqual(endIndex, -1, `${end} が見つかりません`);
  return source.slice(startIndex, endIndex);
}

class FakeAudio {
  static instances = [];

  constructor(src) {
    this.src = src;
    this.listeners = {};
    this.paused = false;
    this.loaded = false;
    FakeAudio.instances.push(this);
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  play() {
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  removeAttribute(name) {
    if (name === "src") this.src = "";
  }

  load() {
    this.loaded = true;
  }

  emit(type) {
    this.listeners[type]?.();
  }
}

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.listeners = {};
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  emit(type) {
    this.listeners[type]?.();
  }
}

const scheduled = [];
const speechSynthesis = {
  cancelCount: 0,
  current: null,
  cancel() {
    this.cancelCount += 1;
  },
  speak(utterance) {
    this.current = utterance;
  }
};
let micStartCount = 0;

const context = {
  Audio: FakeAudio,
  SpeechSynthesisUtterance: FakeUtterance,
  addMessage() {},
  beginAutomaticSpeechInput() {
    micStartCount += 1;
  },
  window: {
    speechSynthesis,
    SpeechSynthesisUtterance: FakeUtterance,
    clearTimeout(timer) {
      timer.cancelled = true;
    },
    setTimeout(callback) {
      const timer = { callback, cancelled: false };
      scheduled.push(timer);
      return timer;
    }
  }
};
vm.createContext(context);

const playbackFunctions = sourceBetween(
  "function stopCustomerPlayback()",
  "function beginAutomaticSpeechInput("
);
const delayedMicFunction = sourceBetween(
  "function startSpeechInputAfterCustomer()",
  "function startSpeechInputForStaffOpening("
);

vm.runInContext(
  `
    let activeCustomerAudio = null;
    let customerPlaybackGeneration = 0;
    let speechInputStartTimer = null;
    ${playbackFunctions}
    ${delayedMicFunction}
  `,
  context
);

let firstFinished = 0;
let secondFinished = 0;
context.playAudio("first.mp3", "", false, () => {
  firstFinished += 1;
});
const firstAudio = FakeAudio.instances.at(-1);

context.playAudio("second.mp3", "", false, () => {
  secondFinished += 1;
});
const secondAudio = FakeAudio.instances.at(-1);

assert.equal(firstAudio.paused, true, "次音声の開始時に前音声を停止する");
assert.equal(firstAudio.src, "", "停止した前音声の参照を解放する");
firstAudio.emit("ended");
assert.equal(firstFinished, 0, "停止した前音声の終了処理を実行しない");
secondAudio.emit("ended");
assert.equal(secondFinished, 1, "最後に開始した音声だけ終了処理を実行する");

context.startSpeechInputAfterCustomer();
const staleMicTimer = scheduled.at(-1);
context.playAudio("third.mp3", "", false);
assert.equal(staleMicTimer.cancelled, true, "次音声の開始時に古いマイク開始予約を解除する");
staleMicTimer.callback();
assert.equal(micStartCount, 0, "解除済み予約からマイクを開始しない");

let firstSpeechFinished = 0;
let secondSpeechFinished = 0;
context.speakCustomerText("最初", () => {
  firstSpeechFinished += 1;
});
const firstUtterance = speechSynthesis.current;
context.speakCustomerText("次", () => {
  secondSpeechFinished += 1;
});
const secondUtterance = speechSynthesis.current;
firstUtterance.emit("error");
assert.equal(firstSpeechFinished, 0, "停止した音声合成の終了処理を実行しない");
secondUtterance.emit("end");
assert.equal(secondSpeechFinished, 1, "最後の音声合成だけ終了処理を実行する");

console.log("Audio isolation checks passed");
