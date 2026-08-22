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
let activeCustomerAudio = null;
let customerPlaybackGeneration = 0;
let speechInputStartTimer = null;
let customerReplyTimer = null;

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
  serviceTimeNeedsReconfirmation: false,
  appointmentDateConfirmed: false,
  appointmentTimeConfirmed: false,
  appointmentTime: null,
  pickupRequested: false,
  serviceRequestAsked: false,
  vehicleConcernAsked: false,
  additionalServiceAnswered: false,
  additionalServiceReconfirmed: false,
  additionalServiceResumeState: null,
  employeeCode: "",
  startedAt: null,
  resultSaved: false,
  transcript: [],
  analyses: [],
  scriptedPartialReplies: {},
  inspectionExpiryEvidence: "",
  inspectionAvailabilityFollowUpPending: false,
  inspectionMileageAsked: false,
  inspectionWaitingRequested: false,
  inspectionLoanerRequested: false,
  inspectionLoanerConfirmed: false,
  usedVariants: {},
  questionRepeats: {},
  customerReplyPending: false
};

const els = {
  scenarioList: document.querySelector("#scenarioList"),
  scenarioCount: document.querySelector("#scenarioCount"),
  startButton: document.querySelector("#startButton"),
  resetButton: document.querySelector("#resetButton"),
  finishButton: document.querySelector("#finishButton"),
  printButton: document.querySelector("#printButton"),
  audioEnabled: document.querySelector("#audioEnabled"),
  progressEnabled: document.querySelector("#progressEnabled"),
  progressToggleState: document.querySelector("#progressToggleState"),
  stickyContext: document.querySelector("#stickyContext"),
  customerInfoPanel: document.querySelector("#customerInfoPanel"),
  customerInfoText: document.querySelector("#customerInfoText"),
  customerSpeechPanel: document.querySelector("#customerSpeechPanel"),
  customerSpeechSummary: document.querySelector("#customerSpeechSummary"),
  requiredCustomerSpeech: document.querySelector("#requiredCustomerSpeech"),
  confirmedCustomerSpeech: document.querySelector("#confirmedCustomerSpeech"),
  progressPanel: document.querySelector("#progressPanel"),
  employeeCode: document.querySelector("#employeeCode"),
  voiceSelect: document.querySelector("#voiceSelect"),
  voiceCredit: document.querySelector("#voiceCredit"),
  replyDelaySelect: document.querySelector("#replyDelaySelect"),
  replyForm: document.querySelector("#replyForm"),
  staffInput: document.querySelector("#staffInput"),
  micButton: document.querySelector("#micButton"),
  sendButton: document.querySelector("#sendButton"),
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
  recommendedTalkTitle: document.querySelector("#recommendedTalkTitle"),
  recommendedTalk: document.querySelector("#recommendedTalk"),
  resultSaveStatus: document.querySelector("#resultSaveStatus")
};

function normalizeEmployeeCode(value) {
  return String(value || "")
    .replace(/[０-９]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xFEE0)
    )
    .replace(/\D/g, "");
}

function isValidEmployeeCode(value) {
  return /^\d{6}$/.test(normalizeEmployeeCode(value));
}

function queueHistoryRecord(method, payload) {
  if (window.ROLEPLAY_RESULTS?.[method]) {
    window.ROLEPLAY_RESULTS[method](payload);
    return;
  }
  window.ROLEPLAY_RESULT_QUEUE = window.ROLEPLAY_RESULT_QUEUE || [];
  const queuedRecord = { method, payload };
  window.ROLEPLAY_RESULT_QUEUE.push(queuedRecord);
  if (method === "saveResult" && els.resultSaveStatus) {
    els.resultSaveStatus.textContent = "履歴保存サービスへ接続しています…";
    els.resultSaveStatus.className = "result-save-status is-saving";
    window.setTimeout?.(() => {
      if (!window.ROLEPLAY_RESULT_QUEUE?.includes(queuedRecord)) return;
      els.resultSaveStatus.textContent = "履歴保存サービスへ接続できませんでした。印刷結果は利用できます。";
      els.resultSaveStatus.className = "result-save-status is-error";
    }, 10000);
  }
}

const lexicon = {
  thanks: ["ありがとう", "ありがとうございます"],
  serviceTime: ["1時間", "一時間", "60分", "六十分"],
  reasonQuestion: ["なぜ", "理由", "どうして", "差し支え", "ご事情", "どのような"],
  visitBenefit: ["直接", "説明", "お車を見ながら", "点検内容", "整備内容", "安心", "詳しく"],
  weekend: ["土日", "週末", "土曜", "日曜", "休日"],
  otherStore: ["他店舗", "別店舗", "市内", "帯広", "近くのお店", "近い店舗", "近くの店舗", "最寄りの店舗"],
  choice: ["無理に", "可能です", "選べ", "ご都合", "難しい場合", "検討"],
  nextAction: ["いつ", "候補", "予約", "ご都合", "何日", "午前", "午後", "連絡", "確認"],
  additionalService: ["点検以外", "点検のほか", "点検の他", "ご用命", "追加整備", "オイル交換", "ほかに", "他に", "その他", "そのほか", "何か", "なにか"],
  vehicleConcern: ["気になる", "異音", "不具合", "症状", "調子", "違和感", "音"],
  pressure: ["必ず来店", "絶対に来店", "来店しか", "来店してください"],
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

function hasNegativeOptionExpression(text) {
  return /(?:できません|できない|出来ません|出来ない|ありません|ございません|していません|しておりません|難しい|不可|休み|休業|無理|空いていません|空いてない|埋まっています|いっぱい)/.test(text);
}

function hasAffirmativeOption(normalized, words, isQuestion, positiveWords = []) {
  return words.some((word) => {
    let searchFrom = 0;
    while (searchFrom < normalized.length) {
      const index = normalized.indexOf(word, searchFrom);
      if (index < 0) return false;
      const context = normalized.slice(index, index + 36);
      const politeInvitation = isQuestion
        && /(?:来店|予約|利用|お越し).{0,8}(?:できませんか|いただけませんか)/.test(context);
      if (!hasNegativeOptionExpression(context) || politeInvitation) {
        if (isQuestion || includesAny(context, positiveWords)) return true;
      }
      searchFrom = index + word.length;
    }
    return false;
  });
}

function hasVisitPressure(normalized) {
  return includesAny(normalized, lexicon.pressure)
    || /(?:必ず|絶対|どうしても).{0,12}(?:来店|お越し|店に来)/.test(normalized)
    || /(?:来店|お越し|店に来).{0,12}(?:しかありません|しかない|してもらいます|しなければなりません|必須です)/.test(normalized);
}

function hasPickupRefusal(normalized) {
  return /(?:引取|引き取り|引取り|車を取り|取りに行|取りに伺).{0,16}(?:できません|できない|出来ません|出来ない|けません|けない|えません|えない|対応できません|難しい|無理|していません|行っていません)/.test(normalized);
}

function acknowledgesPickupCircumstances(normalized) {
  const acknowledgementEnding = /(?:ですね|のですね|んですね|なのですね|承知しました|分かりました|わかりました)/;
  const patterns = [
    /(?:畑|農作業|収穫).{0,16}(?:忙しい|お忙しい)/,
    /(?:仕事|お仕事|通勤).{0,20}(?:忙しい|お忙しい|時間がない|時間が取れない|来店.{0,8}(?:難しい|大変|ご負担))/,
    /(?:遠い|距離がある|距離があり|店まで遠い|お店まで遠い).{0,16}(?:のですね|んですね|大変|ご負担|難しい)/,
    /運転.{0,16}(?:自信がない|ご不安|不安|心配|難しい)/
  ];
  return acknowledgementEnding.test(normalized)
    && patterns.some((pattern) => pattern.test(normalized));
}

function hasAffirmativeServiceTime(normalized) {
  const matches = [...normalized.matchAll(/(?:(?:1|一)時間(?!半|15分|30分)|60分|六十分)/g)];
  return matches.some((match) => {
    const context = normalized.slice(match.index, match.index + match[0].length + 24);
    return !/(?:ではありません|ではない|じゃありません|じゃない|かかりません|終わりません|未定|分かりません|わかりません|不明)/.test(context);
  });
}

function hasAffirmativeVisitBenefit(normalized) {
  const positiveWords = [
    "できます", "出来ます", "いたします", "します", "させていただ",
    "可能です", "安心いただ", "安心して", "詳しく"
  ];
  return lexicon.visitBenefit.some((word) => {
    let searchFrom = 0;
    while (searchFrom < normalized.length) {
      const index = normalized.indexOf(word, searchFrom);
      if (index < 0) return false;
      const context = normalized.slice(Math.max(0, index - 12), index + word.length + 28);
      if (!hasNegativeOptionExpression(context) && includesAny(context, positiveWords)) return true;
      searchFrom = index + word.length;
    }
    return false;
  });
}

function hasScheduleDateExpression(normalized) {
  if (/(?:\d{1,2}月)\d{1,2}日/.test(normalized)) return true;
  if (/(?:今月|来月|再来月)(?:の)?\d{1,2}日/.test(normalized)) return true;
  if (/(?:今週|来週|再来週)?(?:月|火|水|木|金|土|日)曜日/.test(normalized)) return true;
  return [...normalized.matchAll(/\d{1,2}日/g)].some((match) => {
    const context = normalized.slice(Math.max(0, match.index - 8), match.index + match[0].length + 12);
    return !/(?:作業|点検).{0,4}\d{1,2}日/.test(context)
      && !/\d{1,2}日(?:間|程度|ほど|ぐらい|くらい|かか|必要|で終)/.test(context);
  });
}

function confirmsUnchangedServiceTime(text) {
  const normalized = text.replace(/\s+/g, "");
  return normalized.includes("時間")
    && includesAny(normalized, [
      "変更はありません",
      "変更ありません",
      "変更ないです",
      "変更はない",
      "変更なし",
      "変わりません",
      "変わらない",
      "変わらないです",
      "同じです",
      "同じになります",
      "時間は同じ"
    ]);
}

function isServiceTimeRequirementSatisfied(explainedServiceTime, needsReconfirmation) {
  return Boolean(explainedServiceTime && !needsReconfirmation);
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
    ? "具体的な入庫日と時刻が確定すれば終話できます。その他の未確認項目は採点に反映されますが、AIお客様は聞き直しません。"
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
  stopCustomerPlayback();
  cancelPendingCustomerReply();
  scenario = selected;
  state.started = false;
  state.ended = false;
  state.currentState = "START";
  state.turn = 0;
  state.scriptStep = 0;
  state.proposedAppointment = null;
  state.serviceTimeExplained = false;
  state.serviceTimeNeedsReconfirmation = false;
  state.appointmentDateConfirmed = false;
  state.appointmentTimeConfirmed = false;
  state.appointmentTime = null;
  state.pickupRequested = false;
  state.serviceRequestAsked = false;
  state.vehicleConcernAsked = false;
  state.additionalServiceAnswered = false;
  state.additionalServiceReconfirmed = false;
  state.additionalServiceResumeState = null;
  state.transcript = [];
  state.analyses = [];
  state.scriptedPartialReplies = {};
  state.inspectionExpiryEvidence = "";
  state.inspectionAvailabilityFollowUpPending = false;
  state.inspectionMileageAsked = false;
  state.inspectionWaitingRequested = false;
  state.inspectionLoanerRequested = false;
  state.inspectionLoanerConfirmed = false;
  state.usedVariants = {};
  state.questionRepeats = {};
  state.startedAt = null;
  state.resultSaved = false;
  if (els.employeeCode) els.employeeCode.disabled = false;
  if (els.resultSaveStatus) {
    els.resultSaveStatus.textContent = "採点後、社員コードと結果を履歴へ保存します。";
    els.resultSaveStatus.className = "result-save-status";
  }
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

function mergedProgressAchievements() {
  return state.analyses.reduce((merged, analysis) => {
    Object.entries(analysis).forEach(([key, value]) => {
      if (value === true) merged[key] = true;
    });
    return merged;
  }, {});
}

function serviceAlternativeAchieved(merged) {
  if (state.pickupReason === "work") {
    return Boolean(merged.proposed_weekend || merged.proposed_time);
  }
  if (["distance", "drivingConfidence"].includes(state.pickupReason)) {
    return Boolean(merged.proposed_other_store || merged.proposed_family_visit);
  }
  if (state.pickupReason === "competitor") {
    return Boolean(merged.explained_visit_benefit || merged.left_choice);
  }
  if (state.pickupReason === "misunderstanding") {
    return Boolean(merged.acknowledged_request || merged.left_choice);
  }
  if (state.pickupReason === "family") {
    return Boolean(state.resolutionType === "familyConsultation" || merged.next_action_confirmed);
  }
  return Boolean(
    merged.proposed_weekend
    || merged.proposed_time
    || merged.proposed_other_store
    || merged.proposed_family_visit
  );
}

function serviceProgressStatus(item, merged) {
  let achieved = false;
  let notApplicable = false;

  switch (item.state) {
    case "START":
      achieved = state.started;
      break;
    case "INSPECTION_REQUEST_RECEIVED":
      achieved = Boolean(merged.acknowledged_request);
      break;
    case "ADDITIONAL_SERVICE_REQUEST":
      achieved = state.serviceRequestAsked && state.vehicleConcernAsked;
      break;
    case "ADDITIONAL_SERVICE_RECONFIRMATION":
      achieved = state.additionalServiceReconfirmed;
      notApplicable = !state.additionalServiceAnswered;
      break;
    case "SERVICE_TIME_QUESTION":
      if (state.serviceTimeNeedsReconfirmation) return "warning";
      achieved = isServiceTimeRequirementSatisfied(merged.explained_service_time, false);
      break;
    case "PICKUP_REQUEST":
      achieved = state.pickupRequested;
      break;
    case "VISIT_PROPOSAL":
      achieved = Boolean(merged.asked_reason && merged.explained_visit_benefit);
      break;
    case "ALTERNATIVE_PROPOSAL":
      achieved = serviceAlternativeAchieved(merged);
      break;
    case "APPOINTMENT_CONFIRMATION":
      achieved = state.appointmentDateConfirmed && state.appointmentTimeConfirmed;
      break;
    default:
      break;
  }

  if (achieved) return "done";
  if (state.started && !state.ended && item.state === state.currentState) return "active";
  if (notApplicable) return "na";
  return "";
}

function scriptedProgressStatus(item) {
  const steps = scenario.steps.filter((step) => step.state === item.state);
  const requiredSteps = steps.filter((step) =>
    step.advanceOnFailure !== true
    && !state.analyses.some((analysis) =>
      analysis.stepKey === step.key && analysis.notApplicable === true
    )
  );
  const achieved = requiredSteps.length > 0
    && requiredSteps.every((step) =>
      state.analyses.some((analysis) => analysis[step.key] === true)
    );
  if (achieved) return "done";
  if (state.started && !state.ended && item.state === state.currentState) return "active";
  if (
    state.ended
    && steps.length > 0
    && steps.every((step) => step.optionalAfterAppointment)
  ) return "na";
  return "";
}

function renderCustomerInfo() {
  const visible = scenario.id === "vehicle-inspection-phone-followup";
  if (els.customerInfoPanel) els.customerInfoPanel.hidden = !visible;
  if (!visible || !els.customerInfoText) return visible;

  const details = [
    scenario.customerName,
    scenario.vehicleName,
    scenario.expiryDate ? `車検満了日${scenario.expiryDate}` : "",
    scenario.availableFrom ? `${scenario.availableFrom}以降作業可能` : ""
  ].filter(Boolean);
  els.customerInfoText.textContent = details.join("／");
  return visible;
}

function renderCustomerSpeechIndicator(progressVisible) {
  const visible = progressVisible && scenario.id === "vehicle-inspection-phone-followup";
  if (els.customerSpeechPanel) els.customerSpeechPanel.hidden = !visible;
  if (!visible) return;

  const scoringByKey = new Map((scenario.scoring || []).map((item) => [item.key, item]));
  const completedStepKeys = new Set(
    (state.analyses || [])
      .filter((analysis) => analysis.passed || analysis.notApplicable)
      .map((analysis) => analysis.stepKey),
  );
  const remainingSteps = (scenario.steps || [])
    .slice(Math.min(state.scriptStep, scenario.steps.length))
    .filter((step) => !completedStepKeys.has(step.key));
  const confirmedMessages = state.transcript.filter((message) => message.role === "customer");

  if (els.customerSpeechSummary) {
    els.customerSpeechSummary.textContent = `必要 ${remainingSteps.length}件／確認済み ${confirmedMessages.length}件`;
  }
  if (els.requiredCustomerSpeech) {
    els.requiredCustomerSpeech.innerHTML = remainingSteps.length
      ? remainingSteps.map((step) => {
          const label = scoringByKey.get(step.key)?.label || step.expected || step.key;
          return `<div class="customer-speech-item is-required">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(step.customerResponse || step.retryResponse || "確認待ち")}</strong>
          </div>`;
        }).join("")
      : '<p class="customer-speech-empty">必要な基本発話はありません。</p>';
  }
  if (els.confirmedCustomerSpeech) {
    els.confirmedCustomerSpeech.innerHTML = confirmedMessages.length
      ? confirmedMessages.map((message, index) => `<div class="customer-speech-item is-confirmed">
          <span>発話 ${index + 1}</span>
          <strong>${escapeHtml(message.text)}</strong>
        </div>`).join("")
      : '<p class="customer-speech-empty">まだお客様発話はありません。</p>';
    els.confirmedCustomerSpeech.scrollTop = els.confirmedCustomerSpeech.scrollHeight;
  }
}

function renderProgress() {
  const visible = els.progressEnabled?.checked !== false;
  const customerVisible = renderCustomerInfo();
  if (els.stickyContext) els.stickyContext.hidden = !customerVisible && !visible;
  if (els.progressPanel) els.progressPanel.hidden = !visible;
  if (els.stateLabel) els.stateLabel.hidden = !visible;
  if (els.progressToggleState) els.progressToggleState.textContent = visible ? "ON" : "OFF";
  renderCustomerSpeechIndicator(visible);
  if (!visible) return;

  const merged = mergedProgressAchievements();
  const statusLabels = {
    active: "対応中",
    done: "確認済み",
    warning: "再確認必要",
    na: "対象外",
    "": "未確認"
  };
  els.progressStrip.innerHTML = scenario.progress
    .map((item) => {
      const status = scenario.mode === "staff-led-scripted"
        ? scriptedProgressStatus(item)
        : serviceProgressStatus(item, merged);
      const klass = status ? `is-${status}` : "";
      const statusLabel = statusLabels[status];
      return `<div class="progress-item ${klass}" aria-label="${escapeHtml(item.label)}: ${statusLabel}">
        ${escapeHtml(item.label)}
        <span class="progress-status">${statusLabel}</span>
      </div>`;
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
  const usesInspectionVoice = scenario.id === "vehicle-inspection-phone-followup";
  if (els.voiceSelect) els.voiceSelect.disabled = !usesInspectionVoice;
  if (els.voiceCredit) {
    els.voiceCredit.textContent = usesInspectionVoice ? voice.credit : "従来音声";
    if (usesInspectionVoice) els.voiceCredit.href = voice.creditUrl;
    else els.voiceCredit.removeAttribute("href");
  }
}

function customerReplyDelayMs() {
  const selected = Number(els.replyDelaySelect?.value);
  return [0, 500, 1000, 1500, 2000, 3000].includes(selected) ? selected : 1000;
}

function setCustomerReplyPending(pending) {
  state.customerReplyPending = pending;
  els.replyForm?.setAttribute("aria-busy", String(pending));
  const shouldDisable = pending || state.ended;
  if (els.staffInput) els.staffInput.disabled = shouldDisable;
  if (els.micButton) els.micButton.disabled = shouldDisable;
  if (els.sendButton) els.sendButton.disabled = shouldDisable;
}

function cancelPendingCustomerReply() {
  if (customerReplyTimer) {
    window.clearTimeout(customerReplyTimer);
    customerReplyTimer = null;
  }
  setCustomerReplyPending(false);
}

function registered12MonthCustomerMessage(role, text, audioId) {
  if (role !== "customer" || scenario.id !== "service-12month-visit-promotion") {
    return { text, audioId };
  }
  const item = audioIndex.get(audioId);
  if (item?.status === "ready" && audioPath(audioId)) {
    return { text: item.text, audioId };
  }
  const fallbackAudioId = scenario.audio.continueGeneric;
  const fallbackItem = audioIndex.get(fallbackAudioId);
  return {
    text: fallbackItem?.text || "ありがとうございます。続けてお願いします。",
    audioId: fallbackAudioId
  };
}

function commitMessage(role, text, options = {}) {
  const registeredCustomerMessage = registered12MonthCustomerMessage(
    role,
    text,
    options.audioId || ""
  );
  const message = {
    role,
    text: registeredCustomerMessage.text,
    at: new Date().toISOString(),
    audioId: registeredCustomerMessage.audioId,
    audioSrc: audioPath(registeredCustomerMessage.audioId)
  };
  state.transcript.push(message);
  if (
    role === "customer"
    && scenario.id === "vehicle-inspection-phone-followup"
    && /代車.*(?:貸して|用意して|借りたい|お願い|ほしい)/.test(normalizeScriptedText(message.text))
  ) {
    state.inspectionLoanerRequested = true;
  }
  renderConversation();
  renderProgress();
  if (role === "customer") {
    if (els.audioEnabled.checked && message.audioSrc) {
      playAudio(message.audioSrc, message.text, false, startSpeechInputAfterCustomer);
    } else if (
      els.audioEnabled.checked
      && scenario.id !== "service-12month-visit-promotion"
    ) {
      speakCustomerText(message.text, startSpeechInputAfterCustomer);
    } else {
      startSpeechInputAfterCustomer();
    }
  } else if (role !== "staff" && message.audioSrc && els.audioEnabled.checked) {
    playAudio(message.audioSrc, message.text, false);
  }
  if (typeof options.onCommitted === "function") options.onCommitted();
}

function addMessage(role, text, options = {}) {
  const previousMessage = state.transcript[state.transcript.length - 1];
  const delay = role === "customer"
    && previousMessage?.role === "staff"
    && options.immediate !== true
      ? customerReplyDelayMs()
      : 0;

  if (delay <= 0) {
    commitMessage(role, text, options);
    return;
  }

  cancelPendingCustomerReply();
  setCustomerReplyPending(true);
  customerReplyTimer = window.setTimeout(() => {
    customerReplyTimer = null;
    commitMessage(role, text, options);
    setCustomerReplyPending(false);
  }, delay);
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

function stopCustomerPlayback() {
  customerPlaybackGeneration += 1;
  if (speechInputStartTimer) {
    window.clearTimeout(speechInputStartTimer);
    speechInputStartTimer = null;
  }
  if (activeCustomerAudio) {
    const audio = activeCustomerAudio;
    activeCustomerAudio = null;
    audio.pause();
    audio.removeAttribute("src");
    try {
      audio.load();
    } catch (_) {
      // 再生停止後の解放に失敗しても、次の会話進行は止めない。
    }
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function playAudio(src, fallbackText = "", showMissingMessage = true, onFinished = null) {
  stopCustomerPlayback();
  const playbackGeneration = customerPlaybackGeneration;
  const audio = new Audio(src);
  activeCustomerAudio = audio;
  let finished = false;
  const finishOnce = () => {
    if (finished || playbackGeneration !== customerPlaybackGeneration) return;
    finished = true;
    if (activeCustomerAudio === audio) activeCustomerAudio = null;
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
  stopCustomerPlayback();
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    if (typeof onFinished === "function") onFinished();
    return;
  }
  const playbackGeneration = customerPlaybackGeneration;
  let finished = false;
  const finishOnce = () => {
    if (finished || playbackGeneration !== customerPlaybackGeneration) return;
    finished = true;
    if (typeof onFinished === "function") onFinished();
  };
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
  if (speechInputStartTimer) {
    window.clearTimeout(speechInputStartTimer);
  }
  const playbackGeneration = customerPlaybackGeneration;
  speechInputStartTimer = window.setTimeout(() => {
    speechInputStartTimer = null;
    if (playbackGeneration !== customerPlaybackGeneration) return;
    beginAutomaticSpeechInput("AIお客様の発話が終了しました。音声入力中です。話し終えたら送信を押してください。");
  }, 180);
}

function startSpeechInputForStaffOpening() {
  beginAutomaticSpeechInput("音声入力中です。お客様のお名前を確認する発話から始めてください。");
}

function startStaffLedOpening() {
  const isVehicleInspection = scenario.id === "vehicle-inspection-phone-followup";
  const ringbackAudioId = scenario.ringbackAudioId
    || (isVehicleInspection ? "inspection_call_ringback" : "");
  const openingCustomerMessage = scenario.openingCustomerMessage
    || (isVehicleInspection ? "はい、もしもし。" : "");
  const openingCustomerAudioId = scenario.openingCustomerAudioId
    || (isVehicleInspection ? "inspection_phone_greeting_customer" : "");

  if (!openingCustomerMessage) {
    startSpeechInputForStaffOpening();
    return;
  }

  const playGreeting = () => addMessage("customer", openingCustomerMessage, {
    audioId: openingCustomerAudioId,
    immediate: true
  });
  const ringbackSrc = audioPath(ringbackAudioId);
  if (els.audioEnabled.checked && ringbackSrc) {
    playAudio(ringbackSrc, "", false, playGreeting);
  } else {
    playGreeting();
  }
}

function staffLedStartInstruction() {
  if (
    scenario.id === "vehicle-inspection-phone-followup"
    && !scenario.ringbackAudioId
  ) {
    return "電話をかけています。呼び出し音の後にお客様が『はい、もしもし』と応答します。顧客情報は『佐藤様／ヤリス／車検満了日9月30日／8月1日以降作業可能』です。応答後に『佐藤様でしょうか』と本人確認を始めてください。";
  }
  return scenario.startInstruction;
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
  if (hasTrailingServiceInquiry(normalized)) return true;
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
  stopCustomerPlayback();
  cancelPendingCustomerReply();
  const hasEmployeeCodeField = typeof els.employeeCode?.setCustomValidity === "function";
  const employeeCode = hasEmployeeCodeField
    ? normalizeEmployeeCode(els.employeeCode.value)
    : "";
  if (els.employeeCode) els.employeeCode.value = employeeCode;
  if (hasEmployeeCodeField && !isValidEmployeeCode(employeeCode)) {
    els.employeeCode?.setCustomValidity("社員コードは6桁の数字で入力してください。");
    els.employeeCode?.reportValidity();
    els.employeeCode?.focus();
    if (els.resultSaveStatus) {
      els.resultSaveStatus.textContent = "ロープレ開始前に6桁の社員コードを入力してください。";
      els.resultSaveStatus.className = "result-save-status is-error";
    }
    return;
  }
  if (hasEmployeeCodeField) els.employeeCode.setCustomValidity("");
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
  state.serviceTimeNeedsReconfirmation = false;
  state.appointmentDateConfirmed = false;
  state.appointmentTimeConfirmed = false;
  state.appointmentTime = null;
  state.pickupRequested = false;
  state.serviceRequestAsked = false;
  state.vehicleConcernAsked = false;
  state.additionalServiceAnswered = false;
  state.additionalServiceReconfirmed = false;
  state.additionalServiceResumeState = null;
  state.transcript = [];
  state.analyses = [];
  state.scriptedPartialReplies = {};
  state.inspectionExpiryEvidence = "";
  state.inspectionAvailabilityFollowUpPending = false;
  state.inspectionMileageAsked = false;
  state.inspectionWaitingRequested = false;
  state.inspectionLoanerRequested = false;
  state.inspectionLoanerConfirmed = false;
  state.usedVariants = {};
  state.questionRepeats = {};
  state.employeeCode = employeeCode;
  state.startedAt = new Date().toISOString();
  state.resultSaved = false;
  setCustomerReplyPending(false);
  if (els.employeeCode) els.employeeCode.disabled = true;
  resetResults();
  if (isValidEmployeeCode(employeeCode)) {
    queueHistoryRecord("recordStart", {
      employeeCode,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      scenarioMode: scenario.mode || "customer-led",
      startedAt: state.startedAt
    });
  }
  if (scenario.mode === "staff-led-scripted") {
    addMessage("system", staffLedStartInstruction());
    startStaffLedOpening();
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
  els.recommendedTalkTitle.textContent = scenario.mode === "staff-led-scripted"
    ? "推奨トーク"
    : "次回の改善トーク";
  els.recommendedTalk.textContent = "結果に応じて表示されます。";
  if (els.resultSaveStatus) {
    els.resultSaveStatus.textContent = state.started
      ? "ロープレ実施中です。採点すると結果を保存します。"
      : "採点後、社員コードと結果を履歴へ保存します。";
    els.resultSaveStatus.className = state.started
      ? "result-save-status is-pending"
      : "result-save-status";
  }
}

function nextQuestionVariant(key, variants) {
  const count = state.questionRepeats[key] || 0;
  state.questionRepeats[key] = count + 1;
  if (count < variants.length) return variants[count];
  if (variants.length <= 1) return variants[0];
  const repeatIndex = 1 + ((count - variants.length) % (variants.length - 1));
  return variants[repeatIndex];
}

function customerQuestionTurn(key, variants) {
  const selected = nextQuestionVariant(key, variants);
  return customerTurn(selected.text, selected.audioId || "");
}

function normalizeFullWidthDigits(text) {
  return text.replace(/[０-９]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xFEE0)
  );
}

function extractScheduleTimeOptions(normalized) {
  const timeOptions = [...normalized.matchAll(/(\d{1,2})時(?!間|点)/g)].map((match) => {
    let hour = Number.parseInt(match[1], 10);
    const context = normalized.slice(Math.max(0, match.index - 24), match.index);
    const lastMorningMarker = Math.max(
      context.lastIndexOf("午前"),
      context.lastIndexOf("朝")
    );
    const lastAfternoonMarker = Math.max(
      context.lastIndexOf("午後"),
      context.lastIndexOf("お昼から"),
      context.lastIndexOf("昼から"),
      context.lastIndexOf("夕方"),
      context.lastIndexOf("夜")
    );
    if (lastAfternoonMarker > lastMorningMarker && hour >= 1 && hour < 12) {
      hour += 12;
    }
    if (hour < 0 || hour > 23) return null;
    return `${hour}時`;
  }).filter(Boolean);
  return [...new Set(timeOptions)];
}

function isMorningTimeBandOffer(normalized, isQuestion) {
  if (!normalized.includes("午前") || normalized.includes("午後")) return false;

  const denied = /(?:午前中?|午前の時間帯).*?(?:空いていません|空いてない|空き(?:が|は)?(?:ありません|ございません)|予約(?:できません|不可)|ご案内(?:できません|不可)|対応(?:できません|不可)|難しい|埋まっています|いっぱい|無理)/.test(normalized);
  if (denied) return false;
  if (isQuestion) return true;

  return /(?:午前中?|午前の時間帯)(?:が|に|は)?(?:空いて(?:います|おります)|空きが(?:あります|ございます)|予約(?:可能|できます)|ご案内(?:可能|できます)|対応(?:可能|できます))/.test(normalized);
}

function hasTrailingServiceInquiry(normalized) {
  return /(?:気になる(?:所|ところ|点)|調子の悪い(?:所|ところ)|オイル交換)(?:(?:など|とか))?(?:は|など|とか)[。.!！]?$/.test(normalized);
}

function isDayOffVisitQuestion(normalized, isQuestion) {
  if (!isQuestion) return false;
  const mentionsCustomerDayOff = includesAny(normalized, [
    "仕事が休み", "仕事がお休み", "仕事の休み", "仕事のお休み",
    "お仕事が休み", "お仕事がお休み", "お仕事の休み", "お仕事のお休み",
    "休みの日", "お休みの日", "休みの時", "お休みの時", "休日"
  ]);
  const asksAboutVisit = includesAny(normalized, ["来店", "お越し", "店に行", "店まで行"]);
  const rejectsVisit = /(?:来店|お越し|店に行|店まで行).{0,12}(?:難しい|無理|できません[。.!！]?|できない)/.test(normalized)
    && !/(?:来店|お越し).{0,8}(?:できませんか|いただけませんか)/.test(normalized);
  return mentionsCustomerDayOff && asksAboutVisit && !rejectsVisit;
}

function analyzeStaff(text) {
  const normalized = normalizeFullWidthDigits(text.replace(/\s+/g, ""));
  const isQuestion = /[？?]$/.test(text)
    || includesAny(normalized, ["でしょうか", "ですか", "ますか", "ませんか", "ないですか", "ございませんか", "でしょう"])
    || hasTrailingServiceInquiry(normalized);
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
  const hasConcreteServiceTime = hasAffirmativeServiceTime(normalized);
  const confirmedServiceTimeUnchanged = confirmsUnchangedServiceTime(normalized);
  const proposedWeekend = hasAffirmativeOption(
    normalized,
    lexicon.weekend,
    isQuestion,
    ["営業", "空い", "空き", "予約", "ご案内", "対応", "利用", "来店", "可能", "できます", "いかが", "よろしい", "どちら", "いい", "時"]
  );
  const proposedOtherStore = hasAffirmativeOption(
    normalized,
    lexicon.otherStore,
    isQuestion,
    ["ご案内", "案内", "紹介", "利用", "来店", "可能", "できます", "いかが", "選べ"]
  );
  const proposedTime = hasAffirmativeOption(
    normalized,
    ["時間帯", "午前", "午後", "夕方", "仕事前", "仕事後"],
    isQuestion,
    ["空い", "空き", "予約", "ご案内", "対応", "利用", "来店", "可能", "できます", "いかが", "よろしい", "どちら", "いい", "時"]
  );
  const offeredTimeBandChoice = isQuestion
    && normalized.includes("午前")
    && normalized.includes("午後");
  const offeredMorningTimeBand = isMorningTimeBandOffer(normalized, isQuestion);
  const proposedFamilyVisit = hasAffirmativeOption(
    normalized,
    ["ご主人", "ご家族", "家族と一緒", "一緒にご来店"],
    isQuestion,
    ["来店", "一緒", "可能", "できます", "いかが", "よろしい"]
  );
  const proposedDayOffVisit = isDayOffVisitQuestion(normalized, isQuestion);
  const hasActionableProposal = proposedWeekend
    || proposedOtherStore
    || proposedTime
    || proposedFamilyVisit
    || proposedDayOffVisit;
  const hasPositiveScheduleOffer = !hasNegativeOptionExpression(normalized)
    || /(?:空いています|空いております|空きがあります|空きがございます|予約できます|ご案内できます|可能です|いかが(?:でしょうか|ですか)|よろしいでしょうか)/.test(normalized);
  const hasScheduleDate = hasPositiveScheduleOffer && hasScheduleDateExpression(normalized);
  const scheduleTimeOptions = hasPositiveScheduleOffer
    ? extractScheduleTimeOptions(normalized)
    : [];
  const hasScheduleTime = scheduleTimeOptions.length === 1;
  const hasMultipleScheduleTimes = scheduleTimeOptions.length > 1;
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

  const askedServiceRequest = isQuestion
    && includesAny(normalized, lexicon.additionalService);
  const askedVehicleConcern = isQuestion
    && includesAny(normalized, lexicon.vehicleConcern);
  const askedReason = (isQuestion
    && (includesAny(normalized, lexicon.reasonQuestion) || normalized.includes("難しい")))
    || acknowledgesPickupCircumstances(normalized);
  const explainedVisitBenefit = hasAffirmativeVisitBenefit(normalized);
  const leftChoice = includesAny(normalized, [
    "無理に", "選べ", "難しい場合", "ご都合に合わせ", "一緒に確認", "ご検討"
  ]) || (isQuestion && includesAny(normalized, ["どちら", "いずれ", "ご希望", "いかが", "ご都合"]));
  const nextActionConfirmed = hasConcreteSchedule
    || (isQuestion
      && includesAny(normalized, ["いつ", "何日", "何時", "曜日", "時間帯", "午前", "午後", "ご都合"])
      && includesAny(normalized, ["予約", "来店", "入庫", "ご都合", "曜日", "時間帯", "連絡"]));

  const result = {
    acknowledged_request: includesAny(normalized, lexicon.thanks) || includesAny(normalized, ["承知", "かしこまり", "そうなのですね"]),
    asked_service_request: askedServiceRequest,
    asked_vehicle_concern: askedVehicleConcern,
    asked_additional_service: askedServiceRequest && askedVehicleConcern,
    accepted_pickup: acceptedPickup,
    pickup_acceptance_strength: pickupStrength,
    asked_reason: askedReason,
    explained_service_time: hasConcreteServiceTime,
    confirmed_service_time_unchanged: confirmedServiceTimeUnchanged,
    explained_visit_benefit: explainedVisitBenefit,
    proposed_weekend: proposedWeekend,
    proposed_other_store: proposedOtherStore,
    proposed_time: proposedTime,
    offered_time_band_choice: offeredTimeBandChoice,
    offered_morning_time_band: offeredMorningTimeBand,
    proposed_family_visit: proposedFamilyVisit,
    proposed_day_off_visit: proposedDayOffVisit,
    has_schedule_date: hasScheduleDate,
    has_schedule_time: hasScheduleTime,
    has_multiple_schedule_times: hasMultipleScheduleTimes,
    schedule_time_options: scheduleTimeOptions,
    has_concrete_schedule: hasConcreteSchedule,
    mentioned_previous_pickup: includesAny(normalized, ["以前", "前回", "前に", "取りに来ると", "取りに伺うと"]),
    proposed_alternative: hasActionableProposal,
    pressured_customer: hasVisitPressure(normalized),
    refused_pickup: hasPickupRefusal(normalized),
    left_choice: leftChoice,
    next_action_confirmed: nextActionConfirmed,
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
  if (analysis.pressured_customer || analysis.refused_pickup) return "needs_more_context";
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
  state.pickupRequested = true;
  const index = pickRandomIndex(scenario.pickupRequests, "pickup-request");
  state.pickupReason = classifyCustomerReason(scenario.pickupRequests[index]);
  return customerTurn(scenario.pickupRequests[index], scenario.audio.pickupRequests[index]);
}

function repeatServiceTimeQuestionTurn() {
  const lastCustomerText = [...state.transcript]
    .reverse()
    .find((message) => message.role === "customer")?.text;
  const availableIndexes = scenario.serviceTimeQuestions
    .map((text, index) => ({ text, index }))
    .filter((item) => item.text !== lastCustomerText)
    .map((item) => item.index);
  const pool = availableIndexes.length > 0
    ? availableIndexes
    : scenario.serviceTimeQuestions.map((_, index) => index);
  const selectedIndex = pool[randomIndex(pool.length)];
  return customerTurn(
    scenario.serviceTimeQuestions[selectedIndex],
    scenario.audio.serviceTimeQuestions[selectedIndex]
  );
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
  const lastSelected = used.at(-1);
  const resetPool = values
    .map((_, index) => index)
    .filter((index) => values.length <= 1 || index !== lastSelected);
  const pool = available.length > 0
    ? available
    : resetPool.length > 0
      ? resetPool
      : values.map((_, index) => index);
  const selected = pool[randomIndex(pool.length)];
  state.usedVariants[group] = available.length > 0 ? [...used, selected] : [selected];
  return selected;
}

function pickVariant(values, group = "default") {
  if (!Array.isArray(values)) return values;
  if (values.length === 0) return "";
  return values[pickRandomIndex(values, group)];
}

function rememberCompletedCheckpoints(analysis) {
  if (analysis.asked_service_request || analysis.asked_additional_service) state.serviceRequestAsked = true;
  if (analysis.asked_vehicle_concern || analysis.asked_additional_service) state.vehicleConcernAsked = true;
  const serviceTimeReconfirmed = analysis.explained_service_time
    || (state.serviceTimeExplained && analysis.confirmed_service_time_unchanged);
  if (serviceTimeReconfirmed) {
    state.serviceTimeExplained = true;
    state.serviceTimeNeedsReconfirmation = false;
  }
  if ([
    "VISIT_PROPOSAL",
    "ALTERNATIVE_PROPOSAL",
    "APPOINTMENT_CONFIRMATION"
  ].includes(state.currentState)) {
    if (analysis.has_schedule_date) state.appointmentDateConfirmed = true;
    if (analysis.has_schedule_time) {
      state.appointmentTimeConfirmed = true;
      state.appointmentTime = analysis.schedule_time_options[0];
    }
  }
}

function nextCustomerMessage(analysis) {
  rememberCompletedCheckpoints(analysis);

  if (analysis.decision === "pickup_accepted_immediately") {
    state.currentState = "PICKUP_REQUEST";
    state.ended = true;
    return customerTurn("はい、お願いします。", scenario.audio.acceptedPickup);
  }

  if (analysis.decision === "needs_more_context") {
    return customerQuestionTurn(`needs-more-context:${state.currentState}`, [
      {
        text: "おっしゃっていることがよく分からないんですけど。",
        audioId: scenario.audio.needsMoreContext
      }
    ]);
  }

  if (
    scenario.scoring.some((metric) => metric.key === "asked_additional_service")
    && (analysis.asked_service_request || analysis.asked_vehicle_concern || analysis.asked_additional_service)
    && !state.additionalServiceAnswered
  ) {
    if (state.serviceTimeExplained) state.serviceTimeNeedsReconfirmation = true;
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
    if (analysis.asked_service_request || analysis.asked_vehicle_concern || analysis.asked_additional_service) {
      state.additionalServiceReconfirmed = true;
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
    if (!state.serviceTimeExplained) {
      return repeatServiceTimeQuestionTurn();
    }
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
    const contextualResponse = selectContextualCustomerResponse(analysis);
    if (contextualResponse) {
      state.currentState = "ALTERNATIVE_PROPOSAL";
      return contextualResponse;
    }
    state.resolutionType = state.resolutionType || "continuedWithMissingConfirmation";
    state.currentState = "ALTERNATIVE_PROPOSAL";
    if (state.appointmentDateConfirmed && state.appointmentTimeConfirmed) {
      state.ended = true;
      return customerTurnFromAudio(scenario.audio.closings[0], "では、その日にお願いします。");
    }
    return appointmentFollowUpTurn(analysis);
  }

  if (state.currentState === "ALTERNATIVE_PROPOSAL") {
    const selectedTime = selectAppointmentTimeOption(analysis);
    if (selectedTime) return selectedTime;
    if (state.appointmentDateConfirmed && state.appointmentTimeConfirmed) {
      state.ended = true;
      return customerTurnFromAudio(scenario.audio.closings[0], "では、その日にお願いします。");
    }
    state.currentState = "APPOINTMENT_CONFIRMATION";
    return appointmentFollowUpTurn(analysis);
  }

  if (state.currentState === "APPOINTMENT_CONFIRMATION") {
    const selectedTime = selectAppointmentTimeOption(analysis);
    if (selectedTime) return selectedTime;
    if (state.appointmentDateConfirmed && state.appointmentTimeConfirmed) {
      state.ended = true;
      return customerTurnFromAudio(scenario.audio.closings[0], "では、その日にお願いします。");
    }
    return appointmentFollowUpTurn(analysis);
  }

  return customerTurn(
    "ありがとうございます。続けてお願いします。",
    scenario.audio?.continueGeneric || "continueGeneric"
  );
}

function unresolvedDistanceOrDrivingTurn() {
  const objection = scenario.objections.distance;
  const objectionTexts = objection.customer;
  const objectionAudio = scenario.audio.objections.distance;
  const reason = state.pickupReason || state.currentObjection;
  const index = reason === "drivingConfidence"
    ? objectionTexts.findIndex((text) => text.includes("運転に自信"))
    : pickRandomIndex(objectionTexts, "objection-distance-unresolved");
  const selectedIndex = index >= 0 ? index : 0;
  return customerTurn(objectionTexts[selectedIndex], objectionAudio[selectedIndex]);
}

function selectAppointmentTimeOption(analysis) {
  if (!state.appointmentDateConfirmed || !analysis.schedule_time_options?.length) return null;

  const timeOptions = analysis.schedule_time_options
    .map((time) => Number.parseInt(time, 10))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  if (analysis.has_schedule_time && timeOptions.length === 1) {
    const selectedTime = timeOptions[0];
    state.appointmentTimeConfirmed = true;
    state.appointmentTime = `${selectedTime}時`;
    state.ended = true;
    return customerTurn(
      "では、その時間でお願いします。",
      scenario.audio?.appointmentSingleTime || "appointmentSingleTime"
    );
  }

  if (!analysis.has_multiple_schedule_times || timeOptions.length < 2) return null;

  const choice = pickVariant(["earlier", "later"], "appointment-time-choice");
  const selectedTime = choice === "later"
    ? timeOptions[timeOptions.length - 1]
    : timeOptions[0];
  if (!Number.isFinite(selectedTime)) return null;

  state.appointmentTimeConfirmed = true;
  state.appointmentTime = `${selectedTime}時`;
  state.ended = true;
  if (choice === "later") {
    return customerTurn(
      "では、遅い時間でお願いします。",
      scenario.audio?.appointmentLaterTime || "appointmentLaterTime"
    );
  }
  return customerTurn(
    "では、早いほうでお願いします。",
    scenario.audio?.appointmentEarlierTime || "appointmentEarlierTime"
  );
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

  // 家族相談は引取希望の事情ではないため、引取依頼後のランダム回答には使用しない。
  const candidates = ["work", "distance"];
  if (analysis.proposed_other_store) candidates.push("competitor");
  if (analysis.mentioned_previous_pickup) candidates.push("misunderstanding");
  return candidates[randomIndex(candidates.length)];
}

function appointmentFollowUpTurn(analysis = {}) {
  if (
    state.appointmentDateConfirmed
    && analysis.offered_morning_time_band
    && !analysis.has_schedule_time
  ) {
    return customerQuestionTurn("appointment-morning-time", [
      {
        text: "では、午前中でお願いします。何時が空いていますか？",
        audioId: scenario.audio?.appointmentMorningNeedTime || "appointmentMorningNeedTime"
      },
      {
        text: "何時が空いていますか？",
        audioId: "appointmentMorningTimeRepeat"
      },
      {
        text: "午前中の何時が空いていますか？",
        audioId: "appointmentMorningTimeSpecific"
      }
    ]);
  }
  if (!state.appointmentDateConfirmed && analysis.offered_time_band_choice) {
    return customerQuestionTurn("appointment-morning-date", [
      {
        text: "午前中がいいです。今週だと何日が空いていますか？",
        audioId: scenario.audio?.appointmentMorningNeedDate || "appointmentMorningNeedDate"
      },
      {
        text: "午前中で空いている日はいつですか？",
        audioId: "appointmentMorningDateRepeat"
      },
      {
        text: "今週だと何日が空いていますか？",
        audioId: "appointmentMorningDateSpecific"
      }
    ]);
  }
  if (state.appointmentDateConfirmed) {
    return customerQuestionTurn("appointment-time-missing", [
      {
        text: "午前中と午後ならどちらが空いていますか？",
        audioId: scenario.audio.followUps[2]
      },
      {
        text: "何時が空いていますか？",
        audioId: "appointmentTimeRepeat"
      },
      {
        text: "何時に行けばいいんですか？",
        audioId: "appointmentTimeSpecific"
      }
    ]);
  }
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
    return customerTurn(
      "ありがとうございます。家族と相談して、改めてご連絡します。",
      scenario.audio?.familyFollowUp || "familyFollowUp"
    );
  }
  if (reason === "misunderstanding") {
    if (analysis.acknowledged_request || analysis.left_choice) {
      state.resolutionType = "clarified";
      return customerTurn(
        "分かりました。では、負担の少ない方法を相談させてください。",
        scenario.audio?.misunderstandingClarified || "misunderstandingClarified"
      );
    }
    return null;
  }
  if (["distance", "drivingConfidence"].includes(reason)) {
    if (analysis.proposed_other_store || analysis.proposed_family_visit) {
      state.resolutionType = "nearbyOrFamily";
      return customerTurn(
        "近い店舗や家族と一緒なら、来店できるかもしれません。",
        scenario.audio?.nearbyOrFamilyAgreement || "nearbyOrFamilyAgreement"
      );
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
    if (analysis.proposed_day_off_visit) {
      state.resolutionType = "dayOffAvailability";
      return customerTurnFromAudio(scenario.audio.possibleAgreements[0], "土日なら行けるかもしれません。");
    }
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

function normalizeLoanerHomophone(text) {
  return String(text || "").replace(/台車/g, "代車");
}

function normalizeScriptedText(text) {
  return String(text || "")
    .replace(/[０-９]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xFEE0)
    )
    .replace(/(\d{1,2}月)の(?=\d{1,2}日)/g, "$1")
    .replace(/台車/g, "代車")
    .replace(/(?:やりす|ヤリす)/g, "ヤリス")
    .replace(/\s+/g, "");
}

function hasSupportedInspectionDuration(text) {
  const normalized = normalizeScriptedText(text);
  return /(?:60|75|90)分/.test(normalized)
    || /(?:六十|七十五|九十)分/.test(normalized)
    || /(?:1|一)時間(?:15|十五|30|三十)分/.test(normalized)
    || /(?:1|一)時間半/.test(normalized)
    || /(?:1|一)時間(?![0-9一二三四五六七八九十]*分)/.test(normalized);
}

function hasInspectionWaitingChoiceOffer(text) {
  const normalized = normalizeScriptedText(text);
  const hasWaitingContext = /(?:待|店内)/.test(normalized);
  const offersWaitingChoice = /(?:いかが(?:でしょうか|ですか)|お待ちになりますか|待たれますか|待っていただけますか)/.test(normalized);
  return hasWaitingContext && offersWaitingChoice;
}

function hasInspectionLoanerConfirmation(text) {
  const normalized = normalizeScriptedText(text);
  const hasLoaner = normalized.includes("代車");
  const hasArrangement = /(?:用意|準備|手配)/.test(normalized);
  const hasNegative = /(?:できません|できない|難しい|空きがない|空いていない|用意がない|用意はない)/.test(normalized);
  const isPendingConfirmation = /(?:できるか|可能か|空き(?:を|が)?).*確認(?:します|いたします|して)/.test(normalized);
  const hasCommitment = /(?:できます|できる(?:か)?と思います|可能です|いたします|します|させていただ|しておきます|しておきましょう|なります)/.test(normalized);
  return hasLoaner && hasArrangement && hasCommitment && !hasNegative && !isPendingConfirmation;
}

function hasInspectionAvailableFromInformation(text) {
  const normalized = normalizeScriptedText(text);
  const availableFrom = normalizeScriptedText(scenario.availableFrom || "");
  return Boolean(availableFrom)
    && normalized.includes(availableFrom)
    && /(?:作業|車検|入庫|受け|可能|以降)/.test(normalized);
}

function hasLockNutToolExpression(text) {
  const normalized = normalizeScriptedText(text);
  if (normalized.includes("アダプター")) return true;
  const hasToolWord = /(?:キー|工具|道具)/.test(normalized);
  const hasLockNutContext = /(?:ロック|ナット|ホイール|外す|外し|取り外|専用)/.test(normalized);
  return hasToolWord && hasLockNutContext;
}

function asksCurrentMileage(text) {
  const normalized = normalizeScriptedText(text).toLowerCase();
  if (!isScriptedQuestion(normalized)) return false;
  return /(?:走行距離|距離数|何(?:キロ|km))/.test(normalized);
}

function hasBookingContinuationConfirmation(text) {
  const normalized = normalizeScriptedText(text);
  if (!isScriptedQuestion(normalized)) return false;
  const asksPermission = /(?:よろしい|大丈夫|ありますか|ございます|いただけ|構いません|構わない)/.test(normalized);
  if (!asksPermission) return false;
  const hasTimeContext = /(?:10分|十分|もう少し|少し|お時間|時間)/.test(normalized);
  const hasBookingContext = /(?:予約|手続き|このまま|進め|続け)/.test(normalized);
  return hasTimeContext || hasBookingContext;
}

function hasExplicitBookingContinuationConfirmation(text) {
  const normalized = normalizeScriptedText(text);
  return hasBookingContinuationConfirmation(normalized)
    && /(?:予約|手続き)/.test(normalized);
}

function hasInspectionBookingInvitation(text) {
  const normalized = normalizeScriptedText(text);
  if (!isScriptedQuestion(normalized)) return false;
  if (/(?:車検).{0,16}(?:お?決まり|決めて|決められ)/.test(normalized)) return true;
  if (!normalized.includes("予約")) return false;
  if (/(?:代車.{0,10}予約|予約.{0,10}代車)/.test(normalized)) return false;
  return /(?:この電話|お電話).{0,16}(?:ご)?予約/.test(normalized)
    || /(?:ご)?予約(?:を)?(?:承|お取り|取れ|でき|進め|しま)/.test(normalized)
    || /(?:ご)?予約.{0,12}いかが/.test(normalized);
}

function hasInspectionAppointmentProposalEvidence(text) {
  const normalized = normalizeScriptedText(text);
  const hasConcreteDateOrTime = inspectionAppointmentDateCandidates(normalized).length > 0
    || /\d{1,2}時/.test(normalized);
  const hasProposalContext = /(?:いかが|どうでしょう|空いて|空き|予約|予定)/.test(normalized);
  return hasConcreteDateOrTime && hasProposalContext && isScriptedQuestion(normalized);
}

function hasCompleteInspectionAppointmentProposal(text) {
  const normalized = normalizeScriptedText(text);
  return hasInspectionAppointmentProposalEvidence(normalized)
    && Boolean(inspectionAppointmentProposalMatch(normalized));
}

function inspectionAppointmentDateCandidates(text) {
  const normalized = normalizeScriptedText(text);
  const explicitDates = [...normalized.matchAll(/(\d{1,2})月(\d{1,2})日/g)]
    .filter((match) => {
      const followingText = normalized.slice(match.index + match[0].length);
      return !/^[、,。.]*(?:以降|以後|から|より|まで)/.test(followingText);
    })
    .map((match) => ({
      month: match[1],
      day: match[2],
      index: match.index,
      end: match.index + match[0].length
    }));

  // 「8月1日以降」と案内した後の「9日土曜日」のように、
  // 会話上明らかな月を省略した日付は、直前の月と組み合わせて保持する。
  const contextualDates = [...normalized.matchAll(/(\d{1,2})日/g)]
    .filter((match) => normalized[match.index - 1] !== "月")
    .filter((match) => {
      const followingText = normalized.slice(match.index + match[0].length);
      return !/^[、,。.]*(?:以降|以後|から|より|まで)/.test(followingText);
    })
    .map((match) => {
      const precedingMonths = [...normalized.slice(0, match.index).matchAll(/(\d{1,2})月/g)];
      const precedingMonth = precedingMonths[precedingMonths.length - 1];
      if (!precedingMonth) return null;
      return {
        month: precedingMonth[1],
        day: match[1],
        index: match.index,
        end: match.index + match[0].length
      };
    })
    .filter(Boolean);

  return [...explicitDates, ...contextualDates].sort((a, b) => a.index - b.index);
}

function inspectionAppointmentProposalMatch(text) {
  const normalized = normalizeScriptedText(text);
  for (const date of inspectionAppointmentDateCandidates(normalized)) {
    const timeMatch = normalized.slice(date.end).match(/(\d{1,2})時/);
    if (timeMatch) {
      return {
        month: date.month,
        day: date.day,
        hour: timeMatch[1]
      };
    }
  }
  return null;
}

function hasInspectionScheduleQuestionIntent(normalized) {
  return isScriptedQuestion(normalized)
    || /(?:ご)?都合.{0,12}(?:よろしい|良い|いい)(?:でしょう)?/.test(normalized);
}

function asksOpenInspectionDatePreference(text) {
  const normalized = normalizeScriptedText(text);
  const hasPreference = /(?:希望|都合)/.test(normalized);
  const hasDateContext = /(?:日程|日にち|日付|日取り|何日|いつ(?!も))/.test(normalized);
  const asksForAnswer = isScriptedQuestion(normalized)
    || /(?:教えて|お聞かせ|ございますでしょう)/.test(normalized);
  return hasPreference && hasDateContext && asksForAnswer;
}

function hasInspectionAppointmentCoordinationEvidence(text) {
  if (hasInspectionAppointmentProposalEvidence(text)) return true;
  const normalized = normalizeScriptedText(text);
  const hasDayPreference = /(?:平日|土日|週末|(?:月|火|水|木|金|土|日)(?:曜|曜日))/.test(normalized);
  const hasTimePreference = /(?:何時|午前|午後|時間帯)/.test(normalized);
  const openTimingQuestion = /(?:いつ(?:ぐらい|頃|ごろ|なら|が|に|から|まで)|何日|何時)/;
  const asksOpenPreference = new RegExp(`(?:都合|希望).{0,24}${openTimingQuestion.source}|${openTimingQuestion.source}.{0,24}(?:都合|希望)`).test(normalized);
  const hasSchedulingContext = /(?:予約|予定|日程|日にち|希望|空いて|空き|都合|いかが|よろしい)/.test(normalized);
  const asksDayPreference = asksInspectionDayPreference(normalized);
  const asksOpenDatePreference = asksOpenInspectionDatePreference(normalized);
  return (hasDayPreference && hasTimePreference || asksOpenPreference || asksDayPreference || asksOpenDatePreference)
    && hasSchedulingContext
    && (hasInspectionScheduleQuestionIntent(normalized) || asksOpenDatePreference);
}

function advancedPastScriptedStep(startingIndex, currentIndex, steps, stepKey) {
  const targetIndex = steps.findIndex((item) => item.key === stepKey);
  return targetIndex >= 0 && startingIndex <= targetIndex && currentIndex > targetIndex;
}

function hasClearInspectionPurposeNotice(text) {
  const normalized = normalizeScriptedText(text);
  const explicitlyStatesInspectionPurpose = normalized.includes("車検")
    && /(?:時期|近|案内|連絡|電話|予約)/.test(normalized);
  const vehicleName = normalizeScriptedText(scenario.vehicleName || "");
  const expiryDate = normalizeScriptedText(scenario.expiryDate || "");
  const impliesInspectionFromRegisteredDetails = Boolean(
    vehicleName
    && expiryDate
    && normalized.includes(vehicleName)
    && normalized.includes(expiryDate)
    && /(?:予定|予約|都合|決まり|決め|いかが)/.test(normalized)
  );
  return explicitlyStatesInspectionPurpose || impliesInspectionFromRegisteredDetails;
}

function hasInspectionSelfIntroduction(text) {
  const normalized = normalizeScriptedText(text);
  return /(?:(?:トヨタ|とよた)(?:モビリティ|もびりてぃ)(?:帯広|おびひろ)?|トヨタ|とよた)(?:の|、)[、,]?[一-龯々ぁ-んァ-ヶー]{1,12}(?:です|と(?:申|もう)します)/.test(normalized);
}

function scriptedRequiredGroupsMatch(normalized, step, matchedGroups) {
  // Firestoreに予約手続き時間だけを必須とする旧条件が残っていても、
  // 予約をこのまま進めてよいか確認する自然な言い回しを有効にする。
  // 「よろしければご予約をいただければと思いますが、いかがでしょうか」も
  // ここで完了扱いにし、同じ予約可否をお客様が聞き返さないようにする。
  if (step.key === "confirmed_booking_time") {
    return hasBookingContinuationConfirmation(normalized);
  }

  // 音声認識で「申します」が「もうします」となる場合も、
  // 店舗名と担当者名がそろっていれば名乗りとして扱う。
  if (step.key === "introduced_self") {
    return hasInspectionSelfIntroduction(normalized);
  }

  // Firestoreに「満了・車検」の旧キーワード条件が残っていても、
  // 登録済みの具体的な満了日を案内できれば達成とする。
  if (step.key === "explained_available_period") {
    const expiryDate = normalizeScriptedText(scenario.expiryDate || "");
    return Boolean(expiryDate) && normalized.includes(expiryDate);
  }

  // Firestoreの公開シナリオに旧キーワードが残っていても、
  // 走行距離確認と、確定済みの作業時間（60・75・90分）・店内待ちを必須にする。
  if (step.key === "explained_duration_and_wait") {
    const hasWaiting = ["待", "店内"].some((word) => normalized.includes(word));
    return state.inspectionMileageAsked
      && hasSupportedInspectionDuration(normalized)
      && hasWaiting;
  }

  // お客様がすでに代車を希望した分岐では、スタッフが手配を明確に承諾すれば完了とする。
  // スタッフ側から先に代車を案内する通常分岐では、従来の「早め・予約・用意」を維持する。
  if (
    step.key === "explained_loaner"
    && state.inspectionLoanerRequested
    && hasInspectionLoanerConfirmation(normalized)
  ) {
    return true;
  }

  // Firestoreに15分前のみの旧条件が残っていても、10分前・15分前の両方を有効にする。
  if (step.key === "explained_lock_and_arrival") {
    const hasArrivalLeadTime = /(?:10分|十分|15分|十五分)/.test(normalized)
      && /(?:早め|前)/.test(normalized);
    return hasLockNutToolExpression(normalized) && hasArrivalLeadTime;
  }

  if (matchedGroups.every((matches) => matches.length > 0)) return true;

  if (step.key === "asked_availability") {
    return hasInspectionBookingInvitation(normalized);
  }

  if (step.key !== "explained_inspection_notice") return false;

  const vehicleName = normalizeScriptedText(scenario.vehicleName || "");
  const expiryDate = normalizeScriptedText(scenario.expiryDate || "");
  return Boolean(
    vehicleName
    && expiryDate
    && normalized.includes(vehicleName)
    && normalized.includes("車検")
    && normalized.includes(expiryDate)
  );
}

function analyzeScriptedStaff(text, step) {
  const normalized = normalizeScriptedText(text);
  const matchedGroups = step.requiredGroups.map((group) => group.filter((word) => normalized.includes(word)));
  let passed = scriptedRequiredGroupsMatch(normalized, step, matchedGroups)
    && scriptedStepSpecificMatches(normalized, step);

  if (step.key === "proposed_appointment") {
    const appointmentMatch = inspectionAppointmentProposalMatch(normalized);
    passed = Boolean(passed && appointmentMatch);
    if (passed) {
      state.proposedAppointment = {
        month: appointmentMatch.month,
        day: appointmentMatch.day,
        hour: appointmentMatch.hour
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
  const mileageOnlyMissing = step.key === "explained_duration_and_wait"
    && !state.inspectionMileageAsked
    && hasSupportedInspectionDuration(normalized)
    && ["待", "店内"].some((word) => normalized.includes(word));
  const canAdvance = passed || mileageOnlyMissing || scriptedStepCanAdvanceOnFailure(step);
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
  if (step.key === "explained_loaner" && passed && state.inspectionLoanerRequested) {
    state.inspectionLoanerConfirmed = true;
  }
  return analysis;
}

function scriptedStepCanAdvanceOnFailure(step) {
  return step?.advanceOnFailure === true || step?.key === "confirmed_identity";
}

function markScriptedStepNotApplicable(step, reason) {
  if (!step || state.analyses.some((analysis) =>
    analysis.stepKey === step.key && analysis.notApplicable === true
  )) return;

  const analysis = {
    scripted: true,
    stepKey: step.key,
    expected: step.expected,
    passed: false,
    canAdvance: true,
    blocked: false,
    notApplicable: true,
    confidence: 1,
    evidence: [reason]
  };
  analysis[step.key] = false;
  state.analyses.push(analysis);
}

function markScriptedStepPassed(step, evidence) {
  if (!step || state.analyses.some((analysis) =>
    analysis.stepKey === step.key && analysis.passed === true
  )) return;

  const analysis = {
    scripted: true,
    stepKey: step.key,
    expected: step.expected,
    passed: true,
    canAdvance: true,
    blocked: false,
    confidence: 1,
    evidence: [evidence]
  };
  analysis[step.key] = true;
  state.analyses.push(analysis);
}

function scriptedStepMatches(text, step) {
  const normalized = normalizeScriptedText(text);
  const matchedGroups = step.requiredGroups.map((group) =>
    group.filter((word) => normalized.includes(word))
  );
  return scriptedRequiredGroupsMatch(normalized, step, matchedGroups)
    && scriptedStepSpecificMatches(normalized, step);
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
    return hasInspectionSelfIntroduction(normalized);
  }

  if (step.key === "asked_availability") {
    return isScriptedQuestion(normalized);
  }

  if (step.key === "confirmed_booking_time") {
    return hasBookingContinuationConfirmation(normalized);
  }

  if (step.key === "proposed_appointment") {
    return Boolean(inspectionAppointmentProposalMatch(normalized));
  }

  if (step.key === "explained_available_period") {
    const expiryDate = normalizeScriptedText(scenario.expiryDate || "");
    return Boolean(expiryDate) && normalized.includes(expiryDate);
  }

  if (step.key === "explained_duration_and_wait") {
    return hasSupportedInspectionDuration(normalized);
  }

  if (step.key === "confirmed_waiting") {
    return isScriptedQuestion(normalized);
  }

  if (step.key === "asked_vehicle_concerns") {
    return isScriptedQuestion(normalized);
  }

  if (step.key === "explained_lock_and_arrival") {
    return hasLockNutToolExpression(normalized);
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
  const expiryEvidence = step.key === "explained_available_period"
    ? state.inspectionExpiryEvidence
    : "";
  if (!pending && !expiryEvidence) return text;

  const parts = [expiryEvidence, pending?.text, text];
  if (isAffirmativeScriptedReply(text)) {
    if (pending?.missingDetail === "waiting") {
      parts.push("店内で待つことができます");
    }
    if (pending?.missingDetail === "reminderDestination") {
      parts.push("携帯へ連絡します");
    }
  }
  return parts.filter(Boolean).join(" ");
}

function asksInspectionDayPreference(normalized) {
  const hasDayChoice = /(?:平日|土日|週末|曜日)/.test(normalized);
  const asksPreference = /(?:どちら|希望|都合|よろしい|良い|いかが)/.test(normalized);
  return hasDayChoice && asksPreference && isScriptedQuestion(normalized);
}

function shouldAnswerDayPreferenceFromStoredExpiry(text, step) {
  return step.key === "explained_available_period"
    && Boolean(state.inspectionExpiryEvidence)
    && asksInspectionDayPreference(normalizeScriptedText(text));
}

function scriptedRetryForMissingDetails(text, step) {
  const normalized = normalizeScriptedText(text);

  if (step.key === "proposed_appointment") {
    const hasDate = inspectionAppointmentDateCandidates(normalized).length > 0;
    const hasTime = /\d{1,2}時/.test(normalized);
    const hasWeekday = /(?:月|火|水|木|金|土|日)(?:曜|曜日)/.test(normalized);
    const asksTimePreference = /(?:何時|午前|午後|時間帯)/.test(normalized);
    if (
      !hasDate
      && !hasTime
      && hasWeekday
      && asksTimePreference
      && hasInspectionScheduleQuestionIntent(normalized)
    ) {
      return {
        text: "午前中でお願いします。何日の予定ですか？",
        audioId: "inspection_appointment_morning_need_date",
        missingDetail: "appointmentDate"
      };
    }
    if (!hasDate && !hasTime && asksInspectionDayPreference(normalized)) {
      return {
        text: "土日がいいです。",
        audioId: "inspection_day_preference_answer",
        missingDetail: "appointmentDate"
      };
    }
    if (!hasDate && !hasTime && asksOpenInspectionDatePreference(normalized)) {
      return {
        text: "お願いしたいんですけど、いつできますか？",
        audioId: "inspection_asked_availability_customer",
        missingDetail: "appointmentDate"
      };
    }
    if (hasDate && !hasTime) {
      return {
        text: "何時が空いていますか？",
        audioId: "inspection_appointment_time_missing_retry",
        missingDetail: "appointmentTime"
      };
    }
    if (hasTime && !hasDate) {
      return {
        text: "何日の予定ですか？",
        audioId: "inspection_appointment_date_missing_retry",
        missingDetail: "appointmentDate"
      };
    }
  }

  if (step.key === "explained_available_period") {
    if (asksInspectionDayPreference(normalized)) {
      return {
        text: "土日がいいです。ちなみに、車検はいつまでですか？",
        audioId: "inspection_day_preference_and_expiry_question",
        missingDetail: null,
        alternatives: [
          {
            text: "土日がいいです。ちなみに、車検はいつまでですか？",
            audioId: "inspection_day_preference_and_expiry_question"
          },
          {
            text: "週末のほうが都合がいいです。それと、車検はいつまでに受ければよいですか？",
            audioId: "inspection_weekend_preference_and_expiry_question"
          },
          {
            text: "土日が希望です。車検の期限も教えてください。",
            audioId: ""
          }
        ]
      };
    }
    return {
      text: "車検はいつまでですか？",
      audioId: "inspection_explained_available_period_retry",
      missingDetail: null,
      alternatives: [
        {
          text: "車検はいつまでですか？",
          audioId: "inspection_explained_available_period_retry"
        },
        {
          text: "いつまでに受けなきゃダメですか？",
          audioId: "inspection_expiry_deadline_retry"
        }
      ]
    };
  }

  if (step.key === "explained_duration_and_wait") {
    const hasDuration = hasSupportedInspectionDuration(normalized);
    const hasWaiting = ["待", "店内"].some((word) => normalized.includes(word));
    if (hasDuration && !hasWaiting) {
      return {
        text: "お店で待つことはできますか？",
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
        text: "連絡は、この携帯に来ますか？",
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

function naturalScriptedRetryVariants(retry, step) {
  const variants = retry.alternatives?.length
    ? retry.alternatives.map((item) => ({ ...item }))
    : [{ text: retry.text, audioId: retry.audioId }];
  const registeredAudioVariants = variants.filter((item) => item.audioId);

  // 車検誘致は「まこと」の登録済みMP3だけを使用する。
  // 「すみません、」などを自動追加するとMP3がなくブラウザー標準音声になるため、
  // 音声IDのない自動生成文はお客様発話候補へ含めない。
  return registeredAudioVariants.length
    ? registeredAudioVariants.slice(0, 3)
    : [{ text: retry.text, audioId: retry.audioId }];
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
    let passed = matchedGroups.every((matches) => matches.length > 0)
      && scriptedStepSpecificMatches(normalized, step);

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

function recordSkippedScriptedSteps(text, startIndex, targetIndex, reason) {
  const normalized = normalizeScriptedText(text);

  scenario.steps.slice(startIndex, targetIndex).forEach((step) => {
    delete state.scriptedPartialReplies[step.key];
    if (state.analyses.some((analysis) => analysis.stepKey === step.key && analysis.passed)) return;

    const matchedGroups = step.requiredGroups.map((group) =>
      group.filter((word) => normalized.includes(word))
    );
    const passed = scriptedStepMatches(normalized, step)
      || (step.key === "thanked_customer" && hasCourtesyExpression(normalized));
    if (!passed && state.analyses.some((analysis) => analysis.stepKey === step.key)) return;

    const analysis = {
      scripted: true,
      stepKey: step.key,
      expected: step.expected,
      passed,
      canAdvance: true,
      blocked: false,
      skippedForAppointment: !passed,
      confidence: passed ? 0.95 : 1,
      evidence: passed ? matchedGroups.flat().slice(0, 8) : [reason]
    };
    analysis[step.key] = passed;
    state.analyses.push(analysis);
  });
}

function recordSkippedStepsBeforeAppointment(text, startIndex, appointmentIndex) {
  recordSkippedScriptedSteps(text, startIndex, appointmentIndex, "入庫日時調整を優先");
}

function handleScriptedStaffReply(text) {
  const startingScriptStep = state.scriptStep;
  const step = scenario.steps[state.scriptStep];
  if (!step) {
    finishRoleplay();
    return;
  }

  const expiryStep = scenario.steps.find((item) => item.key === "explained_available_period");
  if (expiryStep && scriptedStepMatches(text, expiryStep)) {
    state.inspectionExpiryEvidence = text;
  }

  // 具体的な入庫日と時刻が提示された場合は、未確認の過去工程へ戻らず日時調整を優先する。
  // 省略した項目は未達のまま採点し、同じ内容をAIお客様から聞き直さない。
  const appointmentIndex = scenario.steps.findIndex((item) => item.key === "proposed_appointment");
  if (
    appointmentIndex > state.scriptStep
    && hasCompleteInspectionAppointmentProposal(text)
  ) {
    recordSkippedStepsBeforeAppointment(text, state.scriptStep, appointmentIndex);
    state.scriptStep = appointmentIndex;
    state.currentState = scenario.steps[appointmentIndex].state;
    handleScriptedStaffReply(text);
    return;
  }

  // 未確認の前工程があっても、スタッフが予約手続きの所要時間を明確に確認した場合は、
  // 実際に聞かれた質問へ回答し、前工程は未達のまま日時調整へ進める。
  const bookingTimeIndex = scenario.steps.findIndex((item) => item.key === "confirmed_booking_time");
  if (
    bookingTimeIndex > state.scriptStep
    && hasExplicitBookingContinuationConfirmation(text)
  ) {
    recordSkippedScriptedSteps(text, state.scriptStep, bookingTimeIndex, "予約手続き確認を優先");
    state.scriptStep = bookingTimeIndex;
    state.currentState = scenario.steps[bookingTimeIndex].state;
    handleScriptedStaffReply(text);
    return;
  }

  // 車検満了日だけを案内した後の「いつから受けられるか」は任意質問。
  // 回答を省略して作業時間を案内しても、減点せず通常進行へ戻す。
  if (state.inspectionAvailabilityFollowUpPending) {
    state.inspectionAvailabilityFollowUpPending = false;
    if (!hasSupportedInspectionDuration(text)) {
      state.turn += 1;
      addMessage("customer", "どれくらい時間がかかるのですか？", {
        audioId: "inspection_explained_available_period_customer"
      });
      els.speechNote.textContent = "入庫可能日は任意案内です。続けて、作業時間と店内で待てるかをご案内ください。";
      renderProgress();
      return;
    }
  }

  // 初回車検の作業時間を判断するため、現在の走行距離を先に確認する。
  // 同じ発話ですでに時間を説明していた場合も、その内容は次の判定まで保持する。
  if (step.key === "explained_duration_and_wait" && asksCurrentMileage(text)) {
    state.inspectionMileageAsked = true;
    state.scriptedPartialReplies[step.key] = {
      text: combinedScriptedReply(text, step),
      missingDetail: "mileageAnswered"
    };
    state.turn += 1;
    addMessage("customer", "今、3万キロくらいです。", {
      audioId: "inspection_current_mileage_customer"
    });
    els.speechNote.textContent = "走行距離は約3万kmです。続けて、作業時間と店内で待てるかをご案内ください。";
    renderProgress();
    return;
  }

  // 気になる所の確認が予定より早く行われた場合は、その質問へ先に回答する。
  // 現在工程の説明は保持し、車両状態確認は後工程で繰り返さない。
  const concernStepIndex = scenario.steps.findIndex((item) => item.key === "asked_vehicle_concerns");
  const concernStep = scenario.steps[concernStepIndex];
  const askedConcernsEarly = concernStep
    && state.scriptStep < concernStepIndex
    && scriptedStepMatches(text, concernStep);
  if (askedConcernsEarly) {
    if (!state.analyses.some((item) => item.stepKey === concernStep.key && item.passed)) {
      analyzeScriptedStaff(text, concernStep);
    }
    state.scriptedPartialReplies[step.key] = {
      text: combinedScriptedReply(text, step),
      missingDetail: "earlyVehicleConcernAnswered"
    };
    state.turn += 1;
    addMessage("customer", "オイル交換もお願いしたいです。", {
      audioId: "inspection_asked_vehicle_concerns_customer"
    });
    els.speechNote.textContent = "車両の気になる所を確認済みです。オイル交換希望を受け付け、現在の案内を続けてください。";
    renderProgress();
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

  // 予約手続き時間の了承確認を省略して、具体的な日付・時刻の提案へ進んだ場合は、
  // 省略項目を未達として残しつつ、過去の手続き確認へ戻らず日時調整を続ける。
  if (
    step.key === "confirmed_booking_time"
    && hasInspectionAppointmentCoordinationEvidence(text)
  ) {
    const skippedAnalysis = analyzeScriptedStaff(combinedScriptedReply(text, step), step);
    skippedAnalysis.canAdvance = true;
    skippedAnalysis.blocked = false;
    delete state.scriptedPartialReplies[step.key];
    state.scriptStep += 1;
    state.currentState = scenario.steps[state.scriptStep].state;
    handleScriptedStaffReply(text);
    return;
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
    const appointmentQuestion = customerQuestionTurn("inspection-missing-appointment", [
      {
        text: "いつ行けばいいんですか？",
        audioId: "inspection_missing_appointment_angry"
      },
      {
        text: "入庫する日と時間を教えてください。",
        audioId: "inspection_missing_appointment_repeat"
      },
      {
        text: "何月何日の何時に行けばよいですか？",
        audioId: "inspection_missing_appointment_specific"
      }
    ]);
    addMessage("customer", appointmentQuestion.text, {
      audioId: appointmentQuestion.audioId
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
    const closingStep = scenario.steps[closingIndex];
    if (scriptedStepMatches(text, closingStep)) {
      markScriptedStepPassed(closingStep, text);
      state.scriptStep = scenario.steps.length;
      state.ended = true;
      addMessage("customer", closingStep.customerResponse, {
        audioId: `inspection_${closingStep.key}_customer`,
        onCommitted: () => finishRoleplay({ keepCustomerPlayback: true })
      });
      els.speechNote.textContent = "入庫日時が確定しているため、未確認項目へ戻らず終話しました。省略項目は採点結果の改善点に表示されます。";
      renderProgress();
      return;
    }
    state.scriptStep = closingIndex;
    state.currentState = closingStep.state;
    addMessage("customer", "お願いします。", {
      audioId: "inspection_recapped_appointment_customer"
    });
    els.speechNote.textContent = "入庫日時が確定したため、最後の挨拶へ進みました。省略した案内は採点結果の改善点に表示されます。";
    renderProgress();
    return;
  }

  const answeredDayPreferenceAfterExpiry = shouldAnswerDayPreferenceFromStoredExpiry(text, step);
  const combinedText = combinedScriptedReply(text, step);
  const analysis = analyzeScriptedStaff(combinedText, step);
  const explainedPurposeWithoutRequiredDetails = step.key === "explained_inspection_notice"
    && !analysis.passed
    && hasClearInspectionPurposeNotice(combinedText);
  if (explainedPurposeWithoutRequiredDetails) {
    // 車種や具体的な時期が不足していても、車検の用件自体が明確なら会話は進める。
    // 採点は未達のまま残し、「ご用件は何ですか？」という矛盾した聞き返しを防ぐ。
    analysis.canAdvance = true;
    analysis.blocked = false;
    analysis.evidence.push("車検の用件を説明（車種・時期は不足）");
  }
  state.turn += 1;

  if (!analysis.canAdvance) {
    const retry = scriptedRetryForMissingDetails(combinedText, step);
    if (retry.missingDetail === "waiting") {
      state.inspectionWaitingRequested = true;
    }
    state.scriptedPartialReplies[step.key] = {
      text: combinedText,
      missingDetail: retry.missingDetail
    };
    const retryQuestion = customerQuestionTurn(
      `inspection-retry:${step.key}:${retry.missingDetail || "general"}`,
      naturalScriptedRetryVariants(retry, step)
    );
    addMessage("customer", retryQuestion.text, {
      audioId: retryQuestion.audioId
    });
    els.speechNote.textContent = `警告：案内が不足しています。現在の確認項目: ${step.expected}`;
    renderProgress();
    return;
  }

  const nextStep = scenario.steps[state.scriptStep + 1];
  const shouldAskAvailableFrom = step.key === "explained_available_period"
    && !hasInspectionAvailableFromInformation(combinedText)
    && !answeredDayPreferenceAfterExpiry
    && !(nextStep && scriptedStepMatches(text, nextStep));

  if (shouldAskAvailableFrom) {
    delete state.scriptedPartialReplies[step.key];
    state.scriptStep += 1;
    state.currentState = scenario.steps[state.scriptStep].state;
    state.inspectionAvailabilityFollowUpPending = true;
    addMessage("customer", "いつから車検を受けられるんですか？", {
      audioId: "inspection_available_from_optional_question"
    });
    els.speechNote.textContent = "入庫可能日の追加質問です。回答を省略して作業時間を案内しても減点されません。";
    renderProgress();
    return;
  }

  delete state.scriptedPartialReplies[step.key];

  let responseStep = step;
  let customerResponseOverride = answeredDayPreferenceAfterExpiry
    ? {
        text: "土日がいいです。",
        audioId: "inspection_day_preference_answer"
      }
    : null;
  const followingStep = scenario.steps[state.scriptStep + 1];
  if (
    !analysis.passed
    && scriptedStepCanAdvanceOnFailure(step)
    && followingStep
    && !scriptedStepMatches(combinedText, followingStep)
  ) {
    state.scriptedPartialReplies[followingStep.key] = {
      text: combinedText,
      missingDetail: null
    };
  }
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

  // スタッフが店内待ちを選択肢として積極的に提案した場合は、
  // 代車を対象外にして予約手続きへ進む。
  // お客様から店内待ちを確認した場合は、外出に備えた代車希望へ進める。
  const waitingBranchLoanerStep = scenario.steps[state.scriptStep];
  if (
    waitingBranchLoanerStep?.key === "explained_loaner"
    && !scriptedStepMatches(combinedText, waitingBranchLoanerStep)
  ) {
    if (!state.inspectionWaitingRequested && hasInspectionWaitingChoiceOffer(combinedText)) {
      markScriptedStepNotApplicable(waitingBranchLoanerStep, "スタッフが店内待ちを提案");
      responseStep = waitingBranchLoanerStep;
      state.scriptStep += 1;
    } else if (state.inspectionWaitingRequested) {
      customerResponseOverride = {
        text: "出かける可能性があるので、一応代車を用意してほしいんですが、できますか？",
        audioId: "inspection_waiting_followup_loaner_request"
      };
    }
  }

  // スタッフが複数項目を一度に話した場合や、直前の発話を補足した場合は、
  // 合わせて実際に満たした連続ステップもまとめて判定する。
  while (state.scriptStep < scenario.steps.length) {
    const nextStep = scenario.steps[state.scriptStep];
    const matchesNextStep = scriptedStepMatches(combinedText, nextStep);
    const hasCombinedCourtesy = nextStep.key === "thanked_customer"
      && hasCourtesyExpression(combinedText);
    if (!matchesNextStep && !hasCombinedCourtesy) break;

    const nextAnalysis = analyzeScriptedStaff(combinedText, nextStep);
    if (!nextAnalysis.canAdvance) break;
    responseStep = nextStep;
    state.scriptStep += 1;
  }

  // お客様が代車を希望し、スタッフが手配を承諾済みなら待ち方は確定済み。
  // 後工程で「店内で待つ」と回答して代車希望と矛盾しないよう、待ち方確認を通過する。
  const resolvedWaitingStep = scenario.steps[state.scriptStep];
  if (resolvedWaitingStep?.key === "confirmed_waiting" && state.inspectionLoanerConfirmed) {
    markScriptedStepPassed(resolvedWaitingStep, "お客様の代車希望とスタッフの手配承諾で待ち方を確認済み");
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
    && scriptedStepCanAdvanceOnFailure(step)
    && !hasCourtesyExpression(text);
  const skippedIdentity = useAdvanceRetry && step.key === "confirmed_identity";
  if (
    !customerResponseOverride
    && hasInspectionBookingInvitation(combinedText)
    && advancedPastScriptedStep(
      startingScriptStep,
      state.scriptStep,
      scenario.steps,
      "asked_availability"
    )
  ) {
    customerResponseOverride = nextQuestionVariant("inspection-booking-invitation-accept", [
      {
        text: "お願いします。",
        audioId: "inspection_booking_invitation_accept_customer"
      },
      {
        text: "お願いしようと思っていました。",
        audioId: "inspection_booking_invitation_intent_customer"
      }
    ]);
  }
  if (!customerResponseOverride && responseStep.key === "asked_vehicle_concerns") {
    customerResponseOverride = {
      text: "オイル交換もお願いしたいです。",
      audioId: "inspection_asked_vehicle_concerns_customer"
    };
  }
  addMessage("customer", customerResponseOverride?.text
    || (skippedIdentity
      ? "どちら様でしょうか？"
      : useAdvanceRetry ? step.retryResponse : responseStep.customerResponse), {
    audioId: customerResponseOverride?.audioId
      || (skippedIdentity
        ? "inspection_introduced_self_retry"
        : useAdvanceRetry
        ? `inspection_${step.key}_retry`
        : `inspection_${responseStep.key}_customer`),
    onCommitted: finished
      ? () => finishRoleplay({ keepCustomerPlayback: true })
      : null
  });
  renderProgress();
}

function handleReply(event) {
  event.preventDefault();
  if (!state.started || state.ended || state.customerReplyPending) return;
  const text = normalizeLoanerHomophone(els.staffInput.value.trim());
  if (!text) return;

  stopSpeechInput();
  stopCustomerPlayback();
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
    finishRoleplay({ keepCustomerPlayback: true });
    return;
  }

  const customer = nextCustomerMessage(analysis);
  const finished = state.ended;
  addMessage("customer", customer.text, {
    audioId: customer.audioId,
    onCommitted: finished
      ? () => finishRoleplay({ keepCustomerPlayback: true })
      : null
  });

  renderProgress();
}

function finishRoleplay(options = {}) {
  stopSpeechInput();
  if (!options.keepCustomerPlayback) stopCustomerPlayback();
  if (!state.started) return;
  state.ended = true;
  cancelPendingCustomerReply();
  const result = scoreRoleplay();
  renderResults(result);
  renderProgress();
  if (!state.resultSaved && isValidEmployeeCode(state.employeeCode)) {
    state.resultSaved = true;
    const completedAt = new Date().toISOString();
    const startedAtMs = state.startedAt ? Date.parse(state.startedAt) : Date.now();
    queueHistoryRecord("saveResult", {
      employeeCode: state.employeeCode,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      scenarioMode: scenario.mode || "customer-led",
      score: result.score,
      startedAt: state.startedAt || completedAt,
      completedAt,
      durationSeconds: Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)),
      good: result.good,
      improve: result.improve,
      judgements: result.judgements,
      recommendedTalkTitle: result.recommendedTalkTitle || "推奨トーク",
      recommendedTalk: result.recommendedTalk || "",
      transcript: state.transcript.slice(0, 100).map((message) => ({
        role: message.role,
        text: String(message.text || "").slice(0, 1000)
      }))
    });
  }
  if (els.employeeCode) els.employeeCode.disabled = false;
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
    if (metric.key === "asked_additional_service") {
      return state.serviceRequestAsked && state.vehicleConcernAsked;
    }
    if (metric.key === "explained_service_time") {
      return isServiceTimeRequirementSatisfied(
        merged.explained_service_time,
        state.serviceTimeNeedsReconfirmation
      );
    }
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
    else if (metric.key === "explained_service_time" && state.serviceTimeNeedsReconfirmation) {
      improve.push("追加作業を受け付けた後に、変更後の作業時間または時間に変更がないことを再案内しましょう");
    }
    else improve.push(`${action}ことを意識すると、より良い応対になります`);
  });
  penalties.forEach((penalty) => improve.unshift(penalty));
  const missingMetricKeys = applicableMetrics
    .filter((metric) => !metricAchieved(metric))
    .map((metric) => metric.key);

  return {
    score,
    good: good.slice(0, 4),
    improve: improve.slice(0, 4),
    recommendedTalkTitle: "次回の改善トーク",
    recommendedTalk: buildImprovementTalk(missingMetricKeys, reason, {
      serviceTimeNeedsReconfirmation: state.serviceTimeNeedsReconfirmation
    }),
    judgements: state.analyses.map((analysis, index) => {
      const strength = analysis.pickup_acceptance_strength;
      const confidence = Math.round(analysis.confidence * 100);
      return `${index + 1}回目: 引取確定度 ${strength} / 信頼度 ${confidence}%`;
    })
  };
}

function scoreScriptedRoleplay() {
  const notApplicableKeys = new Set(
    state.analyses
      .filter((analysis) => analysis.scripted && analysis.notApplicable === true)
      .map((analysis) => analysis.stepKey)
  );
  const applicableScoring = scenario.scoring.filter((metric) => !notApplicableKeys.has(metric.key));
  const achieved = {};
  scenario.scoring.forEach((metric) => {
    achieved[metric.key] = state.analyses.some((analysis) => analysis[metric.key] === true);
  });

  const retryCount = state.analyses.filter((analysis) => analysis.scripted && analysis.blocked).length;
  const earnedPoints = applicableScoring.reduce(
    (sum, metric) => sum + (achieved[metric.key] ? metric.points : 0),
    0
  );
  const applicablePoints = applicableScoring.reduce((sum, metric) => sum + metric.points, 0);
  const baseScore = applicablePoints > 0
    ? Math.round((earnedPoints / applicablePoints) * 100)
    : 0;
  const score = Math.max(0, Math.min(100, baseScore - Math.min(20, retryCount * 2)));
  const good = applicableScoring
    .filter((metric) => achieved[metric.key])
    .map((metric) => `${metric.action}ことができています`);
  const improve = applicableScoring
    .filter((metric) => !achieved[metric.key])
    .map((metric) => `${metric.action}ことを意識すると、より良い応対になります`);
  if (retryCount > 0) {
    improve.unshift(`案内不足によるお客様の聞き返しが${retryCount}回ありました`);
  }

  const judgements = scenario.scoring.map((metric) => {
    const attempts = state.analyses.filter((analysis) =>
      analysis.stepKey === metric.key && analysis.notApplicable !== true
    );
    const status = notApplicableKeys.has(metric.key)
      ? "対象外（店内待ち提案済み）"
      : achieved[metric.key] ? "○" : "要改善";
    return `${metric.label}: ${status}${attempts.length > 1 ? `（${attempts.length}回発話）` : ""}`;
  });

  return {
    score,
    good: good.slice(0, 4),
    improve: improve.slice(0, 4),
    recommendedTalkTitle: "推奨トーク",
    recommendedTalk: scenario.recommendedTalk,
    judgements,
    summary: score >= 90
      ? "車検誘致の電話応対を、予約確定から事前案内まで正確に完結できています。"
      : score >= 70
        ? "基本の流れはできています。案内漏れを減らすと、より安定した電話応対になります。"
        : "本人確認から予約復唱まで、車検誘致の電話手順を順番に練習しましょう。"
  };
}

function buildImprovementTalk(missingMetricKeys, reason = "work", options = {}) {
  if (!missingMetricKeys.length) {
    return "今回の応対で必要な確認と提案ができています。現在の流れを継続してください。";
  }

  const otherStoreTalk = ["distance", "drivingConfidence"].includes(reason)
    ? "ご自宅から近い店舗のご案内や、ご家族と一緒にご来店いただく方法もございます。"
    : "ご都合に合わせて利用しやすい店舗や方法をご案内できます。";
  const circumstanceTalk = {
    work: "お仕事でご来店が難しいのですね。承知しました。",
    distance: "ご自宅から距離があり、ご来店がご負担なのですね。",
    drivingConfidence: "運転にご不安があり、ご来店が難しいのですね。",
    competitor: "他店の引取サービスも比較されているのですね。",
    misunderstanding: "以前のご案内と違って聞こえたのですね。",
    family: "ご家族と相談されたいのですね。"
  }[reason] || "ご来店が難しいのですね。承知しました。";
  const talks = {
    acknowledged_request: "ご連絡ありがとうございます。12カ月点検のご依頼ですね。",
    asked_additional_service:
      "12カ月点検のほかに、オイル交換などのご用命や、お車で気になる点はございませんか。",
    explained_service_time: options.serviceTimeNeedsReconfirmation
      ? "オイル交換などの追加作業を含めた作業時間、または作業時間に変更がないことを改めてご案内します。"
      : "点検は、追加整備がなければ1時間程度です。",
    asked_reason: circumstanceTalk,
    explained_visit_benefit:
      "ご来店いただければ、お車を確認しながら点検内容を詳しくご説明できます。",
    proposed_weekend:
      "土日営業日や、お仕事の前後で利用しやすい時間帯も確認できます。",
    proposed_other_store: otherStoreTalk,
    left_choice:
      "ご来店が難しい場合も含め、ご負担の少ない方法を一緒に確認させてください。",
    next_action_confirmed:
      "ご都合のよい曜日や時間帯を教えていただけますか。"
  };
  return missingMetricKeys
    .map((key) => talks[key])
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
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
      ? "基本はできています。お客様事情の受け止めと次の約束を強めると安定します。"
      : "引取依頼への対応手順をもう一度練習しましょう。");
  els.goodList.innerHTML = listHtml(result.good);
  els.improveList.innerHTML = listHtml(result.improve);
  els.judgementList.innerHTML = listHtml(result.judgements);
  els.recommendedTalkTitle.textContent = result.recommendedTalkTitle || "推奨トーク";
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
els.employeeCode?.addEventListener("input", () => {
  const normalized = normalizeEmployeeCode(els.employeeCode.value).slice(0, 6);
  els.employeeCode.value = normalized;
  els.employeeCode.setCustomValidity("");
});
els.progressEnabled?.addEventListener("change", () => {
  localStorage.setItem("roleplayProgressVisible", String(els.progressEnabled.checked));
  renderProgress();
});
els.voiceSelect?.addEventListener("change", updateVoiceSelection);
els.replyDelaySelect?.addEventListener("change", () => {
  localStorage.setItem("roleplayCustomerReplyDelayMs", String(customerReplyDelayMs()));
});
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
const savedCustomerReplyDelay = localStorage.getItem("roleplayCustomerReplyDelayMs");
if (
  els.replyDelaySelect
  && ["0", "500", "1000", "1500", "2000", "3000"].includes(savedCustomerReplyDelay)
) {
  els.replyDelaySelect.value = savedCustomerReplyDelay;
}
window.addEventListener?.("roleplay-history-status", (event) => {
  if (!els.resultSaveStatus) return;
  const detail = event.detail || {};
  els.resultSaveStatus.textContent = detail.message || "";
  els.resultSaveStatus.className = `result-save-status ${detail.status ? `is-${detail.status}` : ""}`.trim();
});
const savedProgressVisibility = localStorage.getItem("roleplayProgressVisible");
if (els.progressEnabled) {
  els.progressEnabled.checked = savedProgressVisibility !== "false";
}
updateVoiceSelection();
renderScenarioList();
renderProgress();
setupSpeech();
