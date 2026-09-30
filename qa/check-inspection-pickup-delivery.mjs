import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const scenarioSource = fs.readFileSync(new URL("../scenario.js", import.meta.url), "utf8");
const audioSource = fs.readFileSync(new URL("../audio-db.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(scenarioSource, context);

assert.equal(context.window.ROLEPLAY_SCENARIOS.length, 3, "第3シナリオが一覧へ追加されていません");
const base = context.window.VEHICLE_INSPECTION_SCENARIO;
const pickup = context.window.VEHICLE_INSPECTION_PICKUP_SCENARIO;
assert.equal(pickup.id, "vehicle-inspection-pickup-delivery");
assert.equal(pickup.pickupBranchEnabled, true);
assert.notEqual(pickup, base, "既存車検シナリオと同じオブジェクトを変更しています");
assert.equal(base.scoring.length, 17, "既存車検の17項目を変更しています");
assert.equal(pickup.scoring.length, 22, "引取納車の5項目が追加されていません");
assert.equal(
  base.steps.find((step) => step.key === "explained_duration_and_wait").customerResponse,
  "代車は貸してもらえますか？",
  "既存車検のお客様返答を変更しています"
);
const pickupDuration = pickup.steps.find((step) => step.key === "explained_duration_and_wait");
assert.equal(pickupDuration.customerResponse, "できれば、車を取りに来てもらえませんか？");
assert.equal(pickupDuration.customerAudioId, "inspection_pickup_request_customer");

context.window.ROLEPLAY_AUDIO_DB = undefined;
vm.runInContext(audioSource, context);
const expectedAudio = [
  "inspection_pickup_request_customer",
  "inspection_pickup_reason_work",
  "inspection_pickup_reason_distance",
  "inspection_pickup_reason_driving",
  "inspection_pickup_reason_competitor",
  "inspection_pickup_reason_misunderstanding",
  "inspection_pickup_visit_weekend",
  "inspection_pickup_visit_time",
  "inspection_pickup_visit_agreement",
  "inspection_pickup_still_requested",
  "inspection_pickup_location_customer",
  "inspection_pickup_confirmed_customer"
];
const audioItems = new Map(context.window.ROLEPLAY_AUDIO_DB.items.map((item) => [item.id, item]));
for (const id of expectedAudio) {
  const item = audioItems.get(id);
  assert.ok(item, `${id} が音声DBにありません`);
  assert.equal(item.status, "ready", `${id} が再生可能になっていません`);
  assert.ok(
    fs.existsSync(new URL(`../audio-ondoku/${item.file}`, import.meta.url)),
    `${item.file} が配置されていません`
  );
}

assert.match(appSource, /function handleInspectionPickupBranchReply\(text\)/);
assert.match(appSource, /function shouldStartInspectionPickupAfterDuration\(step, analysis\)/);
assert.match(appSource, /function shouldStartInspectionPickupFallback\(text, step\)/);
assert.match(appSource, /function startInspectionPickupRequest\(note\)/);
assert.match(appSource, /state\.inspectionPickupPhase === "reason"/);
assert.match(appSource, /state\.inspectionPickupPhase === "proposal"/);
assert.match(appSource, /state\.inspectionPickupPhase === "location"/);
assert.match(appSource, /state\.inspectionPickupPhase === "confirmation"/);
assert.match(appSource, /markPickupRouteBaseStepsNotApplicable\(\)/);
assert.match(appSource, /responseStep\.customerAudioId/);
assert.match(appSource, /function isVehicleInspectionScenario\(candidate = scenario\)/);

const timingStart = appSource.indexOf("function shouldStartInspectionPickupAfterDuration");
const timingEnd = appSource.indexOf("function handleInspectionPickupBranchReply", timingStart);
assert.notEqual(timingStart, -1, "引取依頼の開始タイミング判定が見つかりません");
assert.notEqual(timingEnd, -1, "引取依頼の開始タイミング判定の終端が見つかりません");

function timingContext({ pickupScenario, active = false, phase = null } = {}) {
  const context = {
    state: {
      inspectionPickupActive: active,
      inspectionPickupPhase: phase
    },
    isPickupInspectionScenario: () => Boolean(pickupScenario)
  };
  vm.createContext(context);
  vm.runInContext(appSource.slice(timingStart, timingEnd), context);
  return context;
}

const pickupTiming = timingContext({ pickupScenario: true });
assert.equal(
  pickupTiming.shouldStartInspectionPickupAfterDuration(
    { key: "explained_duration_and_wait" },
    { passed: true }
  ),
  true,
  "引取納車対応で作業時間・店内待ち達成直後に引取依頼へ進みません"
);
assert.equal(
  pickupTiming.shouldStartInspectionPickupAfterDuration(
    { key: "explained_duration_and_wait" },
    { passed: false }
  ),
  false,
  "作業時間・店内待ちが未達なのに引取依頼へ進んでいます"
);
assert.equal(
  timingContext({ pickupScenario: false }).shouldStartInspectionPickupAfterDuration(
    { key: "explained_duration_and_wait" },
    { passed: true }
  ),
  false,
  "通常車検へ引取納車の開始タイミングを適用しています"
);
assert.equal(
  timingContext({ pickupScenario: true, active: true, phase: "reason" })
    .shouldStartInspectionPickupAfterDuration(
      { key: "explained_duration_and_wait" },
      { passed: true }
    ),
  false,
  "同じ引取依頼を繰り返しています"
);
assert.match(
  appSource,
  /if \(shouldStartPickupAfterDuration\) \{[\s\S]*?customerResponseOverride = \{[\s\S]*?pickupDurationResponseStep\.customerResponse[\s\S]*?pickupDurationResponseStep\.customerAudioId/,
  "引取依頼が通常の予約・代車返答より優先されていません"
);

const fallbackStart = appSource.indexOf("function asksInspectionDirectVisitInvitation");
const fallbackEnd = appSource.indexOf("function startInspectionPickupRequest", fallbackStart);
assert.notEqual(fallbackStart, -1, "案内漏れ時の引取依頼判定が見つかりません");
assert.notEqual(fallbackEnd, -1, "案内漏れ時の引取依頼判定の終端が見つかりません");

function fallbackContext({ pickupScenario, active = false, phase = null, appointment = null } = {}) {
  const context = {
    state: {
      inspectionPickupActive: active,
      inspectionPickupPhase: phase,
      proposedAppointment: appointment
    },
    isPickupInspectionScenario: () => Boolean(pickupScenario),
    inspectionLastQuestionClause: (text) => text,
    normalizeScriptedText: (text) => String(text || "").replace(/[\s、。,.!！?？]/g, ""),
    isScriptedQuestion: (text) => /(?:いかが|よろしい|できます|ですか|ますか|でしょうか|か)$/.test(String(text || "")),
    hasInspectionAppointmentCoordinationEvidence: (text) => /9月|何時|ご希望の日/.test(text),
    hasExplicitBookingContinuationConfirmation: (text) => /予約手続き|このまま予約/.test(text),
    asksInspectionWaitingMethodConfirmation: (text) => /待ち.*(?:ますか|でしょうか)/.test(text),
    hasInspectionWaitingChoiceOffer: (text) => /店内.*待/.test(text)
  };
  vm.createContext(context);
  vm.runInContext(appSource.slice(fallbackStart, fallbackEnd), context);
  return context;
}

const fallbackTiming = fallbackContext({ pickupScenario: true });
assert.equal(
  fallbackTiming.shouldStartInspectionPickupFallback(
    "では、9月30日の10時半はいかがでしょうか？",
    { key: "explained_loaner" }
  ),
  true,
  "案内漏れのまま具体的な日時へ進んだ際に引取依頼へ進みません"
);
assert.equal(
  fallbackTiming.shouldStartInspectionPickupFallback(
    "このまま予約手続きを進めてもよろしいでしょうか？",
    { key: "explained_loaner" }
  ),
  true,
  "案内漏れのまま予約手続きへ進んだ際に引取依頼へ進みません"
);
assert.equal(
  fallbackTiming.shouldStartInspectionPickupFallback(
    "当日は店内でお待ちになりますか？",
    { key: "explained_loaner" }
  ),
  true,
  "案内漏れのまま待ち方確認へ進んだ際に引取依頼へ進みません"
);
assert.equal(
  fallbackTiming.shouldStartInspectionPickupFallback(
    "ぜひご入庫お願いしたいと思いますが、いかがでしょうか？",
    { key: "explained_available_period" }
  ),
  true,
  "来店・入庫依頼へ進んだ際に引取依頼を開始できません"
);
assert.equal(
  fallbackTiming.shouldStartInspectionPickupFallback(
    "ぜひご入校お願いしたいと思いますが、いかがでしょうか？",
    { key: "explained_available_period" }
  ),
  true,
  "音声認識された『入校』を入庫依頼として扱えません"
);
assert.equal(
  fallbackTiming.shouldStartInspectionPickupFallback(
    "ありがとうございます。",
    { key: "explained_loaner" }
  ),
  false,
  "予約・来店へ進んでいない相づちで引取依頼を開始しています"
);
assert.equal(
  fallbackTiming.shouldStartInspectionPickupFallback(
    "9月30日の10時半はいかがでしょうか？",
    { key: "explained_duration_and_wait" }
  ),
  false,
  "作業時間工程の一度目の不足確認を飛ばしています"
);
assert.equal(
  fallbackContext({ pickupScenario: false }).shouldStartInspectionPickupFallback(
    "9月30日の10時半はいかがでしょうか？",
    { key: "explained_loaner" }
  ),
  false,
  "通常車検へ案内漏れ時の引取分岐を適用しています"
);
assert.match(
  appSource,
  /step\.key === "explained_duration_and_wait"[\s\S]*?startInspectionPickupRequest\([\s\S]*?不足は採点へ残し/,
  "作業時間工程の不足確認後に引取依頼へ進む処理が見つかりません"
);

const audioSelectorStart = appSource.indexOf("function inspectionCustomerResponseAudioId");
const audioSelectorEnd = appSource.indexOf("function handleInspectionPickupBranchReply", audioSelectorStart);
assert.notEqual(audioSelectorStart, -1, "表示文に対応する音声選択処理が見つかりません");
const audioSelectorContext = {};
vm.createContext(audioSelectorContext);
vm.runInContext(appSource.slice(audioSelectorStart, audioSelectorEnd), audioSelectorContext);
assert.equal(
  audioSelectorContext.inspectionCustomerResponseAudioId(
    null,
    null,
    { key: "explained_duration_and_wait", customerAudioId: "inspection_pickup_request_customer" },
    true
  ),
  "inspection_thanked_customer_retry",
  "表示が『はい。』なのに引取依頼MP3を選択しています"
);
assert.equal(
  audioSelectorContext.inspectionCustomerResponseAudioId(
    { text: "できれば、車を取りに来てもらえませんか？", audioId: "inspection_pickup_request_customer" },
    null,
    { key: "explained_duration_and_wait", customerAudioId: "inspection_pickup_request_customer" },
    false
  ),
  "inspection_pickup_request_customer",
  "表示が引取依頼のときに対応するMP3を選択できません"
);

const branchStart = appSource.indexOf("const inspectionPickupReasons");
const branchEnd = appSource.indexOf("function handleScriptedStaffReply", branchStart);
assert.notEqual(branchStart, -1);
assert.notEqual(branchEnd, -1);

function branchContext(variantSeed) {
  const messages = [];
  const scenario = structuredClone(pickup);
  const state = {
    inspectionPickupActive: true,
    inspectionPickupPhase: "reason",
    inspectionPickupReason: null,
    inspectionPickupOutcome: null,
    variantSeed,
    analyses: [],
    scriptStep: scenario.steps.findIndex((step) => step.key === "explained_loaner"),
    currentState: "SERVICE_EXPLANATION",
    turn: 0
  };
  const context = {
    scenario,
    state,
    els: { speechNote: { textContent: "" } },
    normalizeScriptedText: (text) => String(text || "").replace(/[\s、。,.!！?？]/g, ""),
    isScriptedQuestion: (text) => /(?:なぜ|どうして|理由|事情|差し支え|どのような|どこ|どちら|場所|ですか|ますか|でしょうか|か)$/.test(String(text || "")),
    asksCurrentMileage: (text) => /(?:走行距離|距離数|何(?:キロ|km)|距離.{0,12}(?:乗|走))/.test(String(text || "")),
    asksInspectionDirectVisitInvitation: (text) => {
      const normalized = String(text || "");
      return /(?:ご入庫|入庫|ご入校|入校|ご来店|来店|お越し)/.test(normalized)
        && /(?:お願い|いただけ|いただき|できます|可能|いかが|よろしい)/.test(normalized);
    },
    isPickupInspectionScenario: () => true,
    hasCompleteInspectionAppointmentProposal: (text) => /\d{1,2}月\d{1,2}日.*\d{1,2}時/.test(String(text || "")),
    markScriptedStepNotApplicable(step, reason) {
      if (!step) return;
      state.analyses.push({ stepKey: step.key, notApplicable: true, evidence: [reason] });
    },
    addMessage(role, text, options) { messages.push({ role, text, ...options }); },
    renderProgress() {}
  };
  vm.createContext(context);
  vm.runInContext(appSource.slice(branchStart, branchEnd), context);
  return { context, state, messages };
}

const visitBranch = branchContext(1);
assert.equal(visitBranch.context.handleInspectionPickupBranchReply("差し支えなければ、引取をご希望の理由を教えていただけますか？"), true);
assert.equal(visitBranch.state.inspectionPickupReason, "distance");
assert.equal(visitBranch.messages.at(-1).audioId, "inspection_pickup_reason_distance");
assert.equal(
  visitBranch.context.handleInspectionPickupBranchReply("距離があって大変なのですね。近い店舗をご案内できます。引取と来店のどちらがよろしいですか？"),
  true
);
assert.equal(visitBranch.state.inspectionPickupOutcome, "visit");
assert.equal(visitBranch.state.inspectionPickupPhase, "resolved");

const pickupBranch = branchContext(0);
pickupBranch.context.handleInspectionPickupBranchReply("差し支えなければ、引取をご希望の理由を教えていただけますか？");
pickupBranch.context.handleInspectionPickupBranchReply("お仕事で大変なのですね。土日なら来店できます。難しい場合は引取も選べますが、いかがですか？");
assert.equal(pickupBranch.state.inspectionPickupOutcome, "pickup");
assert.equal(pickupBranch.messages.at(-1).audioId, "inspection_pickup_still_requested");
assert.equal(pickupBranch.context.handleInspectionPickupBranchReply("引き取り先はどちらですか？"), true);
assert.equal(pickupBranch.messages.at(-1).audioId, "inspection_pickup_location_customer");
assert.equal(pickupBranch.context.handleInspectionPickupBranchReply("かしこまりました。自宅へ伺います。"), true);
assert.equal(pickupBranch.messages.at(-1).audioId, "inspection_pickup_confirmed_customer");
assert.deepEqual(
  pickupBranch.state.analyses.filter((item) => item.notApplicable).map((item) => item.stepKey).sort(),
  ["confirmed_waiting", "explained_loaner", "explained_lock_and_arrival"].sort()
);

// 引取場所を回答した直後は「わかりました」でも受付承諾として扱う。
const naturalPickupAcceptance = branchContext(0);
naturalPickupAcceptance.state.inspectionPickupPhase = "confirmation";
naturalPickupAcceptance.state.inspectionPickupOutcome = "pickup";
assert.equal(
  naturalPickupAcceptance.context.handleInspectionPickupBranchReply("わかりました。"),
  true
);
assert.equal(naturalPickupAcceptance.state.inspectionPickupPhase, "resolved");
assert.equal(naturalPickupAcceptance.messages.at(-1).audioId, "inspection_pickup_confirmed_customer");
assert.equal(
  naturalPickupAcceptance.context.hasInspectionPickupVisitConflict(
    "ご来店の際に車検証をお持ちください。"
  ),
  true
);
assert.equal(
  naturalPickupAcceptance.context.hasInspectionPickupVisitConflict(
    "9月30日10時半に自宅へ引き取りに伺います。"
  ),
  false
);

const directAcceptance = branchContext(4);
assert.equal(directAcceptance.context.handleInspectionPickupBranchReply("かしこまりました。引き取りを承ります。"), true);
assert.equal(directAcceptance.state.inspectionPickupOutcome, "pickup");
assert.equal(directAcceptance.messages.at(-1).audioId, "inspection_pickup_location_customer");
assert.equal(
  directAcceptance.state.analyses.some((item) => item.stepKey === "pickup_reason_confirmed" && item.passed),
  false,
  "理由確認を省略した直接受付に理由確認点を与えています"
);

// 高得点の通常車検で実際に使われている、理由を仮定した聞き方にも対応する。
const naturalReasonQuestion = branchContext(3);
assert.equal(
  naturalReasonQuestion.context.handleInspectionPickupBranchReply("お仕事か何かで、ご来店の都合が悪いですか？"),
  true
);
assert.equal(naturalReasonQuestion.state.inspectionPickupReason, "work");
assert.equal(naturalReasonQuestion.messages.at(-1).audioId, "inspection_pickup_reason_work");

// 希望を受け止める「かしこまりました」が理由質問と同じ発話にあっても、
// 引取確定へ飛ばず、質問された理由を具体的に回答する。
const reasonAfterAcknowledgement = branchContext(1);
assert.equal(
  reasonAfterAcknowledgement.context.handleInspectionPickupBranchReply(
    "お車引き取り希望ですね。かしこまりました。何か不都合があってのことでしょうか？"
  ),
  true
);
assert.equal(reasonAfterAcknowledgement.state.inspectionPickupReason, "distance");
assert.equal(reasonAfterAcknowledgement.state.inspectionPickupPhase, "proposal");
assert.equal(reasonAfterAcknowledgement.messages.at(-1).audioId, "inspection_pickup_reason_distance");

// 引取理由待ちでも「走行距離」の距離を、自宅からの距離理由と誤認しない。
const mileageBeforeReason = branchContext(1);
assert.equal(
  mileageBeforeReason.context.handleInspectionPickupBranchReply(
    "佐藤様、ヤリスの現在の走行距離はどのくらい乗られていますか？"
  ),
  false
);
assert.equal(mileageBeforeReason.state.inspectionPickupReason, null);
assert.equal(mileageBeforeReason.messages.length, 0);

// 走行距離を説明してから車両状態を尋ねた発話の「距離」は、
// 自宅から店舗までの距離理由として扱わない。
const mileageExplanationBeforeReason = branchContext(1);
assert.equal(
  mileageExplanationBeforeReason.context.handleInspectionPickupBranchReply(
    "距離3万キロぐらいですと1時間半ほどですが、気になるところはございませんか？"
  ),
  false
);
assert.equal(mileageExplanationBeforeReason.state.inspectionPickupReason, null);
assert.equal(mileageExplanationBeforeReason.messages.length, 0);

// 理由を聞かずに来店を勧めた場合は「はい」と承諾せず、理由を伝える。
// ただしスタッフは理由を確認していないため、理由確認の得点は付けない。
const visitBeforeReason = branchContext(1);
assert.equal(
  visitBeforeReason.context.handleInspectionPickupBranchReply(
    "お店で待っていただいて車検できますが、ご来店はいかがでしょうか？"
  ),
  true
);
assert.equal(visitBeforeReason.state.inspectionPickupReason, "distance");
assert.equal(visitBeforeReason.state.inspectionPickupPhase, "proposal");
assert.equal(visitBeforeReason.messages.at(-1).audioId, "inspection_pickup_reason_distance");
assert.equal(
  visitBeforeReason.state.analyses.some((item) => item.stepKey === "pickup_reason_confirmed" && item.passed),
  false
);

// 運転不安に対して理由に合う代替案も引取選択肢もない来店依頼なら、
// 来店を承諾せず引取希望を維持する。
const unfitDrivingProposal = branchContext(2);
unfitDrivingProposal.context.handleInspectionPickupBranchReply("運転にご不安がありますか？");
assert.equal(unfitDrivingProposal.state.inspectionPickupReason, "driving");
assert.equal(
  unfitDrivingProposal.context.handleInspectionPickupBranchReply(
    "工場から整備内容をご説明したいので、ご来店いただけますか？"
  ),
  true
);
assert.equal(unfitDrivingProposal.state.inspectionPickupOutcome, "pickup");
assert.equal(unfitDrivingProposal.state.inspectionPickupPhase, "location");
assert.equal(unfitDrivingProposal.messages.at(-1).text, "今回は引き取りでお願いしたいです。");
assert.equal(unfitDrivingProposal.messages.at(-1).audioId, "inspection_pickup_still_requested");

for (const testCase of [
  ["ご自宅からお店まで距離があって遠いですか？", "distance", "inspection_pickup_reason_distance"],
  ["運転にご不安がありますか？", "driving", "inspection_pickup_reason_driving"],
  ["ほかのお店では取りに来ると聞かれましたか？", "competitor", "inspection_pickup_reason_competitor"],
  ["以前は引き取りできると聞いた認識でしょうか？", "misunderstanding", "inspection_pickup_reason_misunderstanding"]
]) {
  const [staffText, reasonKey, audioId] = testCase;
  const branch = branchContext(0);
  assert.equal(branch.context.handleInspectionPickupBranchReply(staffText), true, staffText);
  assert.equal(branch.state.inspectionPickupReason, reasonKey, staffText);
  assert.equal(branch.messages.at(-1).audioId, audioId, staffText);
}

// 引取希望を一度維持した後でも、来店可否を具体的に確認されたら通常予約へ復帰する。
const laterVisit = branchContext(0);
laterVisit.context.handleInspectionPickupBranchReply("引取をご希望の理由を教えていただけますか？");
laterVisit.context.handleInspectionPickupBranchReply("お仕事で大変なのですね。土日の来店もできます。引取と来店のどちらがよろしいですか？");
assert.equal(laterVisit.state.inspectionPickupPhase, "location");
assert.equal(laterVisit.context.handleInspectionPickupBranchReply("土曜日にご来店いただくことは可能でしょうか？"), true);
assert.equal(laterVisit.state.inspectionPickupOutcome, "visit");
assert.equal(laterVisit.state.inspectionPickupPhase, "resolved");
assert.equal(laterVisit.messages.at(-1).audioId, "inspection_pickup_visit_weekend");

// 引取希望を維持した後の日時だけの提示は、来店予約へ自動変更しない。
const pickupDateOnly = branchContext(0);
pickupDateOnly.context.handleInspectionPickupBranchReply("引取をご希望の理由を教えていただけますか？");
pickupDateOnly.context.handleInspectionPickupBranchReply("お仕事で大変なのですね。土日の来店もできます。難しい場合は引取も選べますが、いかがですか？");
assert.equal(pickupDateOnly.state.inspectionPickupPhase, "location");
assert.equal(
  pickupDateOnly.context.handleInspectionPickupBranchReply("9月30日10時半はいかがでしょうか？"),
  false
);
assert.equal(pickupDateOnly.state.inspectionPickupOutcome, "pickup");
assert.equal(pickupDateOnly.state.inspectionPickupPhase, "location");

// 日時と来店確認を一文で案内した場合は、その日時を了承して分岐を完了する。
const datedVisit = branchContext(0);
datedVisit.context.handleInspectionPickupBranchReply("引取をご希望の理由を教えていただけますか？");
datedVisit.context.handleInspectionPickupBranchReply("お仕事で大変なのですね。土日の来店もできます。引取と来店のどちらがよろしいですか？");
assert.equal(datedVisit.context.handleInspectionPickupBranchReply("9月30日10時半にご来店いただけますか？"), true);
assert.equal(datedVisit.state.inspectionPickupOutcome, "visit");
assert.equal(datedVisit.messages.at(-1).text, "では、その日でお願いします。");

assert.match(
  appSource,
  /(?:ませんか\|[^\n]*)|(?:ませんか)/,
  "『ございませんか』を完成した質問として扱う条件がありません"
);
assert.match(
  appSource,
  /ご来店\|来店いただ\|お越し\|お待ち/,
  "日時と来店確認をまとめた予約提案の表現が登録されていません"
);
assert.match(
  appSource,
  /\(\?:今\|現在\)\.\{0,10\}\(\?:お電話\|電話\)/,
  "『今、佐藤様のお電話でよろしいですか』の連絡先確認表現が登録されていません"
);

const availableRangeStart = appSource.indexOf("function inspectionAppointmentBeforeAvailableFrom");
const availableRangeEnd = appSource.indexOf("function isInspectionDeadlineDateCandidate", availableRangeStart);
assert.notEqual(availableRangeStart, -1, "作業可能日前の日時判定が見つかりません");
const availableRangeContext = {
  scenario: { availableFrom: "8月1日" },
  normalizeScriptedText: (text) => String(text || "").replace(/\s/g, ""),
  hasInspectionAppointmentProposalEvidence: (text) => /(?:いかが|よろしい|作業可能|予約)/.test(String(text || "")),
  inspectionAppointmentProposalMatch: (text) => {
    const match = String(text || "").match(/(\d{1,2})月(\d{1,2})日.*?(\d{1,2})時/);
    return match ? { month: match[1], day: match[2], hour: match[3] } : null;
  }
};
vm.createContext(availableRangeContext);
vm.runInContext(appSource.slice(availableRangeStart, availableRangeEnd), availableRangeContext);
assert.equal(availableRangeContext.inspectionAppointmentBeforeAvailableFrom("6月30日10時半はいかがでしょうか"), true);
assert.equal(availableRangeContext.inspectionAppointmentBeforeAvailableFrom("8月1日10時半はいかがでしょうか"), false);
assert.equal(availableRangeContext.inspectionAppointmentBeforeAvailableFrom("9月30日10時半はいかがでしょうか"), false);
assert.match(
  appSource,
  /inspectionAppointmentBeforeAvailableFrom\(text\)[\s\S]*?inspection_appointment_date_missing_retry/,
  "作業可能日前の日付を確定せず再確認する処理がありません"
);
assert.match(
  appSource,
  /inspectionAppointmentRouteMatchesRecap\(text\)[\s\S]*?inspectionPickupOutcome === "pickup"[\s\S]*?引取/,
  "予約復唱で引取・来店の受付方法を照合できません"
);

console.log("車検誘致・引取納車対応: シナリオ、分岐、採点、音声12件を確認しました");
