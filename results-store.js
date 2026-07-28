import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZje28Atsfcmr0ifqlG-l2BAa3i5hjLF0",
  authDomain: "ai-roleplay-editor.firebaseapp.com",
  projectId: "ai-roleplay-editor",
  storageBucket: "ai-roleplay-editor.firebasestorage.app",
  messagingSenderId: "814410694902",
  appId: "1:814410694902:web:b8b6cc60bd2c5674feecd7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function notify(status, message) {
  window.dispatchEvent(new CustomEvent("roleplay-history-status", {
    detail: { status, message }
  }));
}

function cleanText(value, maximum = 1000) {
  return String(value || "").slice(0, maximum);
}

function cleanBase(payload) {
  return {
    employeeCode: cleanText(payload.employeeCode, 6),
    scenarioId: cleanText(payload.scenarioId, 100),
    scenarioTitle: cleanText(payload.scenarioTitle, 200),
    scenarioMode: cleanText(payload.scenarioMode, 50),
    startedAt: cleanText(payload.startedAt, 40),
    createdAt: serverTimestamp(),
    version: 1
  };
}

async function recordStart(payload) {
  try {
    await addDoc(collection(db, "roleplayActivity"), {
      ...cleanBase(payload),
      eventType: "start"
    });
  } catch (error) {
    console.warn("開始履歴を保存できませんでした", error);
    notify("error", "開始履歴を保存できませんでした。ロープレはそのまま続けられます。");
  }
}

async function saveResult(payload) {
  notify("saving", "採点結果を保存しています…");
  try {
    await addDoc(collection(db, "roleplayResults"), {
      ...cleanBase(payload),
      completedAt: cleanText(payload.completedAt, 40),
      durationSeconds: Math.max(0, Math.min(86400, Number(payload.durationSeconds) || 0)),
      score: Math.max(0, Math.min(100, Number(payload.score) || 0)),
      good: (payload.good || []).slice(0, 20).map((item) => cleanText(item, 500)),
      improve: (payload.improve || []).slice(0, 20).map((item) => cleanText(item, 500)),
      judgements: (payload.judgements || []).slice(0, 30).map((item) => cleanText(item, 500)),
      recommendedTalkTitle: cleanText(payload.recommendedTalkTitle, 100),
      recommendedTalk: cleanText(payload.recommendedTalk, 3000),
      transcript: (payload.transcript || []).slice(0, 100).map((message) => ({
        role: cleanText(message.role, 20),
        text: cleanText(message.text, 1000)
      }))
    });
    notify("saved", "採点結果を履歴へ保存しました。");
  } catch (error) {
    console.warn("採点結果を保存できませんでした", error);
    notify("error", "採点結果を保存できませんでした。印刷結果は利用できます。");
  }
}

window.ROLEPLAY_RESULTS = { recordStart, saveResult };
const queued = window.ROLEPLAY_RESULT_QUEUE || [];
window.ROLEPLAY_RESULT_QUEUE = [];
queued.forEach(({ method, payload }) => {
  if (window.ROLEPLAY_RESULTS[method]) window.ROLEPLAY_RESULTS[method](payload);
});
