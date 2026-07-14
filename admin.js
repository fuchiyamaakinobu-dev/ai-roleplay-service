import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const localDefaults = {
  scenarios: structuredClone(window.ROLEPLAY_SCENARIOS || [])
};

const els = {
  loginCard: document.querySelector("#loginCard"),
  loginButton: document.querySelector("#loginButton"),
  loginStatus: document.querySelector("#loginStatus"),
  editor: document.querySelector("#editor"),
  userName: document.querySelector("#userName"),
  userEmail: document.querySelector("#userEmail"),
  logoutButton: document.querySelector("#logoutButton"),
  scenarioButtons: document.querySelector("#scenarioButtons"),
  duplicateButton: document.querySelector("#duplicateButton"),
  scenarioForm: document.querySelector("#scenarioForm"),
  saveState: document.querySelector("#saveState"),
  updatedAt: document.querySelector("#updatedAt"),
  reloadButton: document.querySelector("#reloadButton"),
  saveDraftButton: document.querySelector("#saveDraftButton"),
  publishButton: document.querySelector("#publishButton"),
  jsonEditor: document.querySelector("#jsonEditor"),
  applyJsonButton: document.querySelector("#applyJsonButton")
};

let workingData = structuredClone(localDefaults);
let selectedScenarioIndex = 0;
let dirty = false;

function markDirty() {
  dirty = true;
  els.saveState.textContent = "未保存の変更があります";
  els.updatedAt.textContent = "";
  syncJsonEditor();
}

function syncJsonEditor() {
  els.jsonEditor.value = JSON.stringify(workingData, null, 2);
}

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  return node;
}

function addTextField(container, label, value, onChange, options = {}) {
  const wrapper = element("label", { className: "field" });
  wrapper.append(element("span", { text: label }));
  const input = document.createElement(options.multiline === false ? "input" : "textarea");
  if (input.tagName === "TEXTAREA") input.rows = options.rows || 3;
  input.value = value ?? "";
  input.addEventListener("input", () => {
    onChange(input.value);
    markDirty();
  });
  wrapper.append(input);
  if (options.help) wrapper.append(element("small", { text: options.help }));
  container.append(wrapper);
  return input;
}

function addNumberField(container, label, value, onChange) {
  const wrapper = element("label", { className: "field" });
  wrapper.append(element("span", { text: label }));
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.value = Number(value || 0);
  input.addEventListener("input", () => {
    onChange(Number(input.value || 0));
    markDirty();
  });
  wrapper.append(input);
  container.append(wrapper);
}

function makeSection(title) {
  const section = element("fieldset", { className: "form-section" });
  const legend = document.createElement("legend");
  legend.textContent = title;
  section.append(legend);
  els.scenarioForm.append(section);
  return section;
}

function renderStringList(container, title, items) {
  const section = element("div", { className: "item-card" });
  section.append(element("h3", { text: title }));
  items.forEach((item, index) => {
    addTextField(section, `${index + 1}件目`, item, (value) => { items[index] = value; }, { rows: 2 });
  });
  const addButton = element("button", { text: "項目を追加" });
  addButton.type = "button";
  addButton.addEventListener("click", () => {
    items.push("");
    markDirty();
    renderEditor();
  });
  section.append(addButton);
  container.append(section);
}

function renderBasics(scenario) {
  const section = makeSection("基本情報");
  addTextField(section, "シナリオ名", scenario.title, (value) => { scenario.title = value; }, { multiline: false });
  addTextField(section, "説明", scenario.description, (value) => { scenario.description = value; }, { rows: 2 });
  if (scenario.startInstruction !== undefined) {
    addTextField(section, "開始時の判定メモ", scenario.startInstruction, (value) => { scenario.startInstruction = value; }, { rows: 3 });
  }
  addTextField(section, "推奨トーク", scenario.recommendedTalk, (value) => { scenario.recommendedTalk = value; }, { rows: 5 });
}

function renderScoring(scenario) {
  const section = makeSection("採点項目");
  (scenario.scoring || []).forEach((score, index) => {
    const card = element("div", { className: "item-card" });
    card.append(element("h3", { text: `${index + 1}. ${score.key}` }));
    addTextField(card, "表示名", score.label, (value) => { score.label = value; }, { multiline: false });
    const row = element("div", { className: "score-row" });
    addTextField(row, "評価する行動", score.action, (value) => { score.action = value; }, { multiline: false });
    addNumberField(row, "配点", score.points, (value) => { score.points = value; });
    card.append(row);
    section.append(card);
  });
}

function renderScriptedScenario(scenario) {
  const section = makeSection("会話ステップ");
  (scenario.steps || []).forEach((step, index) => {
    const card = element("div", { className: "item-card" });
    card.append(element("h3", { text: `${index + 1}. ${step.expected || step.key}` }));
    addTextField(card, "スタッフに求める発話", step.expected, (value) => { step.expected = value; }, { rows: 2 });
    const responseRow = element("div", { className: "two-columns" });
    addTextField(responseRow, "条件を満たした時のお客様", step.customerResponse, (value) => { step.customerResponse = value; }, { rows: 2 });
    addTextField(responseRow, "不足時のお客様", step.retryResponse, (value) => { step.retryResponse = value; }, { rows: 2 });
    card.append(responseRow);
    const keywordText = (step.requiredGroups || []).map((group) => group.join(" / ")).join("\n");
    addTextField(card, "必要キーワード", keywordText, (value) => {
      step.requiredGroups = value.split(/\r?\n/).map((line) => line.split("/").map((word) => word.trim()).filter(Boolean)).filter((group) => group.length);
    }, { rows: 3, help: "1行ごとに必須グループ、同じ行の「/」区切りはどれか1つで成立します。" });
    section.append(card);
  });
}

function renderCustomerLedScenario(scenario) {
  const conversation = makeSection("お客様の発話候補");
  renderStringList(conversation, "作業時間の質問", scenario.serviceTimeQuestions || []);
  renderStringList(conversation, "引取依頼", scenario.pickupRequests || []);
  Object.entries(scenario.objections || {}).forEach(([key, objection]) => {
    renderStringList(conversation, `断り理由：${objection.label || key}`, objection.customer || []);
  });

  const talks = makeSection("理由別の推奨トーク");
  Object.entries(scenario.recommendedTalks || {}).forEach(([key, talk]) => {
    addTextField(talks, key, talk, (value) => { scenario.recommendedTalks[key] = value; }, { rows: 4 });
  });
}

function renderScenarioButtons() {
  els.scenarioButtons.innerHTML = "";
  workingData.scenarios.forEach((scenario, index) => {
    const button = element("button", { text: scenario.title || `シナリオ${index + 1}` });
    button.type = "button";
    button.classList.toggle("active", index === selectedScenarioIndex);
    button.addEventListener("click", () => {
      selectedScenarioIndex = index;
      renderEditor();
    });
    els.scenarioButtons.append(button);
  });
}

function renderEditor() {
  if (!workingData.scenarios.length) workingData = structuredClone(localDefaults);
  if (selectedScenarioIndex >= workingData.scenarios.length) selectedScenarioIndex = 0;
  renderScenarioButtons();
  els.scenarioForm.innerHTML = "";
  const scenario = workingData.scenarios[selectedScenarioIndex];
  renderBasics(scenario);
  if (scenario.mode === "staff-led-scripted") renderScriptedScenario(scenario);
  else renderCustomerLedScenario(scenario);
  renderScoring(scenario);
  syncJsonEditor();
}

function setBusy(isBusy) {
  [els.reloadButton, els.saveDraftButton, els.publishButton, els.duplicateButton].forEach((button) => {
    button.disabled = isBusy;
  });
}

function formatTimestamp(value) {
  if (!value?.toDate) return "";
  return value.toDate().toLocaleString("ja-JP");
}

async function loadData() {
  setBusy(true);
  els.saveState.textContent = "データを読み込んでいます…";
  try {
    const draftSnapshot = await getDoc(doc(db, "roleplay", "draft"));
    const publicSnapshot = draftSnapshot.exists() ? null : await getDoc(doc(db, "roleplay", "public"));
    const source = draftSnapshot.exists() ? draftSnapshot : publicSnapshot;
    if (source?.exists()) {
      const parsed = JSON.parse(source.data().content);
      if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) throw new Error("保存データの形式が正しくありません");
      workingData = parsed;
      els.updatedAt.textContent = formatTimestamp(source.data().updatedAt);
      els.saveState.textContent = draftSnapshot.exists() ? "下書きを読み込みました" : "公開データを読み込みました";
    } else {
      workingData = structuredClone(localDefaults);
      els.saveState.textContent = "現在の公開ファイルを初期データとして読み込みました";
      els.updatedAt.textContent = "初回は「公開する」を押してください";
    }
    selectedScenarioIndex = 0;
    dirty = false;
    renderEditor();
  } catch (error) {
    els.saveState.textContent = "読込に失敗しました";
    els.updatedAt.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

async function saveDocument(documentName, statusMessage) {
  setBusy(true);
  els.saveState.textContent = "保存しています…";
  try {
    const payload = JSON.stringify(workingData);
    await setDoc(doc(db, "roleplay", documentName), {
      content: payload,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.email,
      version: 1
    });
    if (documentName === "public") {
      await setDoc(doc(db, "roleplay", "draft"), {
        content: payload,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.email,
        version: 1
      });
    }
    dirty = false;
    els.saveState.textContent = statusMessage;
    els.updatedAt.textContent = new Date().toLocaleString("ja-JP");
  } catch (error) {
    els.saveState.textContent = "保存に失敗しました";
    els.updatedAt.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

els.loginButton.addEventListener("click", async () => {
  els.loginStatus.textContent = "ログイン画面を開いています…";
  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    els.loginStatus.textContent = `ログインできませんでした：${error.message}`;
  }
});

els.logoutButton.addEventListener("click", () => signOut(auth));
els.reloadButton.addEventListener("click", () => {
  if (dirty && !window.confirm("未保存の変更を破棄して再読込しますか？")) return;
  loadData();
});
els.saveDraftButton.addEventListener("click", () => saveDocument("draft", "下書きを保存しました"));
els.publishButton.addEventListener("click", () => {
  if (!window.confirm("この内容を全端末のロープレ画面へ公開しますか？")) return;
  saveDocument("public", "公開しました");
});
els.duplicateButton.addEventListener("click", () => {
  const source = workingData.scenarios[selectedScenarioIndex];
  const copy = structuredClone(source);
  copy.id = `${source.id}-copy-${Date.now()}`;
  copy.title = `${source.title}（コピー）`;
  workingData.scenarios.push(copy);
  selectedScenarioIndex = workingData.scenarios.length - 1;
  markDirty();
  renderEditor();
});
els.applyJsonButton.addEventListener("click", () => {
  try {
    const parsed = JSON.parse(els.jsonEditor.value);
    if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) throw new Error("scenarios配列が必要です");
    workingData = parsed;
    selectedScenarioIndex = 0;
    markDirty();
    renderEditor();
    window.alert("詳細データを反映しました。保存または公開してください。");
  } catch (error) {
    window.alert(`詳細データを反映できません：${error.message}`);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    els.loginCard.hidden = false;
    els.editor.hidden = true;
    els.loginStatus.textContent = "";
    return;
  }
  if (user.email !== ADMIN_EMAIL) {
    els.loginStatus.textContent = "このGoogleアカウントには編集権限がありません。";
    await signOut(auth);
    return;
  }
  els.userName.textContent = user.displayName || "管理者";
  els.userEmail.textContent = user.email;
  els.loginCard.hidden = true;
  els.editor.hidden = false;
  await loadData();
});

window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
