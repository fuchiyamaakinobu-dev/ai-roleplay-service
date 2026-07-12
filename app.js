const scenario = window.ROLEPLAY_SCENARIO;
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
  variantSeed: 0,
  currentObjection: null,
  transcript: [],
  analyses: [],
  usedVariants: {}
};

const els = {
  startButton: document.querySelector("#startButton"),
  resetButton: document.querySelector("#resetButton"),
  finishButton: document.querySelector("#finishButton"),
  printButton: document.querySelector("#printButton"),
  audioEnabled: document.querySelector("#audioEnabled"),
  replyForm: document.querySelector("#replyForm"),
  staffInput: document.querySelector("#staffInput"),
  micButton: document.querySelector("#micButton"),
  speechNote: document.querySelector("#speechNote"),
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
  otherStore: ["他店舗", "別店舗", "市内", "帯広", "近くのお店"],
  choice: ["無理に", "可能です", "選べ", "ご都合", "難しい場合", "検討"],
  nextAction: ["いつ", "候補", "予約", "ご都合", "何日", "午前", "午後", "連絡", "確認"],
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

function renderProgress() {
  els.progressStrip.innerHTML = scenario.progress
    .map((item) => {
      const currentIndex = scenario.progress.findIndex((p) => p.state === state.currentState);
      const itemIndex = scenario.progress.findIndex((p) => p.state === item.state);
      const klass = item.state === state.currentState ? "is-active" : itemIndex < currentIndex ? "is-done" : "";
      return `<div class="progress-item ${klass}">${item.label}</div>`;
    })
    .join("");
  const active = scenario.progress.find((item) => item.state === state.currentState);
  els.stateLabel.textContent = active ? active.label : "進行中";
}

function audioPath(audioId) {
  const item = audioIndex.get(audioId);
  if (!item || item.status !== "ready") return "";
  return `${audioDb.basePath || "audio/"}${item.file}`;
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
    if (message.audioSrc && els.audioEnabled.checked) {
      playAudio(message.audioSrc, message.text, false, startSpeechInputAfterCustomer);
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
      const audioButton = message.audioSrc
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

function startSpeechInputAfterCustomer() {
  window.setTimeout(() => {
    if (!state.started || state.ended || !speechRecognition || speechListening) return;
    speechListening = true;
    speechBaseText = els.staffInput.value.trim();
    updateMicButton(true);
    els.speechNote.textContent = "AIお客様の発話が終了しました。音声入力中です。話し終えたら送信を押してください。";
    try {
      speechRecognition.start();
    } catch (_) {
      speechListening = false;
      updateMicButton(false);
      els.speechNote.textContent = "音声入力を開始できませんでした。マイクボタンを押してください。";
    }
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
  state.currentState = "INSPECTION_REQUEST_RECEIVED";
  state.turn = 0;
  state.variantSeed = Math.floor(Math.random() * 1000);
  state.currentObjection = null;
  state.transcript = [];
  state.analyses = [];
  state.usedVariants = {};
  resetResults();
  addMessage("customer", scenario.initialCustomerMessage, { audioId: scenario.audio.initial });
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
  const isQuestion = /[？?]$/.test(text) || includesAny(normalized, ["でしょうか", "ですか", "ますか", "でしょう"]);
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
    || includesAny(normalized, ["時間帯", "午前", "午後", "代車"]);
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
    accepted_pickup: acceptedPickup,
    pickup_acceptance_strength: pickupStrength,
    asked_reason: includesAny(normalized, lexicon.reasonQuestion),
    explained_service_time: hasConcreteServiceTime,
    explained_visit_benefit: includesAny(normalized, lexicon.visitBenefit),
    proposed_weekend: includesAny(normalized, lexicon.weekend),
    proposed_other_store: includesAny(normalized, lexicon.otherStore),
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
  if (analysis.decision === "pickup_accepted_immediately") {
    state.currentState = "PICKUP_REQUEST";
    state.ended = true;
    return customerTurn("はい、お願いします。", scenario.audio.acceptedPickup);
  }

  if (analysis.decision === "needs_more_context") {
    return customerTurn("すみません、もう一度どうしたらよいか教えてもらえますか？", scenario.audio.needsMoreContext);
  }

  if (state.currentState === "INSPECTION_REQUEST_RECEIVED") {
    state.currentState = "SERVICE_TIME_QUESTION";
    const index = pickRandomIndex(scenario.serviceTimeQuestions, "service-time");
    return customerTurn(
      scenario.serviceTimeQuestions[index],
      scenario.audio.serviceTimeQuestions[index]
    );
  }

  if (state.currentState === "SERVICE_TIME_QUESTION") {
    state.currentState = "PICKUP_REQUEST";
    const index = pickRandomIndex(scenario.pickupRequests, "pickup-request");
    return customerTurn(scenario.pickupRequests[index], scenario.audio.pickupRequests[index]);
  }

  if (state.currentState === "PICKUP_REQUEST") {
    state.currentState = "VISIT_PROPOSAL";
    state.currentObjection = selectObjection(analysis);
    const objection = scenario.objections[state.currentObjection];
    const objectionTexts = objection.customer;
    const objectionAudio = scenario.audio.objections[state.currentObjection];
    const index = pickRandomIndex(objectionTexts, `objection-${state.currentObjection}`);
    return customerTurn(
      objectionTexts[index],
      objectionAudio[index]
    );
  }

  if (state.currentState === "VISIT_PROPOSAL") {
    state.currentState = "ALTERNATIVE_PROPOSAL";
    if (analysis.proposed_weekend || analysis.proposed_other_store || analysis.next_action_confirmed) {
      const agreementId = pickVariant(scenario.audio.possibleAgreements, "agreement");
      const agreementItem = audioIndex.get(agreementId);
      return customerTurn(agreementItem?.text || "土日なら行けるかもしれません。", agreementId);
    }
    const followUpId = pickVariant(scenario.audio.followUps, "follow-up");
    const followUpItem = audioIndex.get(followUpId);
    return customerTurn(followUpItem?.text || "では、いつなら空いていますか？", followUpId);
  }

  if (state.currentState === "ALTERNATIVE_PROPOSAL") {
    state.ended = true;
    const closingId = pickVariant(scenario.audio.closings, "closing");
    const closingItem = audioIndex.get(closingId);
    return customerTurn(closingItem?.text || "では、その日にお願いします。", closingId);
  }

  return customerTurn("ありがとうございます。続けてお願いします。", "");
}

function selectObjection(analysis) {
  const candidates = ["work", "distance", "competitor", "misunderstanding", "family"];
  if (analysis.proposed_other_store) candidates.push("competitor", "distance");
  if (analysis.proposed_weekend) candidates.push("work", "family");
  if (analysis.asked_reason) candidates.push("distance", "work");
  return candidates[randomIndex(candidates.length)];
}

function handleReply(event) {
  event.preventDefault();
  if (!state.started || state.ended) return;
  const text = els.staffInput.value.trim();
  if (!text) return;

  stopSpeechInput();
  els.staffInput.value = "";
  addMessage("staff", text);
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
  const merged = state.analyses.reduce((acc, item) => {
    scenario.scoring.forEach((metric) => {
      acc[metric.key] = Boolean(acc[metric.key] || item[metric.key]);
    });
    acc.accepted_pickup = Boolean(acc.accepted_pickup || item.accepted_pickup);
    acc.pressured_customer = Boolean(acc.pressured_customer || item.pressured_customer);
    acc.refused_pickup = Boolean(acc.refused_pickup || item.refused_pickup);
    return acc;
  }, {});

  let score = scenario.scoring.reduce((sum, metric) => sum + (merged[metric.key] ? metric.points : 0), 0);
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

  score = Math.max(0, Math.min(100, score));

  const good = [];
  const improve = [];
  scenario.scoring.forEach((metric) => {
    if (merged[metric.key]) good.push(`${metric.label}ことができています`);
    else improve.push(`${metric.label}を入れると、より良い応対になります`);
  });
  penalties.forEach((penalty) => improve.unshift(penalty));

  return {
    score,
    good: good.slice(0, 4),
    improve: improve.slice(0, 4),
    recommendedTalk: scenario.recommendedTalk,
    judgements: state.analyses.map((analysis, index) => {
      const strength = analysis.pickup_acceptance_strength;
      const confidence = Math.round(analysis.confidence * 100);
      return `${index + 1}回目: 引取確定度 ${strength} / 信頼度 ${confidence}%`;
    })
  };
}

function renderResults(result) {
  els.scoreBadge.textContent = "採点済み";
  els.scoreNumber.textContent = `${result.score}`;
  els.scoreSummary.textContent = result.score >= 80
    ? "来店促進の流れがよくできています。"
    : result.score >= 60
      ? "基本はできています。理由確認と次の約束を強めると安定します。"
      : "引取依頼への対応手順をもう一度練習しましょう。";
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
els.replyForm.addEventListener("submit", handleReply);
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
  if (message?.audioSrc) {
    const shouldRestartMic = message.role === "customer" && state.started && !state.ended;
    if (shouldRestartMic) stopSpeechInput();
    playAudio(
      message.audioSrc,
      message.text,
      true,
      shouldRestartMic ? startSpeechInputAfterCustomer : null
    );
  }
});

renderProgress();
setupSpeech();
