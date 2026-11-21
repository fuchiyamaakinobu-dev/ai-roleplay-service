import assert from "node:assert/strict";
import fs from "node:fs";
import { session } from "./check-inspection-llm-selection.mjs";

const pickupScenario = "vehicle-inspection-pickup-delivery";
const serviceScenario = "service-12month-visit-promotion";
const appSource = fs.readFileSync("app.js", "utf8");
const availability = [
  "本日ご連絡させていただいたのがヤリスの車検の件のご連絡でした。9月の30日にマリオ日迎えるのですが、ご都合いかがでしょうか？",
  "本日ご連絡させていただいたのが来週先の件でした9月の30日に満龍日迎えるのですがご都合の方いかがでしょうか"
];
const visitWithLoaner = "ありがとうございます。17あ、9月の17日なんですけども、ご来店いただいて代車をご用意しますので、代車に乗っていただいておうちに帰ってもらうことって可能でしょうか？";
const weekend = "かしこまりましたそうですね平日仕事ですよね土日とかでご都合いかがでしょうか";
const waitAtAppointment = "ありがとうございますでは9月の17日の10時半からご来店いただいてお待ちいただいて作業させていただく方でもよろしいでしょうか";

function open(scenario, mode) {
  const s = session(scenario, async (request) => {
    if (mode === "error") throw Error("offline");
    const loaner = request.candidates.find((candidate) => candidate.action === "inspection_loaner_offer");
    return mode === "offer" && loaner ? { id: loaner.id } : { id: "rule" };
  });
  s.run(appSource.slice(appSource.indexOf("function addMessage("), appSource.indexOf("function renderConversation(")));
  s.run("renderConversation = () => {}; startSpeechInputAfterCustomer = () => {}; interactionDelayMs = () => 0;");
  if (mode === "off") s.run("window.ROLEPLAY_INTENT_ASSIST.enabled = () => false");
  return s;
}

function reply(s, id) {
  assert.equal(s.run("state.transcript.at(-1).audioId"), id);
  assert.equal(s.run(`audioIndex.get(${JSON.stringify(id)}).text`), s.run("state.transcript.at(-1).text"));
  assert.ok(fs.existsSync(s.run(`audioPath(${JSON.stringify(id)})`)), id);
  assert.equal(s.run("Boolean(state.transcript.at(-1).emergencyAudio)"), false, id);
}

for (const mode of ["off", "held", "error", "offer"]) {
  for (const text of availability) {
    const flow = open(pickupScenario, mode);
    flow.run("state.scriptStep = 0");
    await flow.say("佐藤様のお宅ですか？");
    await flow.say("トヨタモビリティ帯広本別店の寺谷と申します。日頃は大変お世話になっております。");
    await flow.say(text);
    reply(flow, "inspection_asked_availability_customer");
    assert.equal(flow.run("state.scriptedPartialReplies.inspectionPickupDate"), undefined);
    assert.equal(flow.run("state.inspectionAppointmentCandidate"), null);
  }

  const highMileage = open(pickupScenario, mode);
  highMileage.run(`
    state.inspectionMileageAsked = true;
    state.inspectionMileageVariant = "120000";
    state.inspectionAppointmentCandidate = { text: "9月17日10時", month: "9", day: "17", hour: "10", minute: 0 };
  `);
  await highMileage.say(visitWithLoaner);
  reply(highMileage, "inspection_pickup_request_customer");
  assert.equal(highMileage.run("state.inspectionPickupPhase"), "reason");
  assert.equal(highMileage.run("state.inspectionLoanerRequested"), false);
  assert.equal(highMileage.run("state.inspectionAppointmentCandidate.hour"), "10");
  assert.equal(highMileage.run("state.proposedAppointment"), null);

  const work = open(pickupScenario, mode);
  work.run(`
    state.inspectionPickupActive = true;
    state.inspectionPickupPhase = "proposal";
    state.inspectionPickupReason = "work";
    state.inspectionMileageVariant = "30000";
    state.transcript.push({ role: "staff", text: "追加整備がなければ1時間半で車検ができます。" });
  `);
  await work.say(weekend);
  reply(work, "inspection_day_preference_answer");
  assert.equal(work.run("state.inspectionPickupActive"), true);
  assert.equal(work.run("state.inspectionPickupReason"), "work");
  assert.equal(work.run("state.inspectionPickupOutcome"), null);
  await work.say("お仕事でご来店が難しいというご事情ですか？");
  reply(work, "inspection_pickup_reason_work");

  await work.say("かしこまりました。お仕事がお休みの時にご来店いただくのって可能でしょうか。");
  reply(work, "inspection_pickup_visit_agreement");
  await work.say(waitAtAppointment);
  reply(work, "inspection_duration_accepted_wait_in_store");
  assert.equal(work.run("state.proposedAppointment.minute"), 30);
  await work.say("その際代車のほうは必要でしょうか");
  reply(work, "inspection_confirmed_waiting_customer");
  assert.equal(work.run("state.inspectionWaitingMethod"), "store");
  assert.equal(work.run("state.inspectionLoanerRequested"), false);
  await work.say("では9月18日の午後2時に変更して、店内でお待ちいただく形でよろしいでしょうか？");
  reply(work, "inspection_duration_accepted_wait_in_store");
  assert.equal(work.run("state.proposedAppointment.day"), "18");

  const service = open(serviceScenario, mode);
  service.run(`
    state.currentState = "VISIT_PROPOSAL";
    state.currentObjection = state.pickupReason = "work";
    state.additionalServiceAnswered = true;
    state.serviceTimeExplained = true;
    state.transcript.push({ role: "customer", text: audioIndex.get("objectionWork03").text, audioId: "objectionWork03" });
  `);
  await service.say("ええ。平日でも大丈夫なんでしょうか？");
  reply(service, "objectionWork03");
  assert.equal(service.run("state.appointmentDateConfirmed"), false);
  await service.say("今週の日曜日の16時からお時間は確保できますが、いかがでしょうか？");
  reply(service, "appointmentSingleTime");
  assert.equal(service.run("state.currentState"), "VISIT_GUIDANCE");
}

const checks = open(pickupScenario, "off");
const dates = (text) => checks.run(`inspectionAppointmentDateCandidates(${JSON.stringify(text)}).map(d => d.month + "/" + d.day).join(",")`);
assert.equal(dates("9月30日に車検満了日を迎えます。9月17日10時半はいかがですか？"), "9/17");
assert.equal(dates("9月30日10時半にご来店いただけますか？"), "9/30");

const standaloneLoaner = open(pickupScenario, "held");
standaloneLoaner.run('state.inspectionAppointmentCandidate = { month: "9", day: "17", hour: "10", minute: 0 }');
await standaloneLoaner.say("ご来店の際、代車は必要でしょうか？");
reply(standaloneLoaner, "inspection_booking_invitation_accept_customer");
assert.equal(standaloneLoaner.run("state.inspectionPickupActive"), false);

console.log("11月21日: 満了日と予約日、来店と代車の回答順、曜日確認、待ち方の保持、平日の時間条件 OK");
