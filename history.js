import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZje28Atsfcmr0ifqlG-l2BAa3i5hjLF0",
  authDomain: "ai-roleplay-editor.firebaseapp.com",
  projectId: "ai-roleplay-editor",
  storageBucket: "ai-roleplay-editor.firebasestorage.app",
  messagingSenderId: "814410694902",
  appId: "1:814410694902:web:b8b6cc60bd2c5674feecd7"
};

const ADMIN_EMAIL = "fuchiyama.akinobu@gmail.com";
const HISTORY_LIMIT = 500;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const els = {
  loginCard: document.querySelector("#loginCard"),
  loginButton: document.querySelector("#loginButton"),
  loginStatus: document.querySelector("#loginStatus"),
  historyShell: document.querySelector("#historyShell"),
  userName: document.querySelector("#userName"),
  userEmail: document.querySelector("#userEmail"),
  logoutButton: document.querySelector("#logoutButton"),
  reloadButton: document.querySelector("#reloadButton"),
  csvButton: document.querySelector("#csvButton"),
  employeeFilter: document.querySelector("#employeeFilter"),
  scenarioFilter: document.querySelector("#scenarioFilter"),
  historyStatus: document.querySelector("#historyStatus"),
  resultCount: document.querySelector("#resultCount"),
  averageScore: document.querySelector("#averageScore"),
  startCount: document.querySelector("#startCount"),
  displayCount: document.querySelector("#displayCount"),
  historyBody: document.querySelector("#historyBody")
};

let results = [];
let starts = [];
let filteredResults = [];

function timestampDate(item) {
  if (item.createdAt?.toDate) return item.createdAt.toDate();
  const fallback = item.completedAt || item.startedAt;
  const value = fallback ? new Date(fallback) : null;
  return value && !Number.isNaN(value.getTime()) ? value : null;
}

function formatDate(item) {
  const date = timestampDate(item);
  return date ? date.toLocaleString("ja-JP") : "--";
}

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  return minutes > 0 ? `${minutes}分${rest}秒` : `${rest}秒`;
}

function addText(parent, tag, text, className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function detailsCell(item) {
  const cell = document.createElement("td");
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "会話・評価";
  details.append(summary);

  const content = document.createElement("div");
  content.className = "history-detail";
  addText(content, "h3", "良かった点");
  addText(content, "p", (item.good || []).join("\n") || "該当なし", "preserve-lines");
  addText(content, "h3", "改善点");
  addText(content, "p", (item.improve || []).join("\n") || "該当なし", "preserve-lines");
  addText(content, "h3", item.recommendedTalkTitle || "推奨トーク");
  addText(content, "p", item.recommendedTalk || "該当なし", "preserve-lines");
  addText(content, "h3", "会話ログ");
  const transcript = document.createElement("div");
  transcript.className = "history-transcript";
  (item.transcript || []).forEach((message) => {
    const role = message.role === "staff" ? "スタッフ" : message.role === "customer" ? "AIお客様" : "システム";
    addText(transcript, "p", `${role}：${message.text}`);
  });
  if (!(item.transcript || []).length) addText(transcript, "p", "会話ログなし");
  content.append(transcript);
  details.append(content);
  cell.append(details);
  return cell;
}

function render() {
  const employeeCode = els.employeeFilter.value.trim();
  const scenarioId = els.scenarioFilter.value;
  filteredResults = results.filter((item) => {
    if (employeeCode && item.employeeCode !== employeeCode) return false;
    if (scenarioId && item.scenarioId !== scenarioId) return false;
    return true;
  });

  els.historyBody.innerHTML = "";
  filteredResults.forEach((item) => {
    const row = document.createElement("tr");
    addText(row, "td", formatDate(item));
    addText(row, "td", item.employeeCode || "-----", "employee-code-cell");
    addText(row, "td", item.scenarioTitle || item.scenarioId || "--");
    addText(row, "td", `${Number(item.score) || 0}点`, "score-cell");
    addText(row, "td", formatDuration(item.durationSeconds));
    row.append(detailsCell(item));
    els.historyBody.append(row);
  });
  if (!filteredResults.length) {
    const row = document.createElement("tr");
    const cell = addText(row, "td", "条件に一致する採点履歴はありません。", "empty-history");
    cell.colSpan = 6;
    els.historyBody.append(row);
  }

  const average = filteredResults.length
    ? Math.round(filteredResults.reduce((sum, item) => sum + (Number(item.score) || 0), 0) / filteredResults.length)
    : null;
  const filteredStarts = starts.filter((item) => {
    if (employeeCode && item.employeeCode !== employeeCode) return false;
    if (scenarioId && item.scenarioId !== scenarioId) return false;
    return true;
  });
  els.resultCount.textContent = `${results.length}件`;
  els.averageScore.textContent = average === null ? "--" : `${average}点`;
  els.startCount.textContent = `${filteredStarts.length}回`;
  els.displayCount.textContent = `${filteredResults.length}件`;
}

function populateScenarioFilter() {
  const selected = els.scenarioFilter.value;
  const scenarios = new Map();
  [...results, ...starts].forEach((item) => {
    if (item.scenarioId) scenarios.set(item.scenarioId, item.scenarioTitle || item.scenarioId);
  });
  els.scenarioFilter.innerHTML = '<option value="">すべて</option>';
  scenarios.forEach((title, id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = title;
    els.scenarioFilter.append(option);
  });
  els.scenarioFilter.value = selected;
}

async function loadHistory() {
  els.historyStatus.textContent = "履歴を読み込んでいます…";
  els.reloadButton.disabled = true;
  try {
    const [resultSnapshot, startSnapshot] = await Promise.all([
      getDocs(query(collection(db, "roleplayResults"), orderBy("createdAt", "desc"))),
      getDocs(query(collection(db, "roleplayActivity"), orderBy("createdAt", "desc")))
    ]);
    const [deletedResults, deletedStarts] = await Promise.all([
      pruneHistory("roleplayResults", resultSnapshot),
      pruneHistory("roleplayActivity", startSnapshot)
    ]);
    results = resultSnapshot.docs.slice(0, HISTORY_LIMIT).map((item) => ({ id: item.id, ...item.data() }));
    starts = startSnapshot.docs.slice(0, HISTORY_LIMIT).map((item) => ({ id: item.id, ...item.data() }));
    populateScenarioFilter();
    render();
    const deletedCount = deletedResults + deletedStarts;
    const cleanupMessage = deletedCount > 0 ? ` 古い履歴${deletedCount}件を整理しました。` : "";
    els.historyStatus.textContent = `最新${results.length}件の採点履歴を表示できます。${cleanupMessage}`;
  } catch (error) {
    els.historyStatus.textContent = `履歴を読み込めませんでした：${error.message}`;
  } finally {
    els.reloadButton.disabled = false;
  }
}

async function pruneHistory(collectionName, snapshot) {
  const excess = snapshot.docs.slice(HISTORY_LIMIT);
  for (let index = 0; index < excess.length; index += 500) {
    const batch = writeBatch(db);
    excess.slice(index, index + 500).forEach((item) => {
      batch.delete(doc(db, collectionName, item.id));
    });
    await batch.commit();
  }
  return excess.length;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = [["実施日時", "社員コード", "シナリオ", "点数", "所要秒数", "良かった点", "改善点"]];
  filteredResults.forEach((item) => {
    rows.push([
      formatDate(item),
      item.employeeCode,
      item.scenarioTitle,
      item.score,
      item.durationSeconds,
      (item.good || []).join(" / "),
      (item.improve || []).join(" / ")
    ]);
  });
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `roleplay-history-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

els.loginButton.addEventListener("click", async () => {
  els.loginStatus.textContent = "ログイン画面を開いています…";
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    els.loginStatus.textContent = `ログインできませんでした：${error.message}`;
  }
});
els.logoutButton.addEventListener("click", () => signOut(auth));
els.reloadButton.addEventListener("click", loadHistory);
els.csvButton.addEventListener("click", exportCsv);
els.employeeFilter.addEventListener("input", () => {
  els.employeeFilter.value = els.employeeFilter.value.replace(/\D/g, "").slice(0, 5);
  render();
});
els.scenarioFilter.addEventListener("change", render);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    els.loginCard.hidden = false;
    els.historyShell.hidden = true;
    els.loginStatus.textContent = "";
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    els.loginStatus.textContent = "このGoogleアカウントには閲覧権限がありません。";
    await signOut(auth);
    return;
  }
  els.userName.textContent = user.displayName || "管理者";
  els.userEmail.textContent = user.email;
  els.loginCard.hidden = true;
  els.historyShell.hidden = false;
  await loadHistory();
});
