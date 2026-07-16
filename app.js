const scenarios = window.ROLEPLAY_SCENARIOS || [window.ROLEPLAY_SCENARIO];
let scenario = scenarios[0];
const audioDb = window.ROLEPLAY_AUDIO_DB || { basePath: "audio/", items: [] };
const audioIndex = new Map(audioDb.items.map((item) => [item.id, item]));

let speechRecognition = null;
let speechListening = false;
let speechBaseText = "";
let speechRestartTimer = null;
let speechDecisionTimer = null;
let speechPausedForAck = false;
let lastAcknowledgedText = "";

const state = {
  started: false,
  ended: false,
  currentState: "START",
  turn: 0,
  scriptStep: 0,
  proposedAppointment: null,
  variantSeed: 0,
  pickupReason: null,
  currentObjection: null,
  resolutionType: null,
  serviceTimeExplained: false,
  appointmentDateConfirmed: false,
  appointmentTimeConfirmed: false,
  additionalServiceAnswered: false,
  additionalServiceResumeState: null,
  transcript: [],
  analyses: [],
  scriptedPartialReplies: {},
  usedVariants: {}
};

const els = {
  scenarioList: document.querySelector("#scenarioList"),
  scenarioCount: document.querySelector("#scenarioCount"),
  startButton: document.querySelector("#startButton"),
  resetButton: document.querySelector("#resetButton"),
  finishButton: document.querySelector("#finishButton"),
  printButton: document.querySelector("#printButton"),
  audioEnabled: document.querySelector("#audioEnabled"),
  voiceSelect: document.querySelector("#voiceSelect"),
  voiceCredit: document.querySelector("#voiceCredit"),
  replyForm: document.querySelector("#replyForm"),
  staffInput: document.querySelector("#staffInput"),
  micButton: document.querySelector("#micButton"),
  speechNote: document.querySelector("#speechNote"),
  scenarioNote: document.querySelector("#scenarioNote"),
  conversation: document.querySelector("#conversation"),
  progressStrip: document.querySelector("#progressStrip"),
  stateLabel: document.querySelector("#stateLabel"),
  scoreBadge: document.querySelector("#scoreBadge"),
  scoreNumber: document.querySelector("#scoreNumber"),
  scoreSummary: document.querySelector("#scoreSummary"),
  goodList: document.querySelector("#goodList"),
  improveList: document.querySelector("#improveList"),
  judgementList: document.querySelector("#judgementList"),
  recommendedTalk: document.querySelector("#recommendedTalk")
};

const lexicon = {
  thanks: ["ありがとう", "ありがとうございます", "ご連絡", "お電話"],
  serviceTime: ["1時間", "一時間", "60分", "時間程度", "作業時間"],
  reasonQuestion: ["なぜ", "理由", "どうして", "差し支え", "ご事情", "難しい", "どのような"],
  visitBenefit: ["直接", "説明", "お車を見ながら", "点検内容", "整備内容", "安心", "詳しく"],
  weekend: ["土日", "週末", "土曜", "日曜", "休日"],
  otherStore: ["他店舗", "別店舗", "市内", "帯広", "近くのお店", "近い店舗", "近くの店舗", "最寄りの店舗"],
  choice: ["無理に", "可能です", "選べ", "ご都合", "難しい場合", "検討"],
  nextAction: ["いつ", "候補", "予約", "ご都合", "何日", "午前", "午後", "連絡", "確認"],
  additionalService: ["点検以外", "点検のほか", "点検の他", "ご用命", "追加整備", "オイル交換", "ほかに", "他に", "その他", "そのほか", "何か", "なにか"],
  vehicleConcern: ["気になる", "異音", "不具合", "症状", "調子", "違和感", "音"],
  pressure: ["必ず来店", "来てください", "来店しか", "できません", "無理です"],
  confirmedPickup: [
    "取りに伺います", "お取りに伺います", "車を取りに伺います",
    "取りに行きます", "車を取りに行きます", "引取に伺います",
    "引き取りに伺います", "引き取りに行きます", "伺います", "持っていきます"
  ],
  location: ["自宅", "会社", "職場", "駐車場", "住所", "どちらに"],
  timing: ["明日", "今日", "朝", "午後", "10時", "日時", "何時"]
};

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function classifyCustomerReason(text) {
  const normalized = text.replace(/\s+/g, "");
  if (includesAny(normalized, ["運転に自信", "運転が不安", "運転するのが不安"])) return "drivingConfidence";
  if (includesAny(normalized, ["仕事", "職場", "通勤", "畑", "忙しく", "時間が無い", "時間がない"])) return "work";
  if (includesAny(normalized, ["遠い", "距離", "行くのが大変", "持って行くのが大変"])) return "distance";
  if (includesAny(normalized, ["他のお店", "他店", "ほかのお店"])) return "competitor";
  if (includesAny(normalized, ["言いませんでした", "説明と違", "聞いていた"])) return "misunderstanding";
  if (includesAny(normalized, ["主人と相談", "家族と相談"])) return "family";
  return null;
}

function isActivePickupRequest() {
  const lastCustomerMessage = [...state.transcript]
    .reverse()
    .find((message) => message.role === "customer");
  if (!lastCustomerMessage) return false;
  const text = lastCustomerMessage.text.replace(/\s+/g, "");
  const asksPickup = includesAny(text, [
    "取りに来", "取りにき", "取りに行", "取りにい", "引取", "引き取り",
    "持っていって", "持って行って", "職場に来", "自宅に来"
  ]);
  return state.currentState === "PICKUP_REQUEST" && asksPickup;
}

function renderScenarioList() {
  els.scenarioCount.textContent = `${scenarios.length}件`;
  els.scenarioNote.textContent = scenario.mode === "staff-led-scripted"
    ? "入庫日時が確定すれば終話へ進めます。必須確認が不足すると、AIお客様が聞き返します。"
    : scenario.scoring.some((metric) => metric.key === "asked_additional_service")
      ? "点検以外のご用命と、その他気になる点を確認しない場合は減点されますが、会話は進みます。"
      : "AIお客様の質問・引取依頼・断り理由は、毎回ランダムに変わります。";
  els.scenarioList.innerHTML = scenarios
    .map((item) => {
      const selected = item.id === scenario.id;
      return `
        <button class="scenario-card ${selected ? "is-selected" : ""}" type="button"
          data-scenario-id="${escapeHtml(item.id)}" aria-pressed="${selected}">
          <span class="scenario-type">${escapeHtml(item.type || "ロープレ")}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.description || "")}</span>
        </button>`;
    })
    .join("");
}

function selectScenario(scenarioId) {
  const selected = scenarios.find((item) => item.id === scenarioId);
  if (!selected || selected.id === scenario.id) return;
  stopSpeechInput();
  scenario = selected;
  state.started = false;
  state.ended = false;
  state.currentState = "START";
  state.turn = 0;
  state.scriptStep = 0;
  state.proposedAppointment = null;
  state.serviceTimeExplained = false;
  state.appointmentDateConfirmed = false;
  state.appointmentTimeConfirmed = false;
  state.additionalServiceAnswered = false;
  state.additionalServiceResumeState = null;
  state.transcript = [];
  state.analyses = [];
  state.scriptedPartialReplies = {};
  state.usedVariants = {};
  clearStaffInput();
  resetResults();
  updateVoiceSelection();
  renderScenarioList();
  renderConversation();
  renderProgress();
  els.staffInput.placeholder = scenario.mode === "staff-led-scripted"
    ? "スタッフから最初の電話応対を入力"
    : "スタッフとして返答を入力";
  els.speechNote.textContent = scenario.mode === "staff-led-scripted"
    ? "このシナリオはスタッフの発話から始まります。ロープレ開始後に本人確認をしてください。"
    : "AIお客様の発話後に音声入力が始まります。";
}

function renderProgress() {
  const currentIndex = state.started
    ? scenario.progress.findIndex((item) => item.state === state.currentState)
    : -1;
  els.progressStrip.innerHTML = scenario.progress
    .map((item) => {
      const itemIndex = scenario.progress.findIndex((p) => p.state === item.state);
      const klass = state.started && item.state === state.currentState
        ? "is-active"
        : itemIndex < currentIndex
          ? "is-done"
          : "";
      return `<div class="progress-item ${klass}">${item.label}</div>`;
    })
    .join("");
  const active = scenario.progress.find((item) => item.state === state.currentState);
  els.stateLabel.textContent = !state.started ? "開始前" : active ? active.label : "進行中";
}

function audioPath(audioId) {
  const item = audioIndex.get(audioId);
  if (!item || item.status !== "ready") return "";
  const voice = audioDb.voices?.[els.voiceSelect?.value] || audioDb.voices?.[audioDb.defaultVoice];
  const basePath = audioId.startsWith("inspection_")
    ? voice?.basePath
    : audioDb.basePath;
  return `${basePath || "audio/"}${item.file}`;
}

function updateVoiceSelection() {
  const voiceKey = els.voiceSelect?.value || audioDb.defaultVoice;
  const voice = audioDb.voices?.[voiceKey];
  if (!voice) return;
  localStorage.setItem("roleplayVoice", voiceKey);
  const usesVoicevox = scenario.id === "vehicle-inspection-phone-followup";
  if (els.voiceSelect) els.voiceSelect.disabled = !usesVoicevox;
  if (els.voiceCredit) {
    els.voiceCredit.textContent = usesVoicevox ? voice.credit : "従来音声";
    if (usesVoicevox) els.voiceCredit.href = voice.creditUrl;
    else els.voiceCredit.removeAttribute("href");
  }
}

function addMessage(role, text, options = {}) {
  const message = {
    role,
    text,
    at: new Date().toISOString(),
    audioId: options.audioId || "",
    audioSrc: audioPath(options.audioId)
  };
  state.transcript.push(message);
  renderConversation();
  if (role === "customer") {
    if (els.audioEnabled.checked && message.audioSrc) {
      playAudio(message.audioSrc, message.text, false, startSpeechInputAfterCustomer);
    } else if (els.audioEnabled.checked) {
      speakCustomerText(message.text, startSpeechInputAfterCustomer);
    } else {
      startSpeechInputAfterCustomer();
    }
  } else if (role !== "staff" && message.audioSrc && els.audioEnabled.checked) {
    playAudio(message.audioSrc, message.text, false);
  }
}

function renderConversation() {
  if (state.transcript.length === 0) {
    els.conversation.innerHTML = `
      <div class="empty-state">
        <strong>ロープレ開始を押してください</strong>
        <span>AIお客様役との会話がここに表示されます。</span>
      </div>`;
    return;
  }

  els.conversation.innerHTML = state.transcript
    .map((message, index) => {
      const roleClass = message.role === "customer" ? "customer" : message.role === "staff" ? "staff" : "system";
      const speaker = message.role === "customer" ? "AIお客様" : message.role === "staff" ? "スタッフ" : "判定メモ";
      const audioButton = message.role === "customer"
        ? `<button class="play-audio" type="button" data-audio-index="${index}" aria-label="お客様音声を再生">再生</button>`
        : "";
      const issueButton = message.role === "customer"
        ? `<button class="report-audio" type="button" data-report-audio-index="${index}" aria-label="矛盾または不足音声として記録">矛盾・音声不足を記録</button>`
        : "";
      return `
        <div class="message ${roleClass}">
          <div class="message-top">
            <span class="speaker">${speaker}</span>
            <span class="message-tools">${audioButton}${issueButton}</span>
          </div>
          <span>${escapeHtml(message.text)}</span>
        </div>`;
    })
    .join("");
  els.conversation.scrollTop = els.conversation.scrollHeight;
}

function playAudio(src, fallbackText = "", showMissingMessage = true, onFinished = null) {
  const audio = new Audio(src);
  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    if (typeof onFinished === "function") onFinished();
  };
  audio.addEventListener("ended", finishOnce, { once: true });
  audio.addEventListener("error", finishOnce, { once: true });
  audio.play().catch(() => {
    if (showMissingMessage) {
      addMessage("system", `音声ファイルを再生できませんでした: ${src}`);
    }
    finishOnce();
  });
}

function speakCustomerText(text, onFinished = null) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    if (typeof onFinished === "function") onFinished();
    return;
  }
  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    if (typeof onFinished === "function") onFinished();
  };
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 1.05;
  utterance.pitch = 1;
  utterance.addEventListener("end", finishOnce, { once: true });
  utterance.addEventListener("error", finishOnce, { once: true });
  window.speechSynthesis.speak(utterance);
}

function beginAutomaticSpeechInput(noteText) {
  if (!state.started || state.ended || speechListening) return false;
  if (!speechRecognition) {
    els.speechNote.textContent = "このブラウザでは音声入力を利用できません。テキスト入力で練習できます。";
    return false;
  }

  clearStaffInput();
  speechListening = true;
  updateMicButton(true);
  els.speechNote.textContent = noteText;
  try {
    speechRecognition.start();
    return true;
  } catch (_) {
    speechListening = false;
    updateMicButton(false);
    els.speechNote.textContent = "音声入力を開始できませんでした。マイクボタンを押してください。";
    return false;
  }
}

function startSpeechInputAfterCustomer() {
  window.setTimeout(() => {
    beginAutomaticSpeechInput("AIお客様の発話が終了しました。音声入力中です。話し終えたら送信を押してください。");
  }, 180);
}

function startSpeechInputForStaffOpening() {
  beginAutomaticSpeechInput("音声入力中です。お客様のお名前を確認する発話から始めてください。");
}

function clearStaffInput() {
  els.staffInput.value = "";
  speechBaseText = "";
  lastAcknowledgedText = "";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function looksLikeCompleteJapaneseSentence(text) {
  const normalized = text.replace(/\s+/g, "").trim();
  if (!normalized) return false;
  const completeShortReplies = [
    "はい", "いいえ", "大丈夫です", "いいですよ", "良いですよ",
    "わかりました", "分かりました", "承知しました", "かしこまりました", "行きます", "いきます"
  ];
  if (completeShortReplies.includes(normalized)) return true;
  if (normalized.length < 5) return false;
  return /(?:です|ます|ました|ません|でしょう|ください|お願いします|と思います|できます|できません|出来ます|出来ません|伺います|行きます|します|ですか|ますか|でしょうか|[。！？!?])$/.test(normalized);
}

function acknowledgeAndContinue(text) {
  if (!speechListening || state.ended || text === lastAcknowledgedText) return;
  lastAcknowledgedText = text;
  speechPausedForAck = true;
  try {
    speechRecognition.abort();
  } catch (_) {
    speechPausedForAck = false;
  }

  const resume = () => {
    speechPausedForAck = false;
    if (!speechListening || state.ended) return;
    speechBaseText = els.staffInput.value.trim();
    window.setTimeout(() => {
      try {
        speechRecognition.start();
        els.speechNote.textContent = "続きを聞いています。話し終えると自動的に次へ進みます。";
      } catch (_) {
        els.speechNote.textContent = "続きを聞き取れませんでした。マイクボタンを押してください。";
      }
    }, 120);
  };

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("はい");
    utterance.lang = "ja-JP";
    utterance.rate = 1.15;
    utterance.volume = 0.75;
    utterance.addEventListener("end", resume, { once: true });
    utterance.addEventListener("error", resume, { once: true });
    window.speechSynthesis.speak(utterance);
  } else {
    resume();
  }
}

function startRoleplay() {
  stopSpeechInput();
  state.started = true;
  state.ended = false;
  state.currentState = scenario.mode === "staff-led-scripted"
    ? scenario.steps[0].state
    : "INSPECTION_REQUEST_RECEIVED";
  state.turn = 0;
  state.scriptStep = 0;
  state.proposedAppointment = null;
  state.variantSeed = Math.floor(Math.random() * 1000);
  state.pickupReason = null;
  state.currentObjection = null;
  state.resolutionType = null;
  state.serviceTimeExplained = false;
  state.appointmentDateConfirmed = false;
  state.appointmentTimeConfirmed = false;
  state.additionalServiceAnswered = false;
  state.additionalServiceResumeState = null;
  state.transcript = [];
  state.analyses = [];
  state.scriptedPartialReplies = {};
  state.usedVariants = {};
  resetResults();
  if (scenario.mode === "staff-led-scripted") {
    addMessage("system", scenario.startInstruction);
    startSpeechInputForStaffOpening();
  } else {
    addMessage("customer", scenario.initialCustomerMessage, { audioId: scenario.audio.initial });
  }
  renderProgress();
  els.staffInput.focus();
}

function resetResults() {
  els.scoreBadge.textContent = "未採点";
  els.scoreNumber.textContent = "--";
  els.scoreSummary.textContent = "ロープレ終了後に表示されます。";
  els.goodList.innerHTML = "";
  els.improveList.innerHTML = "";
  els.judgementList.innerHTML = "";
  els.recommendedTalk.textContent = "結果に応じて表示されます。";
}

function analyzeStaff(text) {
  const normalized = text.replace(/\s+/g, "");
  const isQuestion = /[？?]$/.test(text) || includesAny(normalized, ["でしょうか", "ですか", "ますか", "ませんか", "ないですか", "ございませんか", "でしょう"]);
  const isQuote = /「.*伺.*」|'.*伺.*'|以前|言った|ということ/.test(text);
  const hasConfirmedPickupWords = includesAny(normalized, lexicon.confirmedPickup);
  const isPickupRequestTurn = isActivePickupRequest();
  const shortPickupAgreement = isPickupRequestTurn
    && includesAny(normalized, [
      "いいですよ", "良いですよ", "行きます", "いきます", "大丈夫です",
      "わかりました", "分かりました", "承知しました", "かしこまりました"
    ])
    && !isQuestion
    && !isQuote
    && !includesAny(normalized, ["難しい", "できません", "出来ません", "無理", "確認します", "検討します"]);
  const forcePickupAcceptance = includesAny(normalized, [
    "取りに行きます", "取りに伺います", "お取りに伺います",
    "車を取りに行きます", "車を取りに伺います", "引取に伺います",
    "引き取りに伺います", "引き取りに行きます"
  ]) && !isQuestion && !isQuote || shortPickupAgreement;
  const hasConcretePickup = includesAny(normalized, lexicon.location) || includesAny(normalized, lexicon.timing);
  const conditional = includesAny(normalized, ["可能ですが", "できますが", "場合", "検討", "まず", "ご来店", "難しい場合"]);

  let pickupStrength = "none";
  if (forcePickupAcceptance) {
    pickupStrength = "confirmed";
  } else if (hasConfirmedPickupWords && !isQuestion && !isQuote) {
    pickupStrength = hasConcretePickup ? "confirmed" : conditional ? "conditional" : "possible";
  }
  if (conditional && pickupStrength === "none" && includesAny(normalized, ["引取", "引き取り", "取りに"])) {
    pickupStrength = "conditional";
  }

  const acceptedPickup = forcePickupAcceptance || (pickupStrength === "confirmed" && hasConcretePickup && !conditional);
  const hasConcreteServiceTime = includesAny(normalized, lexicon.serviceTime);
  const hasActionableProposal = includesAny(normalized, lexicon.weekend)
    || includesAny(normalized, lexicon.otherStore)
    || includesAny(normalized, ["時間帯", "午前", "午後", "代車", "ご主人", "ご家族", "家族と一緒", "一緒にご来店"]);
  const proposedTime = includesAny(normalized, ["時間帯", "午前", "午後", "夕方", "仕事前", "仕事後"]);
  const proposedFamilyVisit = includesAny(normalized, ["ご主人", "ご家族", "家族と一緒", "一緒にご来店"]);
  const hasScheduleDate = /(?:\d{1,2}月)?\d{1,2}日|(?:今週|来週|再来週)?(?:月|火|水|木|金|土|日)曜日/.test(normalized);
  const hasScheduleTime = /\d{1,2}時|午前|午後|朝|夕方/.test(normalized);
  const hasConcreteSchedule = hasScheduleDate && hasScheduleTime;
  const hasConcreteExplanation = hasConcreteServiceTime
    || hasActionableProposal
    || includesAny(normalized, lexicon.visitBenefit)
    || /\d+(?:分|時間|日|時|円|km|キロ)/i.test(normalized)
    || includesAny(normalized, [
      "標準作業", "追加作業", "作業内容", "点検内容", "整備内容", "交換部品",
      "お車の状態", "車両の状態", "混雑状況", "予約状況", "部品", "不具合",
      "場合は", "場合に", "内容によって", "状況によって", "確認してから"
    ]);
  const hasHedgingExpression = includesAny(normalized, ["一応", "場合によって", "たぶん", "かもしれ", "と思います"])
    || text.trim().endsWith("...");
  const ambiguous = hasHedgingExpression
    && !hasConcreteExplanation
    && !acceptedPickup;

  const result = {
    acknowledged_request: includesAny(normalized, lexicon.thanks) || includesAny(normalized, ["承知", "かしこまり", "そうなのですね"]),
    asked_additional_service: isQuestion
      && includesAny(normalized, lexicon.additionalService)
      && includesAny(normalized, lexicon.vehicleConcern),
    accepted_pickup: acceptedPickup,
    pickup_acceptance_strength: pickupStrength,
    asked_reason: includesAny(normalized, lexicon.reasonQuestion),
    explained_service_time: hasConcreteServiceTime,
    explained_visit_benefit: includesAny(normalized, lexicon.visitBenefit),
    proposed_weekend: includesAny(normalized, lexicon.weekend),
    proposed_other_store: includesAny(normalized, lexicon.otherStore),
    proposed_time: proposedTime,
    proposed_family_visit: proposedFamilyVisit,
    has_schedule_date: hasScheduleDate,
    has_schedule_time: hasScheduleTime,
    has_concrete_schedule: hasConcreteSchedule,
    mentioned_previous_pickup: includesAny(normalized, ["以前", "前回", "前に", "取りに来ると", "取りに伺うと"]),
    proposed_alternative: hasActionableProposal,
    pressured_customer: includesAny(normalized, lexicon.pressure),
    refused_pickup: includesAny(normalized, ["引取できません", "取りに行けません", "対応できません"]),
    left_choice: includesAny(normalized, lexicon.choice) || conditional,
    next_action_confirmed: includesAny(normalized, lexicon.nextAction),
    ambiguous,
    evidence: collectEvidence(normalized)
  };

  result.decision = decide(result);
  result.confidence = confidenceFor(result);
  state.analyses.push(result);
  return result;
}

function collectEvidence(text) {
  const evidence = [];
  Object.values(lexicon).flat().forEach((word) => {
    if (text.includes(word) && evidence.length < 6) evidence.push(word);
  });
  return evidence;
}

function decide(analysis) {
  if (analysis.ambiguous) return "needs_more_context";
  if (analysis.accepted_pickup) return "pickup_accepted_immediately";
  if (analysis.explained_visit_benefit || analysis.proposed_alternative || analysis.asked_reason) {
    return "continue_visit_promotion";
  }
  return "continue";
}

function confidenceFor(analysis) {
  if (analysis.ambiguous) return 0.48;
  if (analysis.accepted_pickup) return 0.9;
  if (analysis.explained_visit_benefit || analysis.proposed_alternative) return 0.84;
  return 0.68;
}

function customerTurn(text, audioId = "") {
  return { text, audioId };
}

function customerTurnFromAudio(audioId, fallbackText = "") {
  const item = audioIndex.get(audioId);
  return customerTurn(item?.text || fallbackText, audioId);
}

function pickupRequestTurn() {
  state.currentState = "PICKUP_REQUEST";
  const index = pickRandomIndex(scenario.pickupRequests, "pickup-request");
  state.pickupReason = classifyCustomerReason(scenario.pickupRequests[index]);
  return customerTurn(scenario.pickupRequests[index], scenario.audio.pickupRequests[index]);
}

function randomIndex(length) {
  if (length <= 1) return 0;
  if (window.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] % length;
  }
  return Math.floor(Math.random() * length);
}

function pickRandomIndex(values, group) {
  if (!Array.isArray(values) || values.length === 0) return -1;
  const used = state.usedVariants[group] || [];
  const available = values
    .map((_, index) => index)
    .filter((index) => !used.includes(index));
  const pool = available.length > 0 ? available : values.map((_, index) => index);
  const selected = pool[randomIndex(pool.length)];
  state.usedVariants[group] = available.length > 0 ? [...used, selected] : [selected];
  return selected;
}

function pickVariant(values, group = "default") {
  if (!Array.isArray(values)) return values;
  if (values.length === 0) return "";
  return values[pickRandomIndex(values, group)];
}

function nextCustomerMessage(analysis) {
  if (analysis.explained_service_time) state.serviceTimeExplained = true;
  if (["ALTERNATIVE_PROPOSAL", "APPOINTMENT_CONFIRMATION"].includes(state.currentState)) {
    if (analysis.has_schedule_date) state.appointmentDateConfirmed = true;
    if (analysis.has_schedule_time) state.appointmentTimeConfirmed = true;
  }

  if (analysis.decision === "pickup_accepted_immediately") {
    state.currentState = "PICKUP_REQUEST";
    state.ended = true;
    return customerTurn("はい、お願いします。", scenario.audio.acceptedPickup);
  }

  if (analysis.decision === "needs_more_context") {
    return customerTurnFromAudio(
      scenario.audio.needsMoreContext,
      "おっしゃっていることがよく分からないんですけど。"
    );
  }

  if (
    scenario.scoring.some((metric) => metric.key === "asked_additional_service")
    && analysis.asked_additional_service
    && !state.additionalServiceAnswered
  ) {
    state.additionalServiceAnswered = true;
    state.additionalServiceResumeState = state.currentState;
    state.currentState = "ADDITIONAL_SERVICE_REQUEST";
    return customerTurnFromAudio(
      scenario.audio.additionalServiceRequest,
      "オイル交換もお願いします。"
    );
  }

  if (state.currentState === "INSPECTION_REQUEST_RECEIVED") {
    if (state.serviceTimeExplained) return pickupRequestTurn();
    state.currentState = "SERVICE_TIME_QUESTION";
    const index = pickRandomIndex(scenario.serviceTimeQuestions, "service-time");
    return customerTurn(
      scenario.serviceTimeQuestions[index],
      scenario.audio.serviceTimeQuestions[index]
    );
  }

  if (state.currentState === "ADDITIONAL_SERVICE_REQUEST") {
    if (analysis.asked_additional_service) {
      state.currentState = "ADDITIONAL_SERVICE_RECONFIRMATION";
      return customerTurnFromAudio(
        scenario.audio.additionalServiceNone,
        "そのほかは大丈夫です。"
      );
    }
    const resumeState = state.additionalServiceResumeState || "INSPECTION_REQUEST_RECEIVED";
    state.additionalServiceResumeState = null;
    state.currentState = resumeState;
    return nextCustomerMessage(analysis);
  }

  if (state.currentState === "ADDITIONAL_SERVICE_RECONFIRMATION") {
    const resumeState = state.additionalServiceResumeState || "INSPECTION_REQUEST_RECEIVED";
    state.additionalServiceResumeState = null;
    state.currentState = resumeState;
    return nextCustomerMessage(analysis);
  }

  if (state.currentState === "SERVICE_TIME_QUESTION") {
    return pickupRequestTurn();
  }

  if (state.currentState === "PICKUP_REQUEST") {
    const directAgreement = selectContextualCustomerResponse(analysis);
    if (directAgreement) {
      state.currentState = "ALTERNATIVE_PROPOSAL";
      return directAgreement;
    }
    state.currentState = "VISIT_PROPOSAL";
    state.currentObjection = selectObjection(analysis);
    const objection = scenario.objections[state.currentObjection];
    const objectionTexts = objection.customer;
    const objectionAudio = scenario.audio.objections[state.currentObjection];
    const index = state.pickupReason === "drivingConfidence"
      ? objectionTexts.findIndex((text) => text.includes("運転に自信"))
      : pickRandomIndex(objectionTexts, `objection-${state.currentObjection}`);
    return customerTurn(
      objectionTexts[index >= 0 ? index : 0],
      objectionAudio[index >= 0 ? index : 0]
    );
  }

  if (state.currentState === "VISIT_PROPOSAL") {
    state.currentState = "ALTERNATIVE_PROPOSAL";
    const contextualResponse = selectContextualCustomerResponse(analysis);
    if (contextualResponse) return contextualResponse;
    return customerTurnFromAudio(
      scenario.audio.needsMoreContext,
      "おっしゃっていることがよく分からないんですけど。"
    );
  }

  if (state.currentState === "ALTERNATIVE_PROPOSAL") {
    if (state.appointmentDateConfirmed && state.appointmentTimeConfirmed) {
      state.ended = true;
      return customerTurnFromAudio(scenario.audio.closings[0], "では、その日にお願いします。");
    }
    state.currentState = "APPOINTMENT_CONFIRMATION";
    return appointmentFollowUpTurn();
  }

  if (state.currentState === "APPOINTMENT_CONFIRMATION") {
    if (state.appointmentDateConfirmed && state.appointmentTimeConfirmed) {
      state.ended = true;
      return customerTurnFromAudio(scenario.audio.closings[0], "では、その日にお願いします。");
    }
    return appointmentFollowUpTurn();
  }

  return customerTurn("ありがとうございます。続けてお願いします。", "");
}

function selectObjection(analysis) {
  const linkedObjection = {
    work: "work",
    distance: "distance",
    drivingConfidence: "distance",
    competitor: "competitor",
    misunderstanding: "misunderstanding",
    family: "family"
  }[state.pickupReason];
  if (linkedObjection) return linkedObjection;

  // 家族相談は引取希望の理由ではないため、理由確認直後のランダム回答には使用しない。
  const candidates = ["work", "distance"];
  if (analysis.proposed_other_store) candidates.push("competitor");
  if (analysis.mentioned_previous_pickup) candidates.push("misunderstanding");
  return candidates[randomIndex(candidates.length)];
}

function appointmentFollowUpTurn() {
  const index = state.appointmentDateConfirmed
    ? 2
    : pickRandomIndex(scenario.audio.followUps.slice(0, 2), "appointment-date-follow-up");
  const fallbackTexts = [
    "では、いつなら空いていますか？",
    "今週だと空いている日はありますか？",
    "午前中と午後ならどちらが空いていますか？"
  ];
  return customerTurnFromAudio(scenario.audio.followUps[index], fallbackTexts[index]);
}

function selectContextualCustomerResponse(analysis) {
  const reason = state.pickupReason || state.currentObjection;
  if (reason === "family") {
    state.resolutionType = "familyConsultation";
    return customerTurn("ありがとうございます。家族と相談して、改めてご連絡します。");
  }
  if (reason === "misunderstanding") {
    if (analysis.acknowledged_request || analysis.left_choice) {
      state.resolutionType = "clarified";
      return customerTurn("分かりました。では、負担の少ない方法を相談させてください。");
    }
    return null;
  }
  if (["distance", "drivingConfidence"].includes(reason)) {
    if (analysis.proposed_other_store || analysis.proposed_family_visit) {
      state.resolutionType = "nearbyOrFamily";
      return customerTurn("近い店舗や家族と一緒なら、来店できるかもしれません。");
    }
    return null;
  }
  if (reason === "competitor") {
    if (analysis.explained_visit_benefit || analysis.left_choice) {
      state.resolutionType = "visitBenefit";
      return customerTurnFromAudio(scenario.audio.possibleAgreements[2], "それなら店に行ってみます。");
    }
    return null;
  }
  if (reason === "work") {
    if (analysis.proposed_weekend) {
      state.resolutionType = "weekend";
      return customerTurnFromAudio(scenario.audio.possibleAgreements[0], "土日なら行けるかもしれません。");
    }
    if (analysis.proposed_time) {
      state.resolutionType = "time";
      return customerTurnFromAudio(scenario.audio.possibleAgreements[1], "その時間なら行けそうです。");
    }
    return null;
  }
  if (analysis.proposed_weekend) {
    state.resolutionType = "weekend";
    return customerTurnFromAudio(scenario.audio.possibleAgreements[0], "土日なら行けるかもしれません。");
  }
  if (analysis.proposed_time) {
    state.resolutionType = "time";
    return customerTurnFromAudio(scenario.audio.possibleAgreements[1], "その時間なら行けそうです。");
  }
  if (analysis.explained_visit_benefit) {
    state.resolutionType = "visitBenefit";
    return customerTurnFromAudio(scenario.audio.possibleAgreements[2], "それなら店に行ってみます。");
  }
  return null;
}

function analyzeScriptedStaff(text, step) {
  const normalized = text.replace(/\s+/g, "");
  const matchedGroups = step.requiredGroups.map((group) => group.filter((word) => normalized.includes(word)));
  let passed = matchedGroups.every((matches) => matches.length > 0)
    && scriptedStepSpecificMatches(normalized, step);

  if (step.key === "proposed_appointment") {
    const appointmentMatch = normalized.match(/(\d{1,2})月(\d{1,2})日.*?(\d{1,2})時/);
    passed = Boolean(passed && appointmentMatch);
    if (passed) {
      state.proposedAppointment = {
        month: appointmentMatch[1],
        day: appointmentMatch[2],
        hour: appointmentMatch[3]
      };
    }
  }

  if (step.key === "recapped_appointment") {
    const appointment = state.proposedAppointment;
    passed = Boolean(
      passed
      && appointment
      && normalized.includes(`${appointment.month}月`)
      && normalized.includes(`${appointment.day}日`)
      && normalized.includes(`${appointment.hour}時`)
    );
  }
  const canAdvance = passed || step.advanceOnFailure === true;
  const analysis = {
    scripted: true,
    stepKey: step.key,
    expected: step.expected,
    passed,
    canAdvance,
    blocked: !canAdvance,
    confidence: passed ? 0.95 : 0.55,
    evidence: matchedGroups.flat().slice(0, 8)
  };
  analysis[step.key] = passed;
  state.analyses.push(analysis);
  return analysis;
}

function scriptedStepMatches(text, step) {
  const normalized = text.replace(/\s+/g, "");
  return step.requiredGroups.every((group) =>
    group.some((word) => normalized.includes(word))
  ) && scriptedStepSpecificMatches(normalized, step);
}

function isScriptedQuestion(normalized) {
  return /(?:でしょうか|ますか|ですか|ませんか|ございませんか|[?？])/.test(normalized);
}

function scriptedStepSpecificMatches(normalized, step) {
  if (step.key === "confirmed_identity") {
    const customerName = String(scenario.customerName || "佐藤")
      .replace(/様/g, "")
      .replace(/\s+/g, "");
    const acceptedNames = new Set([customerName, "佐藤", "斉藤"]);
    return [...acceptedNames].filter(Boolean).some((name) => normalized.includes(name));
  }

  if (step.key === "introduced_self") {
    return /(?:トヨタモビリティ(?:帯広)?|トヨタ).{0,16}(?:の|、).{1,12}(?:です|と申します)/.test(normalized);
  }

  if (step.key === "confirmed_waiting") {
    return isScriptedQuestion(normalized);
  }

  if (step.key === "asked_vehicle_concerns") {
    return isScriptedQuestion(normalized);
  }

  return true;
}

function hasCourtesyExpression(text) {
  const normalized = text.replace(/\s+/g, "");
  return /(?:お世話になって(?:おります|います)|ありがとうございます|感謝)/.test(normalized);
}

function isAffirmativeScriptedReply(text) {
  const normalized = text.replace(/[\s、。,.!?！？]/g, "");
  return /^(?:はい|ええ|もちろん|大丈夫|できます|可能です|はいできます|もちろんできます|大丈夫です)$/.test(normalized);
}

function combinedScriptedReply(text, step) {
  const pending = state.scriptedPartialReplies[step.key];
  if (!pending) return text;

  const parts = [pending.text, text];
  if (isAffirmativeScriptedReply(text)) {
    if (pending.missingDetail === "waiting") {
      parts.push("店内で待つことができます");
    }
    if (pending.missingDetail === "reminderDestination") {
      parts.push("携帯へ連絡します");
    }
  }
  return parts.filter(Boolean).join(" ");
}

function scriptedRetryForMissingDetails(text, step) {
  const normalized = text.replace(/\s+/g, "");

  if (step.key === "explained_duration_and_wait") {
    const hasDuration = ["1時間", "一時間", "60分"].some((word) => normalized.includes(word));
    const hasWaiting = ["待", "店内"].some((word) => normalized.includes(word));
    if (hasDuration && !hasWaiting) {
      return {
        text: "店内で待つことはできますか？",
        audioId: "inspection_duration_wait_missing_retry",
        missingDetail: "waiting"
      };
    }
  }

  if (step.key === "confirmed_reminder_contact") {
    const hasReminder = ["3日前", "三日前"].some((word) => normalized.includes(word))
      && normalized.includes("連絡");
    const hasDestination = ["どちら", "携帯", "電話番号"].some((word) => normalized.includes(word));
    if (hasReminder && !hasDestination) {
      return {
        text: "連絡先は、この携帯でいいですか？",
        audioId: "inspection_reminder_destination_missing_retry",
        missingDetail: "reminderDestination"
      };
    }
  }

  return {
    text: step.retryResponse,
    audioId: `inspection_${step.key}_retry`,
    missingDetail: null
  };
}

function isPhoneGreetingOnly(text) {
  const normalized = text.replace(/[\s、。,.!?！？]/g, "");
  return /^(?:もしもし|はいもしもし|もしもしお世話になっております)$/.test(normalized);
}

function hasScriptedClosingIntent(text) {
  const normalized = text.replace(/\s+/g, "");
  const isQuestion = /(?:でしょうか|ますか|ですか|[?？])/.test(normalized);
  if (isQuestion) return false;

  return [
    /当日.*お待ち/,
    /ご?予約.*承り/,
    /以上.*(?:予約|案内)/,
    /これで.*(?:予約|案内)/,
    /ありがとうございました/
  ].some((pattern) => pattern.test(normalized));
}

function recordOptionalShortcutEvidence(text, startIndex, closingIndex) {
  const normalized = text.replace(/\s+/g, "");
  const appointment = state.proposedAppointment;

  scenario.steps.slice(startIndex, closingIndex).forEach((step) => {
    if (!step.optionalAfterAppointment) return;
    const matchedGroups = step.requiredGroups.map((group) => group.filter((word) => normalized.includes(word)));
    let passed = matchedGroups.every((matches) => matches.length > 0);

    if (step.key === "recapped_appointment") {
      passed = Boolean(
        passed
        && appointment
        && normalized.includes(`${appointment.month}月`)
        && normalized.includes(`${appointment.day}日`)
        && normalized.includes(`${appointment.hour}時`)
      );
    }
    if (!passed) return;

    const analysis = {
      scripted: true,
      stepKey: step.key,
      expected: step.expected,
      passed: true,
      canAdvance: true,
      blocked: false,
      confidence: 0.95,
      evidence: matchedGroups.flat().slice(0, 8)
    };
    analysis[step.key] = true;
    state.analyses.push(analysis);
  });
}

function handleScriptedStaffReply(text) {
  const step = scenario.steps[state.scriptStep];
  if (!step) {
    finishRoleplay();
    return;
  }

  if (step.key === "confirmed_identity" && isPhoneGreetingOnly(text)) {
    state.turn += 1;
    addMessage("customer", "はい、もしもし。", {
      audioId: "inspection_phone_greeting_customer"
    });
    els.speechNote.textContent = "電話の挨拶を受けました。続けて、お客様のお名前を確認してください。";
    renderProgress();
    return;
  }

  if (step.key === "confirmed_identity" && !scriptedStepMatches(text, step)) {
    const introductionStep = scenario.steps.find((item) => item.key === "introduced_self");
    if (introductionStep && scriptedStepMatches(text, introductionStep)) {
      analyzeScriptedStaff(text, step);
      analyzeScriptedStaff(text, introductionStep);
      state.turn += 1;
      addMessage("customer", "はい。どちらにおかけですか？", {
        audioId: "inspection_identity_missing_after_introduction"
      });
      els.speechNote.textContent = "店舗名と担当者名は確認できました。続けて、お客様のお名前を確認してください。";
      renderProgress();
      return;
    }
  }

  const closingIntent = hasScriptedClosingIntent(text);
  const closingIndex = scenario.steps.findIndex((item) => item.key === "closed_politely");

  if (closingIntent && !state.proposedAppointment) {
    const analysis = {
      scripted: true,
      stepKey: step.key,
      expected: "入庫する日付と時間を確定する",
      passed: false,
      canAdvance: false,
      blocked: true,
      confidence: 0.95,
      evidence: []
    };
    analysis[step.key] = false;
    state.analyses.push(analysis);
    state.turn += 1;
    addMessage("customer", "いつ行けばいいんですか？", {
      audioId: "inspection_missing_appointment_angry"
    });
    els.speechNote.textContent = "入庫に必要な最低限の確認として、予約の日付と時間を確定してください。";
    renderProgress();
    return;
  }

  if (
    closingIntent
    && state.proposedAppointment
    && step.optionalAfterAppointment
    && closingIndex > state.scriptStep
  ) {
    recordOptionalShortcutEvidence(text, state.scriptStep, closingIndex);
    state.turn += 1;
    state.scriptStep = closingIndex;
    state.currentState = scenario.steps[closingIndex].state;
    addMessage("customer", "お願いします。", {
      audioId: "inspection_recapped_appointment_customer"
    });
    els.speechNote.textContent = "入庫日時が確定したため、最後の挨拶へ進みました。省略した案内は採点結果の改善点に表示されます。";
    renderProgress();
    return;
  }

  const combinedText = combinedScriptedReply(text, step);
  const analysis = analyzeScriptedStaff(combinedText, step);
  state.turn += 1;

  if (!analysis.canAdvance) {
    const retry = scriptedRetryForMissingDetails(combinedText, step);
    state.scriptedPartialReplies[step.key] = {
      text: combinedText,
      missingDetail: retry.missingDetail
    };
    addMessage("customer", retry.text, {
      audioId: retry.audioId
    });
    els.speechNote.textContent = `不足している案内があります。現在の課題: ${step.expected}`;
    renderProgress();
    return;
  }

  delete state.scriptedPartialReplies[step.key];

  let responseStep = step;
  state.scriptStep += 1;

  // 先に名乗りが済んでから本人確認へ戻った場合は、名乗りを繰り返させない。
  while (
    state.scriptStep < scenario.steps.length
    && state.analyses.some((item) =>
      item.stepKey === scenario.steps[state.scriptStep].key && item.passed
    )
  ) {
    state.scriptStep += 1;
  }

  // スタッフが本人確認・名乗りなどを一度に話した場合は、
  // 同じ発話で実際に満たした連続ステップもまとめて判定する。
  while (state.scriptStep < scenario.steps.length) {
    const nextStep = scenario.steps[state.scriptStep];
    const matchesNextStep = scriptedStepMatches(text, nextStep);
    const hasCombinedCourtesy = nextStep.key === "thanked_customer"
      && hasCourtesyExpression(text);
    if (!matchesNextStep && !hasCombinedCourtesy) break;

    const nextAnalysis = analyzeScriptedStaff(text, nextStep);
    if (!nextAnalysis.canAdvance) break;
    responseStep = nextStep;
    state.scriptStep += 1;
  }

  const finished = state.scriptStep >= scenario.steps.length;
  if (finished) {
    state.ended = true;
  } else {
    state.currentState = scenario.steps[state.scriptStep].state;
  }
  const useAdvanceRetry = responseStep === step
    && !analysis.passed
    && step.advanceOnFailure === true
    && !hasCourtesyExpression(text);
  addMessage("customer", useAdvanceRetry ? step.retryResponse : responseStep.customerResponse, {
    audioId: useAdvanceRetry
      ? `inspection_${step.key}_retry`
      : `inspection_${responseStep.key}_customer`
  });
  renderProgress();
  if (finished) finishRoleplay();
}

function handleReply(event) {
  event.preventDefault();
  if (!state.started || state.ended) return;
  const text = els.staffInput.value.trim();
  if (!text) return;

  stopSpeechInput();
  clearStaffInput();
  addMessage("staff", text);
  if (scenario.mode === "staff-led-scripted") {
    handleScriptedStaffReply(text);
    return;
  }
  const analysis = analyzeStaff(text);
  state.turn += 1;

  if (analysis.decision === "pickup_accepted_immediately") {
    state.ended = true;
    addMessage("system", "引取を検出しました。ロープレを終了します。", {
      audioId: scenario.audio.pickupDetectedEnd
    });
    finishRoleplay();
    return;
  }

  const customer = nextCustomerMessage(analysis);
  addMessage("customer", customer.text, { audioId: customer.audioId });

  renderProgress();
  if (state.ended) finishRoleplay();
}

function finishRoleplay() {
  stopSpeechInput();
  if (!state.started) return;
  state.ended = true;
  const result = scoreRoleplay();
  renderResults(result);
  renderProgress();
}

function scoreRoleplay() {
  if (scenario.mode === "staff-led-scripted") return scoreScriptedRoleplay();

  const merged = state.analyses.reduce((acc, item) => {
    scenario.scoring.forEach((metric) => {
      acc[metric.key] = Boolean(acc[metric.key] || item[metric.key]);
    });
    acc.accepted_pickup = Boolean(acc.accepted_pickup || item.accepted_pickup);
    acc.pressured_customer = Boolean(acc.pressured_customer || item.pressured_customer);
    acc.refused_pickup = Boolean(acc.refused_pickup || item.refused_pickup);
    acc.proposed_time = Boolean(acc.proposed_time || item.proposed_time);
    acc.proposed_family_visit = Boolean(acc.proposed_family_visit || item.proposed_family_visit);
    return acc;
  }, {});

  const reason = state.pickupReason || state.currentObjection;
  const applicableMetrics = scenario.scoring.filter((metric) => {
    if (metric.key === "proposed_weekend") return !reason || reason === "work";
    if (metric.key === "proposed_other_store") {
      return !reason || ["distance", "drivingConfidence"].includes(reason);
    }
    return true;
  });
  const metricAchieved = (metric) => {
    if (metric.key === "proposed_other_store" && ["distance", "drivingConfidence"].includes(reason)) {
      return Boolean(merged.proposed_other_store || merged.proposed_family_visit);
    }
    return Boolean(merged[metric.key]);
  };
  const applicableMaximum = applicableMetrics.reduce((sum, metric) => sum + metric.points, 0);
  const earnedPoints = applicableMetrics.reduce(
    (sum, metric) => sum + (metricAchieved(metric) ? metric.points : 0),
    0
  );
  let score = applicableMaximum > 0 ? Math.round((earnedPoints / applicableMaximum) * 100) : 0;
  const penalties = [];

  if (merged.accepted_pickup && !merged.explained_visit_benefit) {
    score -= 25;
    penalties.push("来店提案前に引取を確定した可能性があります");
  }
  if (merged.pressured_customer) {
    score -= 10;
    penalties.push("来店を強く迫る表現がありました");
  }
  if (merged.refused_pickup) {
    score -= 10;
    penalties.push("引取を強く拒否する表現がありました");
  }
  if (!proposalMatchesCustomerReason(merged)) {
    score -= 15;
    penalties.push("お客様の事情に合った提案を選ぶ必要があります");
  }

  score = Math.max(0, Math.min(100, score));

  const good = [];
  const improve = [];
  applicableMetrics.forEach((metric) => {
    const action = metric.action || metric.label;
    if (metricAchieved(metric)) good.push(`${action}ことができています`);
    else improve.push(`${action}ことを意識すると、より良い応対になります`);
  });
  penalties.forEach((penalty) => improve.unshift(penalty));

  return {
    score,
    good: good.slice(0, 4),
    improve: improve.slice(0, 4),
    recommendedTalk: selectRecommendedTalk(),
    judgements: state.analyses.map((analysis, index) => {
      const strength = analysis.pickup_acceptance_strength;
      const confidence = Math.round(analysis.confidence * 100);
      return `${index + 1}回目: 引取確定度 ${strength} / 信頼度 ${confidence}%`;
    })
  };
}

function scoreScriptedRoleplay() {
  const achieved = {};
  scenario.scoring.forEach((metric) => {
    achieved[metric.key] = state.analyses.some((analysis) => analysis[metric.key] === true);
  });

  const retryCount = state.analyses.filter((analysis) => analysis.scripted && analysis.blocked).length;
  const baseScore = scenario.scoring.reduce(
    (sum, metric) => sum + (achieved[metric.key] ? metric.points : 0),
    0
  );
  const score = Math.max(0, Math.min(100, baseScore - Math.min(20, retryCount * 2)));
  const good = scenario.scoring
    .filter((metric) => achieved[metric.key])
    .map((metric) => `${metric.action}ことができています`);
  const improve = scenario.scoring
    .filter((metric) => !achieved[metric.key])
    .map((metric) => `${metric.action}ことを意識すると、より良い応対になります`);
  if (retryCount > 0) {
    improve.unshift(`案内不足によるお客様の聞き返しが${retryCount}回ありました`);
  }

  const judgements = scenario.scoring.map((metric) => {
    const attempts = state.analyses.filter((analysis) => analysis.stepKey === metric.key);
    const status = achieved[metric.key] ? "○" : "要改善";
    return `${metric.label}: ${status}${attempts.length > 1 ? `（${attempts.length}回発話）` : ""}`;
  });

  return {
    score,
    good: good.slice(0, 4),
    improve: improve.slice(0, 4),
    recommendedTalk: scenario.recommendedTalk,
    judgements,
    summary: score >= 90
      ? "車検誘致の電話応対を、予約確定から事前案内まで正確に完結できています。"
      : score >= 70
        ? "基本の流れはできています。案内漏れを減らすと、より安定した電話応対になります。"
        : "本人確認から予約復唱まで、車検誘致の電話手順を順番に練習しましょう。"
  };
}

function selectRecommendedTalk() {
  const customerText = state.transcript
    .filter((message) => message.role === "customer")
    .map((message) => message.text)
    .join(" ");

  const transcriptReason = classifyCustomerReason(customerText);
  const reason = transcriptReason || state.pickupReason || state.currentObjection || "work";
  return scenario.recommendedTalks?.[reason] || scenario.recommendedTalk;
}

function proposalMatchesCustomerReason(analysis) {
  const reason = state.pickupReason || state.currentObjection;
  if (!reason) return true;
  if (reason === "work") return Boolean(analysis.proposed_weekend || analysis.proposed_time);
  if (["distance", "drivingConfidence"].includes(reason)) {
    return Boolean(analysis.proposed_other_store || analysis.proposed_family_visit);
  }
  if (reason === "competitor") return Boolean(analysis.explained_visit_benefit);
  if (reason === "misunderstanding") {
    return Boolean(analysis.acknowledged_request && (analysis.asked_reason || analysis.explained_visit_benefit));
  }
  if (reason === "family") return Boolean(analysis.left_choice && analysis.next_action_confirmed);
  return true;
}

function renderResults(result) {
  els.scoreBadge.textContent = "採点済み";
  els.scoreNumber.textContent = `${result.score}`;
  els.scoreSummary.textContent = result.summary || (result.score >= 80
    ? "来店促進の流れがよくできています。"
    : result.score >= 60
      ? "基本はできています。理由確認と次の約束を強めると安定します。"
      : "引取依頼への対応手順をもう一度練習しましょう。");
  els.goodList.innerHTML = listHtml(result.good);
  els.improveList.innerHTML = listHtml(result.improve);
  els.judgementList.innerHTML = listHtml(result.judgements);
  els.recommendedTalk.textContent = result.recommendedTalk;
}

function listHtml(items) {
  if (items.length === 0) return "<li>該当なし</li>";
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.micButton.disabled = true;
    els.speechNote.textContent = "このブラウザでは音声入力を利用できません。テキスト入力で練習できます。";
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = "ja-JP";
  speechRecognition.interimResults = true;
  speechRecognition.continuous = true;

  speechRecognition.addEventListener("result", (event) => {
    if (!speechListening || state.ended) return;
    const text = Array.from(event.results).map((result) => result[0].transcript).join("");
    els.staffInput.value = `${speechBaseText}${speechBaseText && text ? " " : ""}${text}`;
    const latestResult = event.results[event.results.length - 1];
    if (speechDecisionTimer) window.clearTimeout(speechDecisionTimer);
    if (latestResult.isFinal) {
      const fullText = els.staffInput.value.trim();
      els.speechNote.textContent = "発言の完了を確認しています。";
      speechDecisionTimer = window.setTimeout(() => {
        if (!speechListening || state.ended) return;
        if (looksLikeCompleteJapaneseSentence(fullText)) {
          stopSpeechInput();
          els.speechNote.textContent = "発言が完了したため、自動的に次へ進みます。";
          els.replyForm.requestSubmit();
        } else {
          els.speechNote.textContent = "発言が途中のため、続きを聞いています。";
          acknowledgeAndContinue(fullText);
        }
      }, 2000);
    } else {
      els.speechNote.textContent = "音声入力中です。話し終えると自動的に次へ進みます。";
    }
  });

  speechRecognition.addEventListener("end", () => {
    if (speechPausedForAck) return;
    if (!speechListening || state.ended) {
      updateMicButton(false);
      return;
    }

    speechBaseText = els.staffInput.value.trim();
    speechRestartTimer = window.setTimeout(() => {
      if (!speechListening || state.ended) return;
      try {
        speechRecognition.start();
      } catch (_) {
        els.speechNote.textContent = "マイクの再開を待っています。停止ボタンを押すと終了できます。";
      }
    }, 250);
  });

  speechRecognition.addEventListener("error", (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      speechListening = false;
      updateMicButton(false);
      els.speechNote.textContent = "マイクの利用が許可されていません。ブラウザの設定を確認してください。";
    }
  });

  els.micButton.addEventListener("click", () => {
    if (speechListening) {
      stopSpeechInput();
      els.speechNote.textContent = "音声入力を停止しました。内容を確認して送信してください。";
      return;
    }

    if (!state.started || state.ended) {
      els.speechNote.textContent = "先にロープレを開始してください。";
      return;
    }

    speechListening = true;
    speechBaseText = els.staffInput.value.trim();
    updateMicButton(true);
    els.speechNote.textContent = "音声入力中です。話し終えたら停止ボタンか送信を押してください。";
    try {
      speechRecognition.start();
    } catch (_) {
      speechListening = false;
      updateMicButton(false);
    }
  });
}

function updateMicButton(listening) {
  els.micButton.textContent = listening ? "■" : "🎙";
  els.micButton.classList.toggle("is-listening", listening);
  els.micButton.setAttribute("aria-label", listening ? "音声入力を停止" : "音声入力を開始");
  els.micButton.setAttribute("aria-pressed", listening ? "true" : "false");
}

function stopSpeechInput() {
  speechListening = false;
  if (speechRestartTimer) {
    window.clearTimeout(speechRestartTimer);
    speechRestartTimer = null;
  }
  if (speechDecisionTimer) {
    window.clearTimeout(speechDecisionTimer);
    speechDecisionTimer = null;
  }
  speechPausedForAck = false;
  lastAcknowledgedText = "";
  speechBaseText = "";
  if (speechRecognition) {
    try {
      speechRecognition.stop();
    } catch (_) {
      // すでに停止している場合は何もしない
    }
  }
  updateMicButton(false);
}

els.startButton.addEventListener("click", startRoleplay);
els.resetButton.addEventListener("click", startRoleplay);
els.finishButton.addEventListener("click", finishRoleplay);
els.printButton.addEventListener("click", () => window.print());
els.voiceSelect?.addEventListener("change", updateVoiceSelection);
els.replyForm.addEventListener("submit", handleReply);
els.scenarioList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scenario-id]");
  if (button) selectScenario(button.dataset.scenarioId);
});
els.conversation.addEventListener("click", (event) => {
  const reportButton = event.target.closest("[data-report-audio-index]");
  if (reportButton) {
    const message = state.transcript[Number(reportButton.dataset.reportAudioIndex)];
    if (!message) return;
    const issues = JSON.parse(localStorage.getItem("roleplayAudioIssues") || "[]");
    const key = `${message.audioId}|${message.text}`;
    if (!issues.some((item) => item.key === key && item.status !== "resolved")) {
      issues.unshift({
        key,
        text: message.text,
        audioId: message.audioId || "未登録",
        audioFile: audioIndex.get(message.audioId)?.file || "音声ファイルなし",
        reason: "会話の矛盾または音声不足",
        createdAt: new Date().toISOString(),
        status: "needed"
      });
      localStorage.setItem("roleplayAudioIssues", JSON.stringify(issues));
    }
    reportButton.textContent = "記録済み";
    reportButton.disabled = true;
    return;
  }
  const button = event.target.closest("[data-audio-index]");
  if (!button) return;
  const message = state.transcript[Number(button.dataset.audioIndex)];
  if (message?.role === "customer") {
    const shouldRestartMic = message.role === "customer" && state.started && !state.ended;
    if (shouldRestartMic) stopSpeechInput();
    const onFinished = shouldRestartMic ? startSpeechInputAfterCustomer : null;
    if (message.audioSrc) {
      playAudio(message.audioSrc, message.text, true, onFinished);
    } else {
      speakCustomerText(message.text, onFinished);
    }
  }
});

const savedVoice = localStorage.getItem("roleplayVoice");
if (savedVoice && audioDb.voices?.[savedVoice] && els.voiceSelect) {
  els.voiceSelect.value = savedVoice;
}
updateVoiceSelection();
renderScenarioList();
renderProgress();
setupSpeech();
