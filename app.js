const scenarios = window.ROLEPLAY_SCENARIOS || [window.ROLEPLAY_SCENARIO];
let scenario = scenarios[0];
const audioDb = window.ROLEPLAY_AUDIO_DB || { basePath: "audio/", items: [] };
const audioIndex = new Map(audioDb.items.map((item) => [item.id, item]));

let speechRecognition = null;
let speechListening = false;
let speechBaseText = "";
let speechRestartTimer = null;
let speechDecisionTimer = null;
let interactionDelayAlreadyElapsed = false;
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
  inspectionDurationQuestionAsked: false,
  inspectionDurationProgressionPending: false,
  inspectionWaitingRequested: false,
  inspectionLoanerRequested: false,
  inspectionLoanerConfirmed: false,
  inspectionButtonChecks: {},
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
  interactionDelaySelect: document.querySelector("#interactionDelaySelect"),
  replyForm: document.querySelector("#replyForm"),
  staffInput: document.querySelector("#staffInput"),
  micButton: document.querySelector("#micButton"),
  sendButton: document.querySelector("#sendButton"),
  speechNote: document.querySelector("#speechNote"),
  scenarioNote: document.querySelector("#scenarioNote"),
  conversationHighlightLegend: document.querySelector("#conversationHighlightLegend"),
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
  state.inspectionDurationQuestionAsked = false;
  state.inspectionDurationProgressionPending = false;
  state.inspectionWaitingRequested = false;
  state.inspectionLoanerRequested = false;
  state.inspectionLoanerConfirmed = false;
  state.inspectionButtonChecks = {};
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

  const analyses = state.analyses || [];
  const staffTexts = state.transcript
    .filter((message) => message.role === "staff")
    .map((message) => message.text);
  const passed = (key) => analyses.some((analysis) =>
    analysis.stepKey === key && analysis.passed === true
  );
  const notApplicable = (key) => analyses.some((analysis) =>
    analysis.stepKey === key && analysis.notApplicable === true
  );
  const anyStaffText = (matcher) => staffTexts.some((text) => matcher(normalizeScriptedText(text), text));
  const asksVehicleCondition = (normalized) =>
    isScriptedQuestion(normalized)
    && /(?:気になる|不具合|不都合|調子|具合|症状|異音|違和感|見てほしい|見てもらいたい)/.test(normalized);
  const asksAdditionalWork = (normalized, originalText) =>
    asksInspectionAdditionalServiceFollowUp(originalText)
    || (
      isScriptedQuestion(normalized)
      && /(?:オイル交換|追加作業|追加整備|ご用命)/.test(normalized)
    );
  const explainsWaiting = (normalized, originalText) =>
    /(?:待|店内)/.test(normalized)
    && (
      asksInspectionWaitingMethodConfirmation(originalText)
      || /(?:可能|できます|できる|大丈夫|構いません)/.test(normalized)
    );

  const checkpoints = [
    { buttonKey: "opening", label: "開始挨拶", keys: ["confirmed_identity"], done: staffTexts.length > 0, staffText: "もしもし。", responseText: "はい、もしもし。", audioId: "inspection_phone_greeting_customer" },
    { buttonKey: "identity", label: "本人確認", keys: ["confirmed_identity"], done: passed("confirmed_identity"), na: notApplicable("confirmed_identity"), staffText: "佐藤様でしょうか。", responseText: "そうです。", audioId: "inspection_confirmed_identity_customer" },
    { buttonKey: "introduction", label: "店舗・担当者名", keys: ["introduced_self"], done: passed("introduced_self"), na: notApplicable("introduced_self"), staffText: "私、トヨタモビリティ帯広の山田と申します。", responseText: "お世話になっております。", audioId: "inspection_introduced_self_customer" },
    { buttonKey: "thanks", label: "日頃のお礼", keys: ["thanked_customer"], done: passed("thanked_customer"), na: notApplicable("thanked_customer"), staffText: "日頃は大変お世話になり、誠にありがとうございます。", responseText: "こちらこそ。", audioId: "inspection_thanked_customer_customer" },
    { buttonKey: "inspectionNotice", label: "車検期日案内", keys: ["explained_inspection_notice", "explained_available_period"], done: passed("explained_inspection_notice") && passed("explained_available_period"), na: notApplicable("explained_inspection_notice") && notApplicable("explained_available_period"), staffText: "お使いのヤリスの車検満了日は9月30日で、8月1日以降作業可能です。", responseText: "案内のはがきが来ていましたよ。", audioId: "inspection_explained_inspection_notice_customer" },
    { buttonKey: "availability", label: "ご都合確認", keys: ["asked_availability"], done: passed("asked_availability"), na: notApplicable("asked_availability"), staffText: "ご予定はお決まりでしたでしょうか。", responseText: "お願いしたいんですけど、いつできますか？", audioId: "inspection_asked_availability_customer" },
    { buttonKey: "concerns", label: "調子確認", keys: ["asked_vehicle_concerns"], done: anyStaffText(asksVehicleCondition), na: notApplicable("asked_vehicle_concerns"), staffText: "お車の調子や気になる点はございますか。", responseText: "オイル交換もお願いしたいです。", audioId: "inspection_asked_vehicle_concerns_customer" },
    { buttonKey: "additionalWork", label: "追加作業確認", keys: ["asked_vehicle_concerns"], done: anyStaffText(asksAdditionalWork), na: notApplicable("asked_vehicle_concerns"), staffText: "オイル交換など、ほかに追加作業のご希望はございますか。", responseText: "そのほかは大丈夫です。", audioId: "inspection_additional_service_none_customer" },
    { buttonKey: "mileage", label: "走行距離確認", keys: ["explained_duration_and_wait"], done: state.inspectionMileageAsked, na: notApplicable("explained_duration_and_wait"), staffText: "現在の走行距離は何キロくらいでしょうか。", responseText: "今、3万キロくらいです。", audioId: "inspection_current_mileage_customer" },
    { buttonKey: "duration", label: "作業時間案内", keys: ["explained_duration_and_wait"], done: anyStaffText((normalized, originalText) => hasSupportedInspectionDuration(originalText)), na: notApplicable("explained_duration_and_wait"), staffText: "基本作業は90分程度です。", responseText: "お店で待つことはできますか？", audioId: "inspection_duration_wait_missing_retry" },
    { buttonKey: "waiting", label: "店内待ち確認", keys: ["explained_duration_and_wait", "confirmed_waiting"], done: passed("explained_duration_and_wait") || passed("confirmed_waiting") || anyStaffText(explainsWaiting), na: notApplicable("explained_duration_and_wait") && notApplicable("confirmed_waiting"), staffText: "店内でお待ちになりますか。", responseText: "出かける可能性があるので、一応代車を用意してほしいんですが、できますか？", audioId: "inspection_waiting_followup_loaner_request" },
    { buttonKey: "loaner", label: "代車案内", keys: ["explained_loaner"], done: passed("explained_loaner"), na: notApplicable("explained_loaner"), staffText: "早めのご予約ですので、代車をご用意できます。", responseText: "予約しようかな。", audioId: "inspection_explained_loaner_customer" },
    { buttonKey: "bookingTime", label: "予約手続き時間", keys: ["confirmed_booking_time"], done: passed("confirmed_booking_time"), na: notApplicable("confirmed_booking_time"), staffText: "このまま予約手続きを進めます。10分程度お時間をいただきますが、よろしいでしょうか。", responseText: "大丈夫ですよ。", audioId: "inspection_confirmed_booking_time_customer" },
    { buttonKey: "appointment", label: "入庫日時確定", keys: ["proposed_appointment"], done: passed("proposed_appointment"), na: notApplicable("proposed_appointment"), staffText: "8月30日午前10時はいかがでしょうか。", responseText: "では、その日でお願いします。", audioId: "inspection_proposed_appointment_customer" },
    { buttonKey: "documents", label: "荷物・必要書類", keys: ["explained_documents"], done: passed("explained_documents"), na: notApplicable("explained_documents"), staffText: "当日は車内と荷室の荷物を降ろし、車検証、自賠責保険証明書、納税証明書をお持ちください。", responseText: "はい。", audioId: "inspection_explained_documents_customer" },
    { buttonKey: "lockArrival", label: "ロックナット・15分前", keys: ["explained_lock_and_arrival"], done: passed("explained_lock_and_arrival"), na: notApplicable("explained_lock_and_arrival"), staffText: "ロックナットを使用している場合はキーまたはアダプターをお持ちいただき、受付の15分前にご来店ください。", responseText: "分かりました。", audioId: "inspection_explained_lock_and_arrival_customer" },
    { buttonKey: "reminder", label: "3日前確認連絡", keys: ["confirmed_reminder_contact"], done: passed("confirmed_reminder_contact"), na: notApplicable("confirmed_reminder_contact"), staffText: "入庫日の3日前に確認のお電話をいたします。この携帯へのご連絡でよろしいでしょうか。", responseText: "この携帯にお願いします。", audioId: "inspection_confirmed_reminder_contact_customer" },
    { buttonKey: "recap", label: "予約内容復唱", keys: ["recapped_appointment"], done: passed("recapped_appointment"), na: notApplicable("recapped_appointment"), staffText: "佐藤様、8月30日午前10時、代車をご用意してお待ちしております。", responseText: "お願いします。", audioId: "inspection_recapped_appointment_customer" },
    { buttonKey: "closing", label: "終了挨拶", keys: ["closed_politely"], done: passed("closed_politely"), na: notApplicable("closed_politely"), staffText: "本日はありがとうございました。当日はよろしくお願いいたします。", responseText: "ありがとうございました。", audioId: "inspection_closed_politely_customer" }
  ];
  const currentStepKey = scenario.steps?.[state.scriptStep]?.key;
  const activeIndex = state.started && !state.ended
    ? checkpoints.findIndex((item) => !item.done && !item.na && item.keys.includes(currentStepKey))
    : -1;
  const fallbackActiveIndex = state.started && !state.ended && activeIndex < 0
    ? checkpoints.findIndex((item) => !item.done && !item.na)
    : activeIndex;
  const completedCount = checkpoints.filter((item) => item.done).length;

  if (els.customerSpeechSummary) {
    els.customerSpeechSummary.textContent = !state.started
      ? `開始前／全${checkpoints.length}項目`
      : `完了 ${completedCount}／${checkpoints.length}`;
  }
  if (els.requiredCustomerSpeech) {
    els.requiredCustomerSpeech.innerHTML = checkpoints.map((item, index) => {
      const status = item.done ? "done" : item.na ? "na" : index === fallbackActiveIndex ? "active" : "pending";
      const statusLabel = item.done ? "確認済み" : item.na ? "対象外" : status === "active" ? "対応中" : "未確認";
      const marker = item.done ? "✓" : String(index + 1);
      const disabled = !state.started || state.ended || state.customerReplyPending ? " disabled" : "";
      return `<button class="inspection-checkpoint is-${status}" type="button"
        data-inspection-button-key="${escapeHtml(item.buttonKey)}"
        data-inspection-staff-text="${escapeHtml(item.staffText)}"
        data-inspection-response="${escapeHtml(item.responseText)}"
        data-inspection-audio-id="${escapeHtml(item.audioId)}"
        aria-label="${escapeHtml(item.label)}: ${statusLabel}。スタッフ発話の代わりに押す"${disabled}>
        <span class="inspection-checkpoint-number">${marker}</span>
        <strong>${escapeHtml(item.label)}</strong>
        <span class="inspection-checkpoint-state">${statusLabel}</span>
      </button>`;
    }).join("");
  }
  if (els.confirmedCustomerSpeech) {
    els.confirmedCustomerSpeech.innerHTML = "";
  }
}

function handleInspectionCheckpointTest(event) {
  const button = event.target.closest("[data-inspection-button-key]");
  if (
    !button
    || scenario.id !== "vehicle-inspection-phone-followup"
    || !state.started
    || state.ended
    || state.customerReplyPending
  ) return;

  const buttonKey = button.dataset.inspectionButtonKey || "";
  const staffText = button.dataset.inspectionStaffText || "";
  const responseText = button.dataset.inspectionResponse || "";
  const audioId = button.dataset.inspectionAudioId || "";
  if (!buttonKey || !staffText || !responseText) return;

  stopSpeechInput();
  stopCustomerPlayback();
  addMessage("staff", staffText, { immediate: true, hiddenFromConversation: true });
  state.inspectionButtonChecks[buttonKey] = true;

  const markPassed = (key) => {
    const step = scenario.steps.find((item) => item.key === key);
    if (step) markScriptedStepPassed(step, `進行ボタン: ${buttonKey}`);
  };
  const directStepKeys = {
    identity: ["confirmed_identity"],
    introduction: ["introduced_self"],
    thanks: ["thanked_customer"],
    inspectionNotice: ["explained_inspection_notice", "explained_available_period"],
    availability: ["asked_availability"],
    concerns: ["asked_vehicle_concerns"],
    loaner: ["explained_loaner"],
    bookingTime: ["confirmed_booking_time"],
    documents: ["explained_documents"],
    lockArrival: ["explained_lock_and_arrival"],
    reminder: ["confirmed_reminder_contact"],
    recap: ["recapped_appointment"],
    closing: ["closed_politely"]
  };
  (directStepKeys[buttonKey] || []).forEach(markPassed);
  if (buttonKey === "mileage") state.inspectionMileageAsked = true;
  if (["mileage", "duration", "waiting"].every((key) => state.inspectionButtonChecks[key])) {
    markPassed("explained_duration_and_wait");
  }
  if (buttonKey === "waiting") markPassed("confirmed_waiting");
  if (buttonKey === "appointment") {
    state.proposedAppointment = { month: 8, day: 30, hour: 10, minute: 0 };
    markPassed("proposed_appointment");
  }

  while (
    scenario.steps[state.scriptStep]
    && state.analyses.some((analysis) =>
      analysis.stepKey === scenario.steps[state.scriptStep].key
      && (analysis.passed || analysis.notApplicable)
    )
  ) {
    state.scriptStep += 1;
  }
  if (scenario.steps[state.scriptStep]) {
    state.currentState = scenario.steps[state.scriptStep].state;
  }
  state.turn += 1;
  if (els.speechNote) {
    els.speechNote.textContent = "ボタンをスタッフ発話として反映しました。AIお客様の音声終了後に次の項目を選べます。";
  }
  const finished = buttonKey === "closing" && Boolean(state.proposedAppointment);
  addMessage("customer", responseText, {
    audioId,
    immediate: true,
    skipSpeechInputRestart: true,
    onCommitted: finished
      ? () => finishRoleplay({ keepCustomerPlayback: true })
      : null
  });
  renderProgress();
}

function renderProgress() {
  const visible = els.progressEnabled?.checked !== false;
  const customerVisible = renderCustomerInfo();
  const usesInspectionCheckpoints = scenario.id === "vehicle-inspection-phone-followup";
  if (els.stickyContext) els.stickyContext.hidden = !customerVisible && !visible;
  if (els.progressPanel) els.progressPanel.hidden = !visible || usesInspectionCheckpoints;
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
  if (!usesInspectionCheckpoints) {
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
  }
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

function interactionDelayMs() {
  const selected = Number(els.interactionDelaySelect?.value);
  return [500, 800, 1000, 1500, 2000].includes(selected) ? selected : 1500;
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
    audioSrc: audioPath(registeredCustomerMessage.audioId),
    hiddenFromConversation: options.hiddenFromConversation === true
  };
  state.transcript.push(message);
  if (
    role === "customer"
    && scenario.id === "vehicle-inspection-phone-followup"
    && /代車.*(?:貸して|用意して|借りたい|お願い|ほしい)/.test(normalizeScriptedText(message.text))
  ) {
    state.inspectionLoanerRequested = true;
  }
  if (
    role === "customer"
    && scenario.id === "vehicle-inspection-phone-followup"
    && /どれ(?:くらい|ぐらい).*時間.*かか/.test(normalizeScriptedText(message.text))
  ) {
    state.inspectionDurationQuestionAsked = true;
  }
  renderConversation();
  renderProgress();
  if (role === "customer") {
    const onCustomerFinished = options.skipSpeechInputRestart === true
      ? null
      : startSpeechInputAfterCustomer;
    if (els.audioEnabled.checked && message.audioSrc) {
      playAudio(message.audioSrc, message.text, false, onCustomerFinished);
    } else if (
      els.audioEnabled.checked
      && scenario.id !== "service-12month-visit-promotion"
    ) {
      speakCustomerText(message.text, onCustomerFinished);
    } else if (onCustomerFinished) {
      onCustomerFinished();
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
    && !interactionDelayAlreadyElapsed
      ? interactionDelayMs()
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
  if (els.conversationHighlightLegend) {
    els.conversationHighlightLegend.hidden = scenario.id !== "vehicle-inspection-phone-followup";
  }
  if (state.transcript.length === 0) {
    els.conversation.innerHTML = `
      <div class="empty-state">
        <strong>ロープレ開始を押してください</strong>
        <span>AIお客様役との会話がここに表示されます。</span>
      </div>`;
    return;
  }

  els.conversation.innerHTML = state.transcript
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => !message.hiddenFromConversation)
    .map(({ message, index }) => {
      const roleClass = message.role === "customer" ? "customer" : message.role === "staff" ? "staff" : "system";
      const speaker = message.role === "customer" ? "AIお客様" : message.role === "staff" ? "スタッフ" : "判定メモ";
      const audioButton = message.role === "customer"
        ? `<button class="play-audio" type="button" data-audio-index="${index}" aria-label="お客様音声を再生">再生</button>`
        : "";
      const issueButton = message.role === "customer"
        ? `<button class="report-audio" type="button" data-report-audio-index="${index}" aria-label="矛盾または不足音声として記録">矛盾・音声不足を記録</button>`
        : "";
      const messageText = message.role === "staff"
        && scenario.id === "vehicle-inspection-phone-followup"
          ? renderInspectionConversationHighlights(message.text)
          : escapeHtml(message.text);
      return `
        <div class="message ${roleClass}">
          <div class="message-top">
            <span class="speaker">${speaker}</span>
            <span class="message-tools">${audioButton}${issueButton}</span>
          </div>
          <span>${messageText}</span>
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

function beginAutomaticSpeechInput(noteText, retryCount = 0) {
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
  } catch (error) {
    speechListening = false;
    updateMicButton(false);
    // recognition.stop()の完了前にstart()すると、ブラウザーによっては
    // InvalidStateErrorになる。予約確定後の「かしこまりました」など、
    // AI音声を挟まず入力を続ける場面でもマイクをOFFのままにしない。
    if (
      error?.name === "InvalidStateError"
      && retryCount < 6
      && state.started
      && !state.ended
    ) {
      if (speechInputStartTimer) window.clearTimeout(speechInputStartTimer);
      els.speechNote.textContent = "音声入力の再開を待っています。";
      speechInputStartTimer = window.setTimeout(() => {
        speechInputStartTimer = null;
        beginAutomaticSpeechInput(noteText, retryCount + 1);
      }, 120);
      return false;
    }
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
}

function inspectionHighlightPassed(stepKey) {
  return state.analyses.some((analysis) =>
    analysis.stepKey === stepKey && analysis.passed === true
  );
}

function inspectionHighlightPatterns(text) {
  const normalized = normalizeScriptedText(text);
  const rules = [];
  const add = (stepKey, patterns) => rules.push({
    stepKey,
    label: (scenario.scoring || []).find((item) => item.key === stepKey)?.label || stepKey,
    confirmed: inspectionHighlightPassed(stepKey),
    patterns
  });
  const customerName = String(scenario.customerName || "佐藤").replace(/様/g, "");
  const vehicleName = String(scenario.vehicleName || "ヤリス");
  const expiryDate = normalizeScriptedText(scenario.expiryDate || "");
  const escapePattern = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (isScriptedQuestion(normalized) && [customerName, "佐藤", "斉藤"].some((name) => name && normalized.includes(name))) {
    add("confirmed_identity", [new RegExp(`${escapePattern(customerName || "佐藤")}\\s*様?`, "g"), /佐藤\s*様?/g, /斉藤\s*様?/g]);
  }
  if (/(?:トヨタ|とよた|豊田)/.test(normalized)) {
    add("introduced_self", [/(?:トヨタ|とよた|豊田)(?:\s*(?:モビリティ|もびりてぃ|モビリヒロ|もびりひろ))?(?:\s*(?:帯広|おびひろ))?/g, /[一-龯々ぁ-んァ-ヶー]{1,12}\s*(?:と\s*(?:申|もう)します|で\s*ございます|と\s*(?:言|い)います)/g]);
  }
  if (hasCourtesyExpression(normalized)) {
    add("thanked_customer", [/(?:日頃|いつも|平素)/g, /お世話にな(?:って(?:おります|います)|り(?:まして)?)/g, /(?:ご利用|ご愛顧)/g, /(?:ありがとう|感謝)/g]);
  }
  if (hasClearInspectionPurposeNotice(normalized)) {
    add("explained_inspection_notice", [new RegExp(escapePattern(vehicleName), "g"), /車検/g, /[0-9０-９]{1,2}\s*月\s*(?:の\s*)?[0-9０-９]{1,2}\s*日/g]);
  }
  if (hasInspectionBookingInvitation(normalized)) {
    add("asked_availability", [/(?:ご都合|都合|ご予定|予定|日程|予約)/g, /(?:お決まり|決まり|いかが|よろしい)/g]);
  }
  if (expiryDate && normalized.includes(expiryDate)) {
    add("explained_available_period", [/[0-9０-９]{1,2}\s*月\s*(?:の\s*)?[0-9０-９]{1,2}\s*日/g, /(?:満了日|満了)/g]);
  }
  if (/(?:走行距離|何キロ|\d+\s*(?:万)?\s*(?:km|キロ)|60分|六十分|75分|七十五分|90分|九十分|1時間|一時間|店内|店舗で|お待ち|待て|待つ)/i.test(normalized)) {
    add("explained_duration_and_wait", [/(?:走行距離|何\s*キロ|[0-9０-９]+\s*(?:万)?\s*(?:km|キロ))/gi, /(?:[6６][0０]\s*分|六十分|[7７][5５]\s*分|七十五分|[9９][0０]\s*分|九十分|[1１]\s*時間|一時間)/g, /(?:店内|店舗で|お待ち|待て|待つ)/g]);
  }
  if (/(?:代車|代わりのお車|代替車)/.test(normalized)) {
    add("explained_loaner", [/(?:代車|代わりのお車|代替車)/g, /(?:ご用意|用意|準備|手配)/g, /(?:早め|お早め|予約)/g]);
  }
  if (hasBookingContinuationConfirmation(normalized)) {
    add("confirmed_booking_time", [/(?:このまま|予約手続き|予約|手続き|進め|続け)/g, /(?:[1１][0０]\s*分|十分|もう少し|お時間|時間)/g]);
  }
  if (inspectionAppointmentProposalMatch(normalized)) {
    add("proposed_appointment", [/[0-9０-９]{1,2}\s*月\s*(?:の\s*)?[0-9０-９]{1,2}\s*日/g, /(?:午前|午後)?\s*[0-9０-９]{1,2}\s*時/g, /(?:いかが|どうでしょう)/g]);
  }
  if (/(?:店内|店舗で|お待ち|待て|待つ|代車|代わりのお車)/.test(normalized) && isScriptedQuestion(normalized)) {
    add("confirmed_waiting", [/(?:店内|店舗で|お待ち|待て|待つ|代車|代わりのお車)/g]);
  }
  if (isScriptedQuestion(normalized) && /(?:気になる|不具合|調子|具合|追加作業|オイル交換)/.test(normalized)) {
    add("asked_vehicle_concerns", [/(?:気になる|不具合|調子|具合|追加作業|オイル交換)/g]);
  }
  if (inspectionTextHasSplitGuidanceKey(normalized, "explained_documents")) {
    add("explained_documents", [/(?:荷物|荷室|トランク|空荷)/g, /(?:車検証|自賠責(?:保険証明書|保険証書)?|納税証明書?)/g, /(?:降ろ|下ろ|積まない|積まず|空に|ない状態)/g]);
  }
  if (inspectionTextHasSplitGuidanceKey(normalized, "explained_lock_and_arrival")) {
    add("explained_lock_and_arrival", [/(?:ロックナットキー|ロックキー|ロックナット|アダプター|専用工具|外す工具)/g, /(?:[1１][0０]\s*分前|十分前|[1１][5５]\s*分前|十五分前|早め)/g]);
  }
  if (inspectionTextHasSplitGuidanceKey(normalized, "confirmed_reminder_contact")) {
    add("confirmed_reminder_contact", [/(?:[3３]\s*日前|三日前)/g, /(?:確認|連絡|電話)/g, /(?:この携帯|この電話|同じ電話|連絡先|電話番号)/g]);
  }
  const appointment = state.proposedAppointment;
  if (appointment
    && normalized.includes(`${appointment.month}月`)
    && normalized.includes(`${appointment.day}日`)
    && normalized.includes(`${appointment.hour}時`)
    && (Number(appointment.minute || 0) === 0
      ? !new RegExp(`${appointment.hour}時(?:半|\\d{1,2}分)`).test(normalized)
      : Number(appointment.minute) === 30
        ? new RegExp(`${appointment.hour}時(?:半|30分)`).test(normalized)
        : normalized.includes(`${appointment.hour}時${appointment.minute}分`))
    && [customerName, "佐藤", "斉藤"].some((name) => name && normalized.includes(name))) {
    add("recapped_appointment", [new RegExp(`${escapePattern(customerName || "佐藤")}\\s*様?`, "g"), /佐藤\s*様?/g, /斉藤\s*様?/g, /[0-9０-９]{1,2}\s*月\s*(?:の\s*)?[0-9０-９]{1,2}\s*日/g, /(?:午前|午後)?\s*[0-9０-９]{1,2}\s*時/g]);
  }
  if (/ありがとうございました/.test(normalized)) {
    add("closed_politely", [/ありがとうございました/g]);
  }
  return rules;
}

function renderInspectionConversationHighlights(text) {
  const ranges = [];
  inspectionHighlightPatterns(text).forEach((rule) => {
    rule.patterns.forEach((pattern) => {
      const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
      const matcher = new RegExp(pattern.source, flags);
      let match;
      while ((match = matcher.exec(text)) !== null) {
        if (!match[0]) {
          matcher.lastIndex += 1;
          continue;
        }
        ranges.push({
          start: match.index,
          end: match.index + match[0].length,
          confirmed: rule.confirmed,
          label: rule.label
        });
      }
    });
  });
  if (ranges.length === 0) return escapeHtml(text);

  const boundaries = [...new Set([0, text.length, ...ranges.flatMap((range) => [range.start, range.end])])]
    .sort((left, right) => left - right);
  let html = "";
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const segment = text.slice(start, end);
    const covering = ranges.filter((range) => range.start <= start && range.end >= end);
    if (covering.length === 0) {
      html += escapeHtml(segment);
      continue;
    }
    const confirmed = covering.some((range) => range.confirmed);
    const labels = [...new Set(covering.map((range) => range.label))].join("／");
    const status = confirmed ? "確認済み" : "一部認識";
    html += `<mark class="conversation-keyword ${confirmed ? "is-confirmed" : "is-partial"}" title="${escapeHtml(`${status}：${labels}`)}">${escapeHtml(segment)}</mark>`;
  }
  return html;
}

function continueSpeechInputWithoutCustomerReply(noteText) {
  if (speechInputStartTimer) {
    window.clearTimeout(speechInputStartTimer);
  }
  speechInputStartTimer = window.setTimeout(() => {
    speechInputStartTimer = null;
    beginAutomaticSpeechInput(noteText);
  }, 180);
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
  const withoutTrailingPunctuation = normalized.replace(/[、。,.！？!?]+$/g, "");
  if (/(?:それから|それと|それともし|それともしも|そして|続いて|このあと|そのあと|ええと|えっと|あの|あと)$/.test(withoutTrailingPunctuation)) {
    return false;
  }
  // 語尾の句点だけで完成文とみなさない。Web Speech APIが
  // 「お使いのヤリスが。」のような助詞終わりをisFinalで返す場合も続きを待つ。
  if (/(?:が|を|に|の|と|で|へ|から|ので|けど|ですが|ますが|ましたが)$/.test(withoutTrailingPunctuation)) {
    return false;
  }
  const completeShortReplies = [
    "はい", "いいえ", "大丈夫です", "いいですよ", "良いですよ",
    "わかりました", "分かりました", "承知しました", "かしこまりました", "行きます", "いきます"
  ];
  if (completeShortReplies.includes(normalized)) return true;
  if (hasTrailingServiceInquiry(normalized)) return true;
  if (normalized.length < 5) return false;
  return /(?:です|ます|ました|ません|でしょう|ください|お願いします|と思います|できます|できません|出来ます|出来ません|伺います|行きます|します|ですか|ますか|でしょうか|[。！？!?])$/.test(normalized);
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
  state.inspectionDurationQuestionAsked = false;
  state.inspectionDurationProgressionPending = false;
  state.inspectionWaitingRequested = false;
  state.inspectionLoanerRequested = false;
  state.inspectionLoanerConfirmed = false;
  state.inspectionButtonChecks = {};
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

function normalizeKanjiScheduleHours(text) {
  const kanjiHours = {
    "二十三": 23, "二十二": 22, "二十一": 21, "二十": 20,
    "十九": 19, "十八": 18, "十七": 17, "十六": 16, "十五": 15,
    "十四": 14, "十三": 13, "十二": 12, "十一": 11, "十": 10,
    "九": 9, "八": 8, "七": 7, "六": 6, "五": 5,
    "四": 4, "三": 3, "二": 2, "一": 1
  };
  const pattern = Object.keys(kanjiHours).join("|");
  return String(text || "").replace(
    new RegExp(`(${pattern})時(?!間|点)`, "g"),
    (match, hour) => `${kanjiHours[hour]}時`
  );
}

function extractScheduleTimeOptions(normalized) {
  const scheduleText = normalizeKanjiScheduleHours(normalized);
  const timeOptions = [...scheduleText.matchAll(/(\d{1,2})時(?!間|点)/g)].map((match) => {
    let hour = Number.parseInt(match[1], 10);
    const context = scheduleText.slice(Math.max(0, match.index - 24), match.index);
    const lastMorningMarker = Math.max(
      context.lastIndexOf("午前"),
      context.lastIndexOf("朝")
    );
    const lastAfternoonMarker = Math.max(
      context.lastIndexOf("午後"),
      context.lastIndexOf("お昼から"),
      context.lastIndexOf("昼から"),
      context.lastIndexOf("お昼"),
      context.lastIndexOf("昼頃"),
      context.lastIndexOf("昼過ぎ"),
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

function hasInspectionOilChangeRequest() {
  return state.transcript.some((message) =>
    message.role === "customer"
    && normalizeScriptedText(message.text).includes("オイル交換")
  );
}

function asksInspectionAdditionalServiceFollowUp(text) {
  const normalized = normalizeScriptedText(text);
  if (!isScriptedQuestion(normalized)) return false;
  const asksAboutOtherWork = /(?:その他|そのほか|ほかに|他に|追加)/.test(normalized);
  // 「追加整備」だけでなく、音声会話で自然に挟まれる
  // 「追加する整備」「ほかに整備」なども同じ再確認として扱う。
  const hasServiceContext = /(?:追加作業|追加整備|ご用命|オイル交換|作業|整備)/.test(normalized);
  return asksAboutOtherWork && hasServiceContext;
}

function analyzeStaff(text) {
  // 音声認識が主要語をひらがなで返した場合も、表示文を変更せず判定だけをそろえる。
  const normalized = normalizeScriptedText(text);
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
  return String(text || "").replace(/(?:台車|代償)/g, "代車");
}

function normalizeScriptedText(text) {
  let normalized = String(text || "")
    .replace(/[０-９]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0xFEE0)
    )
    // 音声認識が「ついたち」を漢字の「一日」で返した場合も、
    // 月の直後だけを予約日の1日として扱う。「作業に一日かかる」は変換しない。
    .replace(/(\d{1,2}月)の?一日(?!間)/g, (match, month) => `${month}1日`)
    .replace(/(\d{1,2}月)の(?=\d{1,2}日)/g, "$1")
    .replace(/(?:台車|代償)/g, "代車")
    .replace(/\s+/g, "");

  // 日付で使われる固有の読みを先に数値へ変換する。
  const specialDayReadings = [
    ["ついたち", 1], ["ふつか", 2], ["みっか", 3], ["よっか", 4],
    ["いつか", 5], ["むいか", 6], ["なのか", 7], ["ようか", 8],
    ["ここのか", 9], ["とおか", 10], ["じゅうよっか", 14],
    ["はつか", 20], ["にじゅうよっか", 24]
  ];
  specialDayReadings
    .sort(([left], [right]) => right.length - left.length)
    .forEach(([reading, value]) => {
    normalized = normalized.replace(new RegExp(reading, "g"), `${value}日`);
    });

  // 月日・時刻・分数に続くひらがなの数詞だけを数値化する。
  // 通常文中の数詞は変換しないため、表示や別の語への誤補正を避ける。
  const digitReadings = {
    1: ["いち"], 2: ["に"], 3: ["さん"], 4: ["よん", "し"],
    5: ["ご"], 6: ["ろく"], 7: ["なな", "しち"],
    8: ["はち"], 9: ["きゅう", "く"]
  };
  const kanaNumberMap = new Map();
  for (let value = 1; value <= 99; value += 1) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    const tensReadings = tens === 0
      ? [""]
      : tens === 1
        ? ["じゅう"]
        : digitReadings[tens].map((reading) => `${reading}じゅう`);
    const onesReadings = ones === 0 ? [""] : digitReadings[ones];
    tensReadings.forEach((tensReading) => {
      onesReadings.forEach((onesReading) => {
        kanaNumberMap.set(`${tensReading}${onesReading}`, value);
      });
    });
  }
  const kanaNumberPattern = [...kanaNumberMap.keys()]
    .sort((left, right) => right.length - left.length)
    .join("|");
  const replaceKanaNumber = (match, reading, unit) => `${kanaNumberMap.get(reading)}${unit}`;
  normalized = normalized
    .replace(/じゅっ(?=ぷん)/g, "じゅう")
    .replace(/じっ(?=ぷん)/g, "じゅう")
    .replace(new RegExp(`(${kanaNumberPattern})がつ`, "g"), (match, reading) => replaceKanaNumber(match, reading, "月"))
    .replace(new RegExp(`(${kanaNumberPattern})にち`, "g"), (match, reading) => replaceKanaNumber(match, reading, "日"))
    .replace(new RegExp(`(${kanaNumberPattern})じかん`, "g"), (match, reading) => replaceKanaNumber(match, reading, "時間"))
    .replace(
      new RegExp(`(${kanaNumberPattern})じ(?=$|[、。,.!?！？]|から|まで|では|です|に|の|が|を|と|は)`, "g"),
      (match, reading) => replaceKanaNumber(match, reading, "時")
    )
    .replace(new RegExp(`(${kanaNumberPattern})(?:ふん|ぷん)`, "g"), (match, reading) => replaceKanaNumber(match, reading, "分"))
    .replace(/(\d{1,2})じかん/g, "$1時間")
    .replace(/(\d{1,2})時間はん/g, "$1時間半")
    .replace(/(\d{1,2}(?:日|分))まえ/g, "$1前")
    // 「くがつの一日」は、月を数値化した後に「9月1日」へそろえる。
    // 「作業に一日かかる」のような期間表現は月の直後ではないため変換しない。
    .replace(/(\d{1,2}月)の?一日(?!間)/g, (match, month) => `${month}1日`)
    // 「くがつの30日」のように月だけがひらがなの場合、月を数値化した後で
    // 残る「の」を除去し、登録済みの「9月30日」と同じ判定値にそろえる。
    .replace(/(\d{1,2}月)の(?=\d{1,2}日)/g, "$1");

  // 判定専用の同義表記。会話欄・保存ログの発話原文には適用しない。
  const recognitionAliases = [
    [/豊田(?=(?:モビリティ|もびりてぃ|モビリヒロ|もびりひろ))/g, "トヨタ"],
    [/(?:とよたもびりてぃ|トヨタもびりてぃ)/g, "トヨタモビリティ"],
    [/おびひろ/g, "帯広"], [/ふちやま/g, "渕山"],
    [/さとう/g, "佐藤"], [/さいとう/g, "斉藤"],
    [/(?:やりす|ヤリす|やるしす|ヤルシス)/g, "ヤリス"],
    [/のうぜいしょうめいしょ/g, "納税証明書"], [/のうぜいしょうめい/g, "納税証明"],
    [/しゃけんしょう/g, "車検証"], [/じばいせき/g, "自賠責"],
    [/しゃけん/g, "車検"], [/てんけん/g, "点検"], [/まんりょう/g, "満了"],
    [/さぎょう/g, "作業"], [/にゅうこ/g, "入庫"], [/かのう/g, "可能"], [/だいしゃ/g, "代車"],
    [/ごりよう/g, "ご利用"], [/ごあいこ/g, "ご愛顧"], [/かんしゃ/g, "感謝"],
    [/ごつごう/g, "ご都合"], [/つごう/g, "都合"], [/よてい/g, "予定"],
    [/にってい/g, "日程"], [/(?:よやく|ご役)/g, "予約"], [/てつづき/g, "手続き"],
    [/ごきぼう/g, "ご希望"], [/きぼう/g, "希望"], [/ひにち/g, "日にち"],
    [/そうこうきょり/g, "走行距離"], [/きょりすう/g, "距離数"], [/なんきろ/g, "何キロ"],
    [/おいるこうかん/g, "オイル交換"], [/ついかせいび/g, "追加整備"], [/ごようめい/g, "ご用命"],
    [/てんない/g, "店内"], [/おはやめ/g, "お早め"], [/はやめ/g, "早め"], [/ようい/g, "用意"],
    [/じゅんび/g, "準備"], [/てはい/g, "手配"], [/いらい/g, "依頼"],
    [/きになる/g, "気になる"], [/ふぐあい/g, "不具合"], [/ちょうし/g, "調子"],
    [/ぐあい/g, "具合"], [/いおん/g, "異音"], [/しょうじょう/g, "症状"], [/いわかん/g, "違和感"],
    [/にもつ/g, "荷物"], [/ろっくなっときー/g, "ロックナットキー"],
    [/ろっくなっと/g, "ロックナット"], [/ろっくきー/g, "ロックキー"],
    [/あだぷたー/g, "アダプター"], [/せんようこうぐ/g, "専用工具"], [/こうぐ/g, "工具"], [/どうぐ/g, "道具"],
    [/(?:さんにちまえ|みっかまえ)/g, "3日前"], [/れんらく/g, "連絡"],
    [/けいたい/g, "携帯"], [/でんわばんごう/g, "電話番号"],
    [/へいじつ/g, "平日"], [/どにち/g, "土日"], [/しゅうまつ/g, "週末"],
    [/どよう/g, "土曜"], [/にちよう/g, "日曜"], [/きゅうじつ/g, "休日"],
    [/ごぜん/g, "午前"], [/ごご/g, "午後"], [/じかんたい/g, "時間帯"],
    [/ひきとり/g, "引き取り"], [/じたく/g, "自宅"], [/しょくば/g, "職場"],
    [/うんてん/g, "運転"], [/ふあん/g, "不安"], [/しごと/g, "仕事"],
    [/はたけ/g, "畑"], [/いそがしい/g, "忙しい"], [/とおい/g, "遠い"], [/きょり/g, "距離"],
    [/らいてん/g, "来店"], [/せつめい/g, "説明"], [/あんしん/g, "安心"],
    [/ちかくのおみせ/g, "近くのお店"], [/ちかいてんぽ/g, "近い店舗"],
    [/もよりのてんぽ/g, "最寄りの店舗"], [/たてんぽ/g, "他店舗"], [/べつてんぽ/g, "別店舗"],
    [/ごしゅじん/g, "ご主人"], [/かぞく/g, "家族"], [/しゅじん/g, "主人"], [/しょうち/g, "承知"]
  ];
  recognitionAliases.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized;
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

function asksInspectionWaitingMethodConfirmation(text) {
  const normalized = normalizeScriptedText(text);
  const hasWaitingContext = /(?:待|店内)/.test(normalized);
  const asksCustomerToWait = /(?:お待ちいただけますか|お待ちになりますか|待たれますか|待っていただけますか)/.test(normalized);
  return hasWaitingContext && asksCustomerToWait;
}

function asksInspectionLoanerNeed(text) {
  const normalized = normalizeScriptedText(text);
  const hasLoanerContext = /(?:代車|代わりのお車|代わりの車|代替車)/.test(normalized);
  const asksNeedOrUse = /(?:必要|使い|お使い|利用|いかがいたしましょう|いかがでしょう|どうされます|どうします)/.test(normalized);
  const isChoiceQuestion = /(?:でしょうか|ますか|ですか|[?？])/.test(normalized)
    || /(?:いかがいたしましょう|どうされます|どうします)/.test(normalized);
  return hasLoanerContext && asksNeedOrUse && isChoiceQuestion;
}

function hasInspectionLoanerConfirmation(text, allowImplicitLoaner = false) {
  const normalized = normalizeScriptedText(text);
  const clauses = [...normalized.matchAll(/([^。.!！?？]+)([。.!！?？]+|$)/g)]
    .map((match) => ({
      text: match[1],
      hasQuestionMark: /[?？]/.test(match[2] || "")
    }))
    .filter((clause) => clause.text);
  const candidates = [...clauses];
  // 音声認識が「代車ですね。」「ご用意は。」「問題なくできます。」のように
  // 一続きの承諾を短く区切る場合があるため、隣接する最大3文も合わせて判定する。
  for (let size = 2; size <= 3; size += 1) {
    for (let start = 0; start + size <= clauses.length; start += 1) {
      const adjacentClauses = clauses.slice(start, start + size);
      candidates.push({
        text: adjacentClauses.map((clause) => clause.text).join(""),
        hasQuestionMark: adjacentClauses.some((clause) => clause.hasQuestionMark)
      });
    }
  }
  return candidates.some((candidate) => {
    const clause = candidate.text;
    const hasLoaner = /(?:代車|代わりの車)/.test(clause) || allowImplicitLoaner;
    const hasArrangement = /(?:用意|準備|手配|依頼)/.test(clause);
    const hasNegative = /(?:できません|できない|難しい|空きがない|空いていない|空いていません|空いてません|用意がない|用意はない)/.test(clause);
    const isPendingConfirmation = /(?:できるか|可能か|空き(?:を|が)?).*確認(?:します|いたします|して)/.test(clause);
    const hasCommitment = /(?:できます|出来ます|(?:できる|出来る)(?:か)?と思います|可能です|いたします|します|させていただ|しておきます|しておきましょう|なります)/.test(clause)
      || /(?:できる|出来る)$/.test(clause);
    const isQuestion = candidate.hasQuestionMark
      || /(?:でしょうか|ますか|ですか|ませんか|ございませんか)/.test(clause);
    const hasContextualAvailability = allowImplicitLoaner
      && /(?:空いて(?:ます|います|る)|空き(?:が)?あります)/.test(clause)
      && !isQuestion;
    const hasContextualAffirmation = allowImplicitLoaner
      && /(?:(?:大丈夫|だいじょうぶ)(?:です(?:よ)?)?|できます|出来ます|可能です)$/.test(clause)
      && !isQuestion;
    const confirmsArrangement = hasArrangement && hasCommitment;
    return hasLoaner
      && (confirmsArrangement || hasContextualAvailability || hasContextualAffirmation)
      && !hasNegative
      && !isPendingConfirmation
      && !isQuestion;
  });
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
  const asksPermission = /(?:よろしい|大丈夫|ありますか|ございます|いただけ(?:ます|る)|構いません|構わない)/.test(normalized)
    || /(?:予約|手続き).{0,24}いかが(?:でしょうか|ですか)/.test(normalized);
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

function isInspectionDurationProgressAcknowledgement(text) {
  const normalized = String(text || "").replace(/[\s、。,.!?！？]/g, "");
  return /^(?:ありがとうございます|ありがとう)$/.test(normalized);
}

function hasInspectionBookingInvitation(text) {
  const normalized = normalizeScriptedText(text);
  if (!isScriptedQuestion(normalized)) return false;
  if (/(?:車検).{0,16}(?:お?決まり|決めて|決められ)/.test(normalized)) return true;
  const asksWhetherInspectionPlanIsDecided = /(?:ご)?予定.{0,12}(?:お?決まり|決めて|決められ)/.test(normalized);
  const includesConcreteInspectionTiming = normalized.includes("車検")
    && /\d{1,2}月\d{1,2}日/.test(normalized)
    && /(?:満了|まで|となり|となって)/.test(normalized);
  if (asksWhetherInspectionPlanIsDecided && includesConcreteInspectionTiming) return true;
  if (!normalized.includes("予約")) return false;
  if (/(?:代車.{0,10}予約|予約.{0,10}代車)/.test(normalized)) return false;
  return /(?:この電話|お電話).{0,16}(?:ご)?予約/.test(normalized)
    || /(?:ご)?予約(?:を)?(?:承|お取り|取れ|でき|進め|しま)/.test(normalized)
    || /(?:ご)?予約.{0,12}いかが/.test(normalized);
}

function hasInspectionAvailabilityRequest(text) {
  const normalized = normalizeScriptedText(text);
  if (hasInspectionBookingInvitation(normalized)) return true;

  // 「ご都合の良い日を教えていただければと思います」のように、
  // 疑問形ではなく依頼形で希望日を尋ねる自然な電話表現も都合確認とする。
  const hasAvailabilityContext = /(?:ご)?都合|(?:ご)?予定|希望(?:日|日時)|日程/.test(normalized);
  const requestsCustomerChoice = /(?:いかが|よろしい|教えて|お聞かせ|伺え|お知らせ|ご提示|いただければ|お願い(?:いた)?します)/.test(normalized);
  return hasAvailabilityContext && requestsCustomerChoice;
}

function hasDirectInspectionBookingInvitation(text) {
  const normalized = normalizeScriptedText(text);
  if (!isScriptedQuestion(normalized)) return false;
  if (!normalized.includes("予約")) return false;
  if (/(?:代車.{0,10}予約|予約.{0,10}代車)/.test(normalized)) return false;
  return /(?:この電話|お電話|このまま).{0,16}(?:ご)?予約/.test(normalized)
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

function isInspectionDeadlineDateCandidate(normalized, date) {
  const precedingText = normalized.slice(Math.max(0, date.index - 18), date.index);
  const followingText = normalized.slice(date.end, date.end + 14);
  const hasDeadlineLabel = /(?:満了日?|車検期限|有効期限)[^月日]{0,8}$/.test(precedingText);
  const hasVehicleDeadlineWording = /車検[^予約日程]{0,10}$/.test(precedingText)
    && /^(?:まで|となり|となって)/.test(followingText);
  return hasDeadlineLabel || hasVehicleDeadlineWording;
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

  return [...explicitDates, ...contextualDates]
    .filter((date) => !isInspectionDeadlineDateCandidate(normalized, date))
    .sort((a, b) => a.index - b.index);
}

function inspectionAppointmentProposalMatch(text) {
  const normalized = normalizeScriptedText(text);
  for (const date of inspectionAppointmentDateCandidates(normalized)) {
    const timeMatch = normalized.slice(date.end).match(/(\d{1,2})時(?:(半)|(\d{1,2})分)?/);
    if (timeMatch) {
      return {
        month: date.month,
        day: date.day,
        hour: timeMatch[1],
        minute: timeMatch[2] === "半" ? 30 : Number(timeMatch[3] || 0)
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

function shouldAnswerCombinedInspectionAvailability(text, startingIndex, currentIndex) {
  const availabilityIndex = scenario.steps.findIndex((item) => item.key === "asked_availability");
  const availabilityStep = scenario.steps[availabilityIndex];
  return Boolean(
    availabilityStep
    && advancedPastScriptedStep(startingIndex, currentIndex, scenario.steps, "asked_availability")
    && scriptedStepMatches(text, availabilityStep)
  );
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
  // 担当者名は特定の個人名へ固定せず、店舗名に続く任意の氏名と
  // 「と申します／でございます／と言います」等の名乗り語尾で確認する。
  // 「帯広本別店」のように地域名と担当者名の間へ支店名が入る正式名称も許容する。
  // 音声認識で「店」が省略された「帯広本別」や、途中に読点が入る「帯広本、別」も同じ店舗名として扱う。
  return /(?:(?:トヨタ|とよた|豊田)(?:モビリティ|もびりてぃ)(?:帯広|おびひろ)(?:(?:本[、,]?別(?:店)?)|(?:[一-龯々ぁ-んァ-ヶー]{1,12}店))?|(?:トヨタ|とよた|豊田)(?:モビリティ|もびりてぃ)|(?:トヨタ|とよた|豊田)(?:モビリヒロ|もびりひろ)|トヨタ|とよた)(?:の|、)[、,]?[一-龯々ぁ-んァ-ヶー]{1,12}(?:です|で[、,]?ございます|と[、,]?(?:申|もう)します|と[、,]?(?:言|い)います)/.test(normalized);
}

function hasInspectionDocumentGuidance(text) {
  const normalized = normalizeScriptedText(text);
  const hasEmptyVehicleGuidance = /(?:荷物|空荷)/.test(normalized)
    && /(?:降ろ|下ろ|積まない|積まず|空に|ない状態)/.test(normalized);
  return hasEmptyVehicleGuidance
    && normalized.includes("納税証明")
    && normalized.includes("車検証")
    && normalized.includes("自賠責");
}

function inspectionTextHasSplitGuidanceKey(text, stepKey) {
  const normalized = normalizeScriptedText(text);
  if (stepKey === "explained_documents") {
    return /(?:荷物|荷室|トランク|空荷|車検証|自賠責|納税証明|持ち物)/.test(normalized);
  }
  if (stepKey === "explained_lock_and_arrival") {
    return /(?:ロック|ナット|アダプター|専用工具|外す工具|受付|10分前|十分前|15分前|十五分前)/.test(normalized);
  }
  if (stepKey === "confirmed_reminder_contact") {
    const hasReminderFragment = /(?:3日前|三日前)/.test(normalized)
      && /(?:連絡|電話)/.test(normalized);
    const hasContactFragment = /(?:この|同じ|今の|こちらの).{0,8}(?:携帯|電話|連絡先)/.test(normalized)
      || /(?:携帯|電話番号|連絡先).{0,12}(?:よろしい|良い|大丈夫)/.test(normalized);
    return hasReminderFragment || hasContactFragment;
  }
  return false;
}

function inspectionStaffConversationEvidence(text = "", stepKey = "") {
  const transcript = typeof state !== "undefined" && Array.isArray(state.transcript)
    ? state.transcript
    : [];
  const staffTexts = transcript
    .filter((message) => message.role === "staff")
    .map((message) => message.text)
    .filter((staffText) => !stepKey || inspectionTextHasSplitGuidanceKey(staffText, stepKey));
  const currentText = !stepKey || inspectionTextHasSplitGuidanceKey(text, stepKey)
    ? text
    : "";
  return normalizeScriptedText([...staffTexts, currentText].filter(Boolean).join(" "));
}

function inspectionSplitGuidanceFragmentKey(text) {
  if (inspectionTextHasSplitGuidanceKey(text, "explained_documents")) {
    return "explained_documents";
  }
  if (inspectionTextHasSplitGuidanceKey(text, "explained_lock_and_arrival")) {
    return "explained_lock_and_arrival";
  }
  if (inspectionTextHasSplitGuidanceKey(text, "confirmed_reminder_contact")) {
    return "confirmed_reminder_contact";
  }
  return "";
}

function isInspectionGuidancePrefaceOrIncompleteFragment(text) {
  const normalized = normalizeScriptedText(text);
  if (!normalized || isScriptedQuestion(normalized)) return false;
  return /(?:当日の)?(?:持ち物|お願い).{0,18}(?:確認|説明)させてください/.test(normalized)
    || /(?:恐れ入りますが)?当日お持ち(?:ください)?[。.!！]*$/.test(normalized)
    || /(?:それから|また)?受付に[。.!！]*$/.test(normalized)
    || /^(?:それから|それと(?:もし)?|また|続いて)[。.!！]*$/.test(normalized);
}

function isInspectionAcknowledgementOnlyAfterAppointment(text) {
  const normalized = normalizeScriptedText(text);
  return /^(?:かしこまりました|承知しました|分かりました|わかりました|ありがとうございます|ありがとう)[。.!！]*$/.test(normalized);
}

function asksInspectionAvailabilityAgainAfterAppointment(text) {
  const normalized = normalizeScriptedText(text);
  return isScriptedQuestion(normalized)
    && /(?:日時|日程|予定|都合)/.test(normalized)
    && /(?:いかが|よろしい|決まり)/.test(normalized)
    && !hasInspectionAppointmentProposalEvidence(normalized);
}

function hasInspectionReminderContactConfirmation(text) {
  const current = normalizeScriptedText(text);
  const conversationEvidence = inspectionStaffConversationEvidence(
    current,
    "confirmed_reminder_contact"
  );
  const hasThreeDayReminder = /(?:3日前|三日前)/.test(conversationEvidence)
    && /(?:連絡|電話)/.test(conversationEvidence);
  const asksKnownContact = /(?:この|同じ|今の|こちらの).{0,8}(?:携帯|電話|連絡先)/.test(conversationEvidence)
    || /(?:携帯|電話番号|連絡先).{0,12}(?:よろしい|良い|大丈夫)/.test(conversationEvidence)
    || /(?:どちら|電話番号)/.test(conversationEvidence);
  const hasContactQuestion = inspectionStaffConversationEvidence(
    current,
    "confirmed_reminder_contact"
  ).split(/(?<=[。.!！?？])/).some((fragment) =>
    asksKnownContact
    && isScriptedQuestion(fragment)
    && /(?:携帯|電話番号|連絡先|この電話|同じ電話|今の電話)/.test(fragment)
  );
  return hasThreeDayReminder && asksKnownContact && hasContactQuestion;
}

function scriptedRequiredGroupsMatch(normalized, step, matchedGroups) {
  // 「ありがとうございます」は会話途中のお礼として扱い、過去形の
  // 「ありがとうございました」のときだけ終話あいさつを達成する。
  if (step.key === "closed_politely") {
    return isInspectionFinalClosingThanks(normalized);
  }

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

  // 「ご利用」「ご愛顧」を使わなくても、日頃から世話になっていることと
  // 感謝を同じ発話で伝えた場合は、日頃の利用へのお礼として扱う。
  if (step.key === "thanked_customer") {
    return hasCourtesyExpression(normalized);
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

  // Firestoreの公開シナリオとローカル標準シナリオの差にかかわらず、
  // 必要書類と空荷を複数発話に分けて案内した場合も合算して確認する。
  if (step.key === "explained_documents") {
    return hasInspectionDocumentGuidance(
      inspectionStaffConversationEvidence(normalized, step.key)
    );
  }

  // お客様がすでに代車を希望した分岐では、スタッフが手配を明確に承諾すれば完了とする。
  // スタッフ側から先に代車を案内する通常分岐では、従来の「早め・予約・用意」を維持する。
  if (
    step.key === "explained_loaner"
    && state.inspectionLoanerRequested
    && hasInspectionLoanerConfirmation(normalized, true)
  ) {
    return true;
  }

  // 入庫日時確定後、スタッフが代車を手配済みと明確に案内した場合は、
  // お客様から先に代車希望がなくても当日の待ち方を代車利用として確定する。
  if (step.key === "confirmed_waiting" && hasInspectionLoanerConfirmation(normalized)) {
    return true;
  }

  // Firestoreに15分前のみの旧条件が残っていても、10分前・15分前の両方を有効にする。
  if (step.key === "explained_lock_and_arrival") {
    const conversationEvidence = inspectionStaffConversationEvidence(normalized, step.key);
    const hasArrivalLeadTime = /(?:10分|十分|15分|十五分)/.test(conversationEvidence)
      && /(?:早め|前)/.test(conversationEvidence);
    return hasLockNutToolExpression(conversationEvidence)
      && hasArrivalLeadTime;
  }

  // 「この電話」「この連絡先でよろしいですか」も、3日前確認の
  // 連絡先を尋ねる自然な表現として扱う。
  if (step.key === "confirmed_reminder_contact") {
    return hasInspectionReminderContactConfirmation(normalized);
  }

  // 「どこか不都合なところ」「見てほしいところ」のような言い換えも、
  // 車両状態や追加整備の希望を尋ねる質問として扱う。
  if (step.key === "asked_vehicle_concerns") {
    return asksInspectionVehicleConcerns(normalized);
  }

  if (matchedGroups.every((matches) => matches.length > 0)) return true;

  if (step.key === "asked_availability") {
    return hasInspectionAvailabilityRequest(normalized);
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
  let recappedConfirmedDateTime = false;

  if (step.key === "proposed_appointment") {
    const appointmentMatch = inspectionAppointmentProposalMatch(normalized);
    passed = Boolean(passed && appointmentMatch);
    if (passed) {
      state.proposedAppointment = {
        month: appointmentMatch.month,
        day: appointmentMatch.day,
        hour: appointmentMatch.hour,
        minute: appointmentMatch.minute
      };
    }
  }

  if (step.key === "recapped_appointment") {
    const appointment = state.proposedAppointment;
    recappedConfirmedDateTime = Boolean(
      appointment
      && normalized.includes(`${appointment.month}月`)
      && normalized.includes(`${appointment.day}日`)
      && normalized.includes(`${appointment.hour}時`)
      && (Number(appointment.minute || 0) === 0
        ? !new RegExp(`${appointment.hour}時(?:半|\\d{1,2}分)`).test(normalized)
        : Number(appointment.minute) === 30
          ? new RegExp(`${appointment.hour}時(?:半|30分)`).test(normalized)
          : normalized.includes(`${appointment.hour}時${appointment.minute}分`))
    );
    passed = Boolean(
      passed
      && recappedConfirmedDateTime
    );
  }
  const mileageOnlyMissing = step.key === "explained_duration_and_wait"
    && !state.inspectionMileageAsked
    && hasSupportedInspectionDuration(normalized)
    && ["待", "店内"].some((word) => normalized.includes(word));
  const canAdvance = passed
    || mileageOnlyMissing
    || recappedConfirmedDateTime
    || step.key === "recapped_appointment"
    || scriptedStepCanAdvanceOnFailure(step);
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
  if (recappedConfirmedDateTime && !passed) {
    analysis.evidence.push("確定済みの予約日時を復唱（氏名・締め表現は不足）");
  } else if (step.key === "recapped_appointment" && !passed) {
    analysis.evidence.push("予約復唱を実施（確定済み日時との不一致または必要表現不足）");
  }
  state.analyses.push(analysis);
  if (
    passed
    && (
      (step.key === "explained_loaner" && state.inspectionLoanerRequested)
      || (step.key === "confirmed_waiting" && hasInspectionLoanerConfirmation(normalized))
    )
  ) {
    state.inspectionLoanerConfirmed = true;
  }
  if (typeof renderConversation === "function") renderConversation();
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
  if (typeof renderConversation === "function") renderConversation();
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
  return /(?:でしょうか|ましょうか|ますか|ですか|ませんか|ございませんか|[?？])/.test(normalized);
}

function asksInspectionVehicleConcerns(text) {
  const normalized = normalizeScriptedText(text);
  return isScriptedQuestion(normalized)
    && /(?:気になる|不具合|不都合|調子|具合|症状|異音|違和感|見てほしい|見てもらいたい)/.test(normalized);
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
    return hasInspectionAvailabilityRequest(normalized);
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
    return isScriptedQuestion(normalized) || hasInspectionLoanerConfirmation(normalized);
  }

  if (step.key === "asked_vehicle_concerns") {
    return asksInspectionVehicleConcerns(normalized);
  }

  if (step.key === "explained_lock_and_arrival") {
    return hasLockNutToolExpression(
      inspectionStaffConversationEvidence(normalized, step.key)
    );
  }

  return true;
}

function hasCourtesyExpression(text) {
  const normalized = text.replace(/\s+/g, "");
  const hasThanks = /(?:ありがとう|感謝)/.test(normalized);
  const hasDirectPatronage = /(?:ご利用|ご愛顧)/.test(normalized);
  const hasAlwaysThanks = normalized.includes("いつも") && hasThanks;
  const hasEstablishedGreeting = /お世話になって(?:おります|います|ます)/.test(normalized);
  const hasOngoingRelationship = /(?:日頃|いつも|平素)/.test(normalized)
    && /お世話にな(?:って(?:おります|います|ます)|り(?:まして)?)/.test(normalized);
  return hasAlwaysThanks
    || hasEstablishedGreeting
    || (hasThanks && (hasDirectPatronage || hasOngoingRelationship));
}

function isAffirmativeScriptedReply(text) {
  const normalized = text.replace(/[\s、。,.!?！？]/g, "");
  return /^(?:はい|ええ|もちろん|大丈夫|できます|可能です|はいできます|もちろんできます|大丈夫です)$/.test(normalized);
}

function isAffirmativeBookingAvailabilityReply(text) {
  const normalized = normalizeScriptedText(text);
  if (isScriptedQuestion(normalized)) return false;
  if (/(?:できません|出来ません|不可|難しい|空いていません|確認します)/.test(normalized)) return false;
  return isAffirmativeScriptedReply(normalized)
    || /^(?:はい|ええ)?大丈夫(?:です)?よ?$/.test(normalized.replace(/[、。,.!?！？]/g, ""))
    || /(?:このまま)?(?:ご)?予約(?:が|は|を)?(?:できます|出来ます|可能です|可能)/.test(normalized)
    || /このまま.{0,8}(?:できます|出来ます|可能です|可能)/.test(normalized);
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
    const asksGeneralAvailability = /(?:でしょうか|ますか|ですか|[?？])/.test(normalized)
      && /(?:ご)?都合.{0,16}(?:いかが|よろしい|良い|いい)/.test(normalized);
    const asksGeneralBooking = /(?:でしょうか|ますか|ですか|[?？])/.test(normalized)
      && /(?:ご)?予約.{0,12}(?:いかが|よろしい|良い|いい)/.test(normalized);
    if (
      !hasDate
      && !hasTime
      && (asksGeneralBooking || asksGeneralAvailability)
    ) {
      return {
        text: "お願いしたいんですけど、いつできますか？",
        audioId: "inspection_asked_availability_customer",
        missingDetail: "appointmentDate"
      };
    }
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

  // 公開済みFirestoreに旧文言が残っていても、表示文と登録済みMP3を一致させる。
  if (step.key === "recapped_appointment") {
    return {
      text: "ん！？、何日の予定でしたっけ？",
      audioId: "inspection_recapped_appointment_retry",
      missingDetail: null
    };
  }

  return {
    text: step.retryResponse,
    audioId: `inspection_${step.key}_retry`,
    missingDetail: null
  };
}

function shouldUseInspectionTimeOnlyAppointmentResponse(text, step, analysis) {
  if (step?.key !== "proposed_appointment" || !analysis?.passed) return false;
  const normalized = normalizeScriptedText(text);
  const partial = state.scriptedPartialReplies?.[step.key];
  return partial?.missingDetail === "appointmentTime"
    && inspectionAppointmentDateCandidates(normalized).length === 0
    && /\d{1,2}時/.test(normalized);
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

  // 入庫日時確定後は、実際の電話で使われる自然な締め表現も終話として扱う。
  // 「ありがとうございます」は会話途中のお礼にも使うため、日時確定後も終話意図にしない。
  if (
    state.proposedAppointment
    && /(?:よろしくお願い(?:いた)?します|失礼(?:いた)?します)/.test(normalized)
  ) {
    return true;
  }

  return isInspectionFinalClosingThanks(normalized) || [
    /当日.*お待ち/,
    /ご?予約.*承り/,
    /以上.*(?:予約|案内)/,
    /これで.*(?:予約|案内)/
  ].some((pattern) => pattern.test(normalized));
}

function isInspectionFinalClosingThanks(text) {
  const normalized = normalizeScriptedText(text);
  return /ありがとうございました/.test(normalized);
}

function hasScriptedAppointmentRecapEvidence(text) {
  const normalized = normalizeScriptedText(text);
  const hasDateAndTime = /\d{1,2}月\d{1,2}日/.test(normalized)
    && /\d{1,2}時/.test(normalized);
  return hasDateAndTime && /(?:予約|予定|お待ち|来店)/.test(normalized);
}

function rememberFutureScriptedAchievements(text, currentIndex) {
  const excludedKeys = new Set([
    "proposed_appointment",
    "recapped_appointment",
    "closed_politely"
  ]);

  scenario.steps.slice(currentIndex + 1).forEach((candidate) => {
    if (excludedKeys.has(candidate.key)) return;
    const matched = scriptedStepMatches(text, candidate)
      || (candidate.key === "thanked_customer" && hasCourtesyExpression(text));
    if (!matched) return;
    markScriptedStepPassed(candidate, text);
  });
}

function recoverEarlierInspectionOpeningStep(text, currentIndex) {
  const openingKeys = new Set(["confirmed_identity", "introduced_self"]);
  const matchedSteps = scenario.steps.slice(0, currentIndex).filter((candidate) =>
    openingKeys.has(candidate.key)
    && !state.analyses.some((analysis) =>
      analysis.stepKey === candidate.key && analysis.passed === true
    )
    && scriptedStepMatches(text, candidate)
  );

  matchedSteps.forEach((candidate) => markScriptedStepPassed(candidate, text));

  // 本人確認と名乗りを同じ発話で行った場合は、名乗りへの挨拶を優先する。
  return matchedSteps.find((candidate) => candidate.key === "introduced_self")
    || matchedSteps.find((candidate) => candidate.key === "confirmed_identity")
    || null;
}

function recoverEarlierInspectionStep(text, currentIndex) {
  const excludedKeys = new Set([
    "confirmed_identity",
    "introduced_self",
    "proposed_appointment",
    "closed_politely"
  ]);
  const matchedSteps = scenario.steps.slice(0, currentIndex).filter((candidate) =>
    !excludedKeys.has(candidate.key)
    && !state.analyses.some((analysis) =>
      analysis.stepKey === candidate.key && analysis.passed === true
    )
    && scriptedStepMatches(text, candidate)
  );

  matchedSteps.forEach((candidate) => markScriptedStepPassed(candidate, text));
  return matchedSteps[matchedSteps.length - 1] || null;
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
        && (Number(appointment.minute || 0) === 0
          ? !new RegExp(`${appointment.hour}時(?:半|\\d{1,2}分)`).test(normalized)
          : Number(appointment.minute) === 30
            ? new RegExp(`${appointment.hour}時(?:半|30分)`).test(normalized)
            : normalized.includes(`${appointment.hour}時${appointment.minute}分`))
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

function advancePastPassedScriptedSteps(responseStep, options = {}) {
  let latestResponseStep = responseStep;
  const normalizedCurrentEvidence = options.currentEvidence
    ? normalizeScriptedText(options.currentEvidence)
    : "";
  while (
    state.scriptStep < scenario.steps.length
    && state.analyses.some((item) =>
      item.stepKey === scenario.steps[state.scriptStep].key && item.passed
    )
  ) {
    // 同じ発話で先の工程も達成済みなら、実際に最後に達成した工程の
    // お客様返答を選ぶ。以前の別ターンで先に達成していた工程は通過だけにし、
    // 無関係なタイミングで古い返答を遅れて発話しない。
    const passedInCurrentTurn = !normalizedCurrentEvidence
      || state.analyses.some((item) =>
        item.stepKey === scenario.steps[state.scriptStep].key
        && item.passed
        && item.evidence?.some((evidence) =>
          normalizeScriptedText(evidence) === normalizedCurrentEvidence
        )
      );
    if (!options.preserveResponseStep && passedInCurrentTurn) {
      latestResponseStep = scenario.steps[state.scriptStep];
    }
    state.scriptStep += 1;
  }
  return latestResponseStep;
}

function findFurthestMatchingOptionalStepIndex(text, startIndex) {
  if (!state.proposedAppointment) return -1;

  let targetIndex = -1;
  for (let index = startIndex + 1; index < scenario.steps.length; index += 1) {
    const candidate = scenario.steps[index];
    if (!candidate.optionalAfterAppointment) break;
    if (
      scriptedStepMatches(text, candidate)
      || (candidate.key === "recapped_appointment" && hasScriptedAppointmentRecapEvidence(text))
    ) {
      targetIndex = index;
    }
  }
  return targetIndex;
}

function handleScriptedStaffReply(text) {
  const startingScriptStep = state.scriptStep;
  const step = scenario.steps[state.scriptStep];
  if (!step) {
    if (isInspectionFinalClosingThanks(text)) {
      finishRoleplay();
      return;
    }
    const closingIndex = scenario.steps.findIndex((item) => item.key === "closed_politely");
    if (closingIndex >= 0) {
      state.scriptStep = closingIndex;
      state.currentState = scenario.steps[closingIndex].state;
    }
    state.ended = false;
    state.turn += 1;
    addMessage("customer", "はい。", {
      audioId: "inspection_thanked_customer_retry"
    });
    els.speechNote.textContent = "最終の『ありがとうございました』までは会話を終了せず、音声入力を続けます。";
    renderProgress();
    return;
  }

  // 車検案内と予約意思確認をまとめた模範フローでは、お客様の「お願いします。」に
  // スタッフが「ありがとうございます。」と応じた後、お客様から自然に作業時間を尋ねる。
  // この1ターンは案内不足の聞き返しではないため、減点対象から除外する。
  const naturalDurationProgression = Boolean(
    state.inspectionDurationProgressionPending
    && step.key === "explained_duration_and_wait"
    && isInspectionDurationProgressAcknowledgement(text)
  );
  state.inspectionDurationProgressionPending = false;

  const expiryStep = scenario.steps.find((item) => item.key === "explained_available_period");
  if (expiryStep && scriptedStepMatches(text, expiryStep)) {
    state.inspectionExpiryEvidence = text;
  }

  // 現在工程より後の案内も会話全体の確認済み項目として記憶する。
  // 後工程へ到達した際に、すでに聞いた内容を再質問しないための記録であり、
  // この時点で会話順序を強制的に進めるものではない。
  rememberFutureScriptedAchievements(text, state.scriptStep);

  // 「代車は必要ですか」「代車はお使いになりますか」のように利用希望を
  // 直接尋ねられた場合は、「はい」ではなく明確に「お願いします。」と答える。
  // この希望は会話状態へ保存し、後続の「ご用意します」で代車手配を確定する。
  if (asksInspectionLoanerNeed(text)) {
    state.inspectionLoanerRequested = true;
    const waitingStep = scenario.steps.find((candidate) => candidate.key === "confirmed_waiting");
    markScriptedStepPassed(waitingStep, "お客様が代車利用を希望");
    state.turn += 1;
    addMessage("customer", "お願いします。", {
      audioId: "inspection_booking_invitation_accept_customer"
    });
    els.speechNote.textContent = "代車の利用希望を記憶しました。代車を用意できることを案内してください。";
    renderProgress();
    return;
  }

  // 走行距離は作業時間を判断するための質問なので、予約日時の確定後など
  // どの工程で尋ねられても実際の質問を優先して回答する。お客様がすでに
  // 作業時間を質問済みなら距離だけを答え、未質問なら続けて時間も尋ねる。
  if (asksCurrentMileage(text)) {
    state.inspectionMileageAsked = true;
    if (step.key === "explained_duration_and_wait") {
      state.scriptedPartialReplies[step.key] = {
        text: combinedScriptedReply(text, step),
        missingDetail: "mileageAnswered"
      };
    }
    const askedDurationAlready = state.inspectionDurationQuestionAsked;
    const customerReply = askedDurationAlready
      ? {
          text: "今、3万キロくらいです。",
          audioId: "inspection_current_mileage_customer"
        }
      : {
          text: "今、3万キロくらいです。どれくらい時間がかかるのですか？",
          audioId: "inspection_current_mileage_and_duration_customer"
        };
    state.turn += 1;
    addMessage("customer", customerReply.text, { audioId: customerReply.audioId });
    els.speechNote.textContent = "走行距離は約3万kmです。続けて、作業時間と店内で待てるかをご案内ください。";
    renderProgress();
    return;
  }

  // 予約を先に確定して作業時間工程を通過した後でも、会話全体に証拠が
  // そろえば走行距離・作業時間・店内待ちを採点へ回収する。
  const durationStepIndex = scenario.steps.findIndex(
    (item) => item.key === "explained_duration_and_wait"
  );
  const durationStep = scenario.steps[durationStepIndex];
  if (
    durationStep
    && durationStepIndex < state.scriptStep
    && !state.analyses.some((item) => item.stepKey === durationStep.key && item.passed)
    && scriptedStepMatches(text, durationStep)
  ) {
    markScriptedStepPassed(durationStep, text);
  }

  // 名乗りを先に済ませた後で本人確認へ戻るなど、冒頭2項目の順序が入れ替わっても
  // 実際に確認できた内容を採点へ反映し、現在工程の「ご用件は何ですか？」へ誤分岐しない。
  const recoveredOpeningStep = recoverEarlierInspectionOpeningStep(text, state.scriptStep);
  if (recoveredOpeningStep) {
    state.turn += 1;
    addMessage("customer", recoveredOpeningStep.customerResponse, {
      audioId: `inspection_${recoveredOpeningStep.key}_customer`
    });
    els.speechNote.textContent = recoveredOpeningStep.key === "introduced_self"
      ? "店舗名・担当者名の名乗りを確認しました。続けて会話を進めてください。"
      : "お客様のお名前を確認できました。続けて会話を進めてください。";
    renderProgress();
    return;
  }

  // 日時確定後に同じ日程・都合を尋ね直されても、過去工程へ戻ったり
  // 一語の「はい」だけで曖昧に答えたりしない。確定済みの予約を維持する。
  if (state.proposedAppointment && asksInspectionAvailabilityAgainAfterAppointment(text)) {
    state.turn += 1;
    addMessage("customer", "お願いします。", {
      audioId: "inspection_booking_invitation_accept_customer"
    });
    els.speechNote.textContent = "予約日時は確定済みです。日時を再確認せず、当日の案内へ進めてください。";
    renderProgress();
    return;
  }

  // 予約確定後の単独の受領表現や、持参物案内の前置き・言いかけには
  // AIお客様の音声を割り込ませない。会話位置を保ったままスタッフ入力を再開する。
  if (
    state.proposedAppointment
    && (
      isInspectionAcknowledgementOnlyAfterAppointment(text)
      || isInspectionGuidancePrefaceOrIncompleteFragment(text)
    )
  ) {
    els.speechNote.textContent = "スタッフの案内の続きを待っています。";
    renderProgress();
    continueSpeechInputWithoutCustomerReply("音声入力中です。案内の続きを話してください。");
    return;
  }

  // スタッフの案内順が前後して、現在位置より前の未達項目を後から説明した場合も、
  // 会話全体からその項目を回収する。現在工程は後戻りさせず、実際に説明された
  // 内容へ自然に返答してから現在位置の続きを待つ。
  const recoveredEarlierStep = recoverEarlierInspectionStep(text, state.scriptStep);
  if (recoveredEarlierStep) {
    state.turn += 1;
    const recoveredEarlierIndex = scenario.steps.findIndex(
      (candidate) => candidate.key === recoveredEarlierStep.key
    );
    const appointmentIndexForRecovery = scenario.steps.findIndex(
      (candidate) => candidate.key === "proposed_appointment"
    );
    const recoveredCoreStepAfterAppointment = Boolean(
      state.proposedAppointment
      && recoveredEarlierIndex >= 0
      && recoveredEarlierIndex < appointmentIndexForRecovery
    );
    const loanerAlreadyChosen = recoveredEarlierStep.key === "confirmed_waiting"
      && state.inspectionLoanerConfirmed;
    addMessage("customer", recoveredCoreStepAfterAppointment
      ? "はい。"
      : loanerAlreadyChosen
        ? "分かりました。"
        : recoveredEarlierStep.customerResponse, {
      audioId: recoveredCoreStepAfterAppointment
        ? "inspection_thanked_customer_retry"
        : loanerAlreadyChosen
          ? "inspection_explained_lock_and_arrival_customer"
          : `inspection_${recoveredEarlierStep.key}_customer`
    });
    els.speechNote.textContent = "順序が前後した案内を確認しました。確認済みの内容へ戻らず、現在の会話位置から続けてください。";
    renderProgress();
    return;
  }

  // 具体的な入庫日または時刻の提案が始まった時点で、未確認の過去工程へ戻らず
  // 日時調整を優先する。日付だけなら時刻、時刻だけなら日付だけを確認する。
  // すでに後工程へ進んでいても日時が未確定なら、完全な日時提案を最優先で確定する。
  const appointmentIndex = scenario.steps.findIndex((item) => item.key === "proposed_appointment");
  if (
    !state.proposedAppointment
    && appointmentIndex >= 0
    && appointmentIndex !== state.scriptStep
    && hasInspectionAppointmentProposalEvidence(text)
  ) {
    if (appointmentIndex > state.scriptStep) {
      recordSkippedStepsBeforeAppointment(text, state.scriptStep, appointmentIndex);
    }
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

  // すでに具体的な日時を待つ工程へ進んでいても、スタッフが先に
  // 予約手続き時間の了承確認を行った場合は、その実際の質問を優先する。
  // 日時不足の聞き返しにはせず「大丈夫ですよ。」と回答し、次の発話で
  // 具体的な月日・時刻を提案してもらう。
  if (
    step.key === "proposed_appointment"
    && hasExplicitBookingContinuationConfirmation(text)
  ) {
    const bookingTimeStep = scenario.steps[bookingTimeIndex];
    markScriptedStepPassed(bookingTimeStep, text);
    delete state.scriptedPartialReplies[step.key];
    state.turn += 1;
    addMessage("customer", "大丈夫ですよ。", {
      audioId: "inspection_confirmed_booking_time_customer"
    });
    els.speechNote.textContent = "予約手続き時間を了承しました。続けて、具体的な入庫日と時刻を提案してください。";
    renderProgress();
    return;
  }

  // 持参書類と空荷、ロックナット用具と早めの来店は、実際の電話では
  // 複数の発話に分かれる。途中の「はい」を挟んでも現在工程を失わず、
  // 会話全体のスタッフ発話がそろった時点で達成判定する。
  const splitGuidanceKey = state.proposedAppointment
    ? inspectionSplitGuidanceFragmentKey(text)
    : "";
  const splitGuidanceStep = splitGuidanceKey
    ? scenario.steps.find((candidate) => candidate.key === splitGuidanceKey)
    : null;
  const splitGuidancePassed = splitGuidanceKey
    && state.analyses.some((item) => item.stepKey === splitGuidanceKey && item.passed);
  if (
    splitGuidanceStep
    && !splitGuidancePassed
    && !scriptedStepMatches(text, splitGuidanceStep)
  ) {
    els.speechNote.textContent = splitGuidanceKey === "explained_documents"
      ? "持参物の案内を記憶しています。必要書類と空荷の案内を続けてください。"
      : splitGuidanceKey === "explained_lock_and_arrival"
        ? "ロックナット用具または早めの来店案内を記憶しています。案内を続けてください。"
        : "3日前の確認連絡を記憶しています。連絡先の確認を続けてください。";
    renderProgress();
    // 言いかけには割り込まないが、完結した案内を複数回に分けた場合は
    // 採点対象外の短いあいづちを返し、MP3終了後にマイクを確実に再開する。
    if (isInspectionGuidancePrefaceOrIncompleteFragment(text)) {
      continueSpeechInputWithoutCustomerReply("音声入力中です。案内の続きを話してください。");
      return;
    }
    state.turn += 1;
    addMessage("customer", "はい。", {
      audioId: "inspection_thanked_customer_retry"
    });
    return;
  }

  // 入庫日時の確定後は、未確認の任意項目へ戻らない。
  // スタッフが先の任意項目を説明した場合は、間の未確認項目を未達のまま通過し、
  // 同じ発話内で実際に確認できた持参品・ロックナット・事前連絡などを記録する。
  const optionalForwardIndex = step.optionalAfterAppointment
    ? findFurthestMatchingOptionalStepIndex(text, state.scriptStep)
    : -1;
  if (optionalForwardIndex > state.scriptStep) {
    recordSkippedScriptedSteps(
      text,
      state.scriptStep,
      optionalForwardIndex,
      "入庫日時確定後に先の確認項目を案内"
    );
    state.scriptStep = optionalForwardIndex;
    state.currentState = scenario.steps[state.scriptStep].state;
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

  // オイル交換希望に対して「その他の追加作業」を再確認された場合は、
  // 現在工程の店内待ち不足よりも実際に聞かれた質問への回答を優先する。
  // 作業時間など現在工程で説明済みの内容は保持し、回答後に同じ工程を継続する。
  if (hasInspectionOilChangeRequest() && asksInspectionAdditionalServiceFollowUp(text)) {
    state.scriptedPartialReplies[step.key] = {
      text: combinedScriptedReply(text, step),
      missingDetail: "additionalServiceReconfirmed"
    };
    state.turn += 1;
    addMessage("customer", "そのほかは大丈夫です。", {
      audioId: "inspection_additional_service_none_customer"
    });
    els.speechNote.textContent = "その他の追加作業はないことを確認しました。現在の案内を続けてください。";
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

  // 日頃のお礼を言い間違えたまま任意進行した後、スタッフが正しく言い直した場合は、
  // その発話を次の車検案内不足として扱わず、前工程のお礼の訂正として回収する。
  // 車検の用件も同時に説明している場合は、通常の複数工程判定へ委ねる。
  const courtesyStep = scenario.steps.find((item) => item.key === "thanked_customer");
  const correctsSkippedCourtesy = step.key === "explained_inspection_notice"
    && hasCourtesyExpression(text)
    && !hasClearInspectionPurposeNotice(text)
    && state.analyses.some((item) => item.stepKey === "thanked_customer" && !item.passed);
  if (correctsSkippedCourtesy && courtesyStep) {
    markScriptedStepPassed(courtesyStep, text);
    delete state.scriptedPartialReplies[step.key];
    state.turn += 1;
    addMessage("customer", courtesyStep.customerResponse, {
      audioId: "inspection_thanked_customer_customer"
    });
    els.speechNote.textContent = "日頃のお礼の言い直しを確認しました。続けて車検のご案内をしてください。";
    renderProgress();
    return;
  }

  const answeredDayPreferenceAfterExpiry = shouldAnswerDayPreferenceFromStoredExpiry(text, step);
  const answeredCustomerBookingAvailability = step.key === "confirmed_booking_time"
    && isAffirmativeBookingAvailabilityReply(text)
    && (state.questionRepeats["inspection-retry:confirmed_booking_time:general"] || 0) > 0;
  const combinedText = combinedScriptedReply(text, step);
  const analysis = analyzeScriptedStaff(combinedText, step);
  if (naturalDurationProgression && !analysis.passed) {
    analysis.noClarificationDeduction = true;
    analysis.evidence.push("予約意思確認後の自然な作業時間質問へ進行");
  }
  const appointmentCompletedWithTimeOnly = shouldUseInspectionTimeOnlyAppointmentResponse(
    text,
    step,
    analysis
  );
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
  if (answeredCustomerBookingAvailability && !analysis.passed) {
    // AIお客様から「今、このまま予約できますか？」と確認した後の肯定回答は、
    // 予約手続き時間の得点にはせず、会話だけ具体的な日時調整へ進める。
    analysis.canAdvance = true;
    analysis.blocked = false;
    analysis.evidence.push("お客様の予約可否質問へ肯定（予約手続き時間の確認は未達）");
  }
  state.turn += 1;

  if (!analysis.canAdvance) {
    const retry = scriptedRetryForMissingDetails(combinedText, step);
    const retryKey = `inspection-retry:${step.key}:${retry.missingDetail || "general"}`;
    const alreadyAsked = (state.questionRepeats[retryKey] || 0) > 0;
    const maySkipRepeatedQuestion = !["proposed_appointment", "closed_politely"].includes(step.key);
    const optionalAfterAppointment = Boolean(state.proposedAppointment && step.optionalAfterAppointment);

    // 入庫日時確定後の任意案内は聞き返さない。
    // 日時確定前でも同じ質問を一度行っている場合は、再質問せず未達のまま先へ進む。
    // ただし最低条件である具体的な入庫日・時刻と、実際の終話あいさつは
    // 自動スキップしない。終話前に採点済みとなってマイクが止まるのを防ぐ。
    if (optionalAfterAppointment || (alreadyAsked && maySkipRepeatedQuestion)) {
      analysis.canAdvance = true;
      analysis.blocked = false;
      analysis.skippedRepeatedQuestion = alreadyAsked;
      analysis.skippedAfterAppointment = optionalAfterAppointment;
      delete state.scriptedPartialReplies[step.key];
      state.scriptStep += 1;
      while (
        state.scriptStep < scenario.steps.length
        && state.analyses.some((item) =>
          item.stepKey === scenario.steps[state.scriptStep].key && item.passed
        )
      ) {
        state.scriptStep += 1;
      }
      const reachedEndAfterSkip = state.scriptStep >= scenario.steps.length;
      const finishedAfterSkip = reachedEndAfterSkip && isInspectionFinalClosingThanks(text);
      if (reachedEndAfterSkip && !finishedAfterSkip) {
        state.scriptStep = closingIndex;
      }
      if (finishedAfterSkip) {
        state.ended = true;
      } else {
        state.currentState = scenario.steps[state.scriptStep].state;
      }
      addMessage("customer", "はい。", {
        audioId: "inspection_thanked_customer_retry",
        onCommitted: finishedAfterSkip
          ? () => finishRoleplay({ keepCustomerPlayback: true })
          : null
      });
      els.speechNote.textContent = optionalAfterAppointment
        ? "入庫日時が確定しているため、未確認項目を聞き返さず先へ進みました。"
        : "同じ質問は繰り返さず、未確認項目として採点に反映して先へ進みました。";
      renderProgress();
      return;
    }
    if (retry.missingDetail === "waiting") {
      state.inspectionWaitingRequested = true;
    }
    state.scriptedPartialReplies[step.key] = {
      text: combinedText,
      missingDetail: retry.missingDetail
    };
    const retryQuestion = customerQuestionTurn(
      retryKey,
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
  let customerResponseOverride = answeredCustomerBookingAvailability
    ? {
        text: "具体的な日時を教えてください。",
        audioId: "inspection_proposed_appointment_retry"
      }
    : appointmentCompletedWithTimeOnly
    ? {
        text: "では、その時間でお願いします。",
        audioId: "inspection_appointment_single_time_customer"
      }
    : answeredDayPreferenceAfterExpiry
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
  responseStep = advancePastPassedScriptedSteps(responseStep, {
    // 日時提案への承諾は、その後の店内待ち・車両状態が先に確認済みでも
    // 必ずこのターンで返す。確認済み工程は通過するだけにして、
    // 「オイル交換もお願いしたいです。」など過去の返答へ戻さない。
    preserveResponseStep: step.key === "proposed_appointment" && analysis.passed,
    currentEvidence: text
  });

  // スタッフが店内待ちを選択肢として積極的に提案した場合は、
  // 代車を対象外にして予約手続きへ進む。
  // お客様から店内待ちを確認した場合は、外出に備えた代車希望へ進める。
  const waitingBranchLoanerStep = scenario.steps[state.scriptStep];
  if (
    waitingBranchLoanerStep?.key === "explained_loaner"
    && !scriptedStepMatches(combinedText, waitingBranchLoanerStep)
  ) {
    if (
      state.inspectionWaitingRequested
      || asksInspectionWaitingMethodConfirmation(combinedText)
    ) {
      customerResponseOverride = {
        text: "出かける可能性があるので、一応代車を用意してほしいんですが、できますか？",
        audioId: "inspection_waiting_followup_loaner_request"
      };
    } else if (hasInspectionWaitingChoiceOffer(combinedText)) {
      markScriptedStepNotApplicable(waitingBranchLoanerStep, "スタッフが店内待ちを提案");
      responseStep = waitingBranchLoanerStep;
      state.scriptStep += 1;
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

  const reachedEnd = state.scriptStep >= scenario.steps.length;
  const finished = reachedEnd && isInspectionFinalClosingThanks(text);
  if (reachedEnd && !finished) {
    state.scriptStep = closingIndex;
  }
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
    && hasDirectInspectionBookingInvitation(combinedText)
    && advancedPastScriptedStep(
      startingScriptStep,
      state.scriptStep,
      scenario.steps,
      "asked_availability"
    )
  ) {
    state.inspectionDurationProgressionPending = true;
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
  if (
    !customerResponseOverride
    && shouldAnswerCombinedInspectionAvailability(
      combinedText,
      startingScriptStep,
      state.scriptStep
    )
  ) {
    customerResponseOverride = {
      text: "お願いしたいんですけど、いつできますか？",
      audioId: "inspection_asked_availability_customer"
    };
  }
  if (
    !customerResponseOverride
    && responseStep.key === "confirmed_waiting"
    && hasInspectionLoanerConfirmation(combinedText)
  ) {
    customerResponseOverride = {
      text: "分かりました。",
      audioId: "inspection_explained_lock_and_arrival_customer"
    };
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

function inspectionConversationMetricAchieved(metricKey) {
  const transcript = Array.isArray(state.transcript) ? state.transcript : [];
  const staffUtterances = transcript
    .filter((message) => message.role === "staff")
    .map((message) => normalizeScriptedText(message.text))
    .filter(Boolean);
  const customerEvidence = normalizeScriptedText(
    transcript
      .filter((message) => message.role === "customer")
      .map((message) => message.text)
      .join(" ")
  );
  const staffEvidence = staffUtterances.join(" ");
  const customerRequestedLoaner = state.inspectionLoanerRequested
    || /(?:代車|代わりのお車|代替車).{0,24}(?:用意|準備|手配|お願い|できますか)/.test(customerEvidence);
  const loanerWasConfirmed = transcript.some((message, index) => {
    if (message.role !== "staff") return false;
    if (hasInspectionLoanerConfirmation(message.text)) return true;
    const previous = transcript[index - 1];
    const previousWasLoanerRequest = previous?.role === "customer"
      && /(?:代車|代わりのお車|代替車).{0,24}(?:用意|準備|手配|お願い|できますか)/.test(
        normalizeScriptedText(previous.text)
      );
    return previousWasLoanerRequest
      && hasInspectionLoanerConfirmation(message.text, true);
  });

  // 最終採点は会話の順番ではなく、「確認したか・説明したか」を会話全体で判定する。
  // 質問であることが必要な項目は個々の発話で確認し、説明項目だけを発話間で合算する。
  if (metricKey === "introduced_self") {
    return staffUtterances.some((text) => hasInspectionSelfIntroduction(text));
  }
  if (metricKey === "thanked_customer") {
    return staffUtterances.some((text) => hasCourtesyExpression(text));
  }
  if (metricKey === "explained_inspection_notice") {
    const vehicleName = normalizeScriptedText(scenario.vehicleName || "");
    const expiryDate = normalizeScriptedText(scenario.expiryDate || "");
    return Boolean(vehicleName && expiryDate)
      && staffEvidence.includes(vehicleName)
      && staffEvidence.includes("車検")
      && staffEvidence.includes(expiryDate);
  }
  if (metricKey === "asked_availability") {
    return staffUtterances.some((text) => hasInspectionAvailabilityRequest(text));
  }
  if (metricKey === "explained_available_period") {
    const expiryDate = normalizeScriptedText(scenario.expiryDate || "");
    return Boolean(expiryDate) && staffEvidence.includes(expiryDate);
  }
  if (metricKey === "explained_duration_and_wait") {
    const mileageWasAsked = state.inspectionMileageAsked
      || staffUtterances.some((text) => asksCurrentMileage(text));
    return mileageWasAsked
      && hasSupportedInspectionDuration(staffEvidence)
      && /(?:待|店内)/.test(staffEvidence);
  }
  if (metricKey === "explained_loaner") {
    return customerRequestedLoaner && loanerWasConfirmed;
  }
  if (metricKey === "confirmed_waiting") {
    return staffUtterances.some((text) =>
      asksInspectionWaitingMethodConfirmation(text)
      || hasInspectionWaitingChoiceOffer(text)
    ) || (customerRequestedLoaner && loanerWasConfirmed);
  }
  if (metricKey === "asked_vehicle_concerns") {
    return staffUtterances.some((text) => asksInspectionVehicleConcerns(text));
  }
  if (metricKey === "explained_documents") {
    return hasInspectionDocumentGuidance(staffEvidence);
  }
  if (metricKey === "explained_lock_and_arrival") {
    const hasArrivalLeadTime = /(?:10分|十分|15分|十五分)/.test(staffEvidence)
      && /(?:早め|前)/.test(staffEvidence);
    return hasLockNutToolExpression(staffEvidence) && hasArrivalLeadTime;
  }
  if (metricKey === "confirmed_reminder_contact") {
    return hasInspectionReminderContactConfirmation("");
  }
  if (metricKey === "closed_politely") {
    return staffUtterances.some((text) => isInspectionFinalClosingThanks(text));
  }
  return false;
}

function scoreScriptedRoleplay() {
  const notApplicableKeys = new Set(
    state.analyses
      .filter((analysis) => analysis.scripted && analysis.notApplicable === true)
      .map((analysis) => analysis.stepKey)
  );
  const applicableScoring = scenario.scoring.filter((metric) => !notApplicableKeys.has(metric.key));
  const optionalAfterAppointmentKeys = new Set(
    (scenario.steps || [])
      .filter((step) => step.optionalAfterAppointment)
      .map((step) => step.key)
  );
  const achieved = {};
  scenario.scoring.forEach((metric) => {
    achieved[metric.key] = state.analyses.some((analysis) => analysis[metric.key] === true)
      || (typeof inspectionConversationMetricAchieved === "function"
        && inspectionConversationMetricAchieved(metric.key));
  });

  const retryCount = state.analyses.filter((analysis) =>
    analysis.scripted
    && analysis.blocked
    && analysis.noClarificationDeduction !== true
    && !achieved[analysis.stepKey]
    && !optionalAfterAppointmentKeys.has(analysis.stepKey)
  ).length;
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
    .map((metric) => {
      if (metric.key === "explained_duration_and_wait" && !state.inspectionMileageAsked) {
        return "作業時間を判断するため、現在の走行距離を確認することを意識すると、より良い応対になります";
      }
      if (metric.key === "explained_duration_and_wait" && state.inspectionMileageAsked) {
        return "基本作業時間と店内で待てることを説明することを意識すると、より良い応対になります";
      }
      return `${metric.action}ことを意識すると、より良い応対になります`;
    });
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
          interactionDelayAlreadyElapsed = true;
          els.replyForm.requestSubmit();
          interactionDelayAlreadyElapsed = false;
        } else {
          // Web Speech APIはスタッフの発話途中でも区切りをisFinalとして返すことがある。
          // ここでAIの相づちを再生したり認識を中断したりせず、同じマイクで続きを待つ。
          els.speechNote.textContent = "発言が途中のため、音声入力を続けています。";
        }
      }, interactionDelayMs());
    } else {
      els.speechNote.textContent = "音声入力中です。話し終えると自動的に次へ進みます。";
    }
  });

  speechRecognition.addEventListener("end", () => {
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
  if (speechInputStartTimer) {
    window.clearTimeout(speechInputStartTimer);
    speechInputStartTimer = null;
  }
  if (speechRestartTimer) {
    window.clearTimeout(speechRestartTimer);
    speechRestartTimer = null;
  }
  if (speechDecisionTimer) {
    window.clearTimeout(speechDecisionTimer);
    speechDecisionTimer = null;
  }
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
els.requiredCustomerSpeech?.addEventListener("click", handleInspectionCheckpointTest);
els.voiceSelect?.addEventListener("change", updateVoiceSelection);
els.interactionDelaySelect?.addEventListener("change", () => {
  localStorage.setItem("roleplayInteractionDelayMs", String(interactionDelayMs()));
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
const savedInteractionDelay = localStorage.getItem("roleplayInteractionDelayMs")
  || localStorage.getItem("roleplaySpeechDecisionDelayMs")
  || localStorage.getItem("roleplayCustomerReplyDelayMs");
if (
  els.interactionDelaySelect
  && ["500", "800", "1000", "1500", "2000"].includes(savedInteractionDelay)
) {
  els.interactionDelaySelect.value = savedInteractionDelay;
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
