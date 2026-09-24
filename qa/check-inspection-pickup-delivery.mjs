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
assert.match(appSource, /state\.inspectionPickupPhase === "reason"/);
assert.match(appSource, /state\.inspectionPickupPhase === "proposal"/);
assert.match(appSource, /state\.inspectionPickupPhase === "location"/);
assert.match(appSource, /state\.inspectionPickupPhase === "confirmation"/);
assert.match(appSource, /markPickupRouteBaseStepsNotApplicable\(\)/);
assert.match(appSource, /responseStep\.customerAudioId/);
assert.match(appSource, /function isVehicleInspectionScenario\(candidate = scenario\)/);

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
    isPickupInspectionScenario: () => true,
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

const directAcceptance = branchContext(4);
assert.equal(directAcceptance.context.handleInspectionPickupBranchReply("かしこまりました。引き取りを承ります。"), true);
assert.equal(directAcceptance.state.inspectionPickupOutcome, "pickup");
assert.equal(directAcceptance.messages.at(-1).audioId, "inspection_pickup_location_customer");
assert.equal(
  directAcceptance.state.analyses.some((item) => item.stepKey === "pickup_reason_confirmed" && item.passed),
  false,
  "理由確認を省略した直接受付に理由確認点を与えています"
);

console.log("車検誘致・引取納車対応: シナリオ、分岐、採点、音声12件を確認しました");
