import assert from "node:assert/strict";
import fs from "node:fs";
import { session } from "./check-inspection-llm-selection.mjs";

const app = fs.readFileSync("app.js", "utf8");
const pickup = "vehicle-inspection-pickup-delivery";
const phone = "vehicle-inspection-phone-followup";
const service = "service-12month-visit-promotion";
const appointment = "と朝の10時にお預かりをして、翌日の18日夕方5時にお引き渡しさせていただきたいのですが。佐藤様、本別店の方までお越しいただいて、打者に乗っていただいてお預かりすることって可能でしょうか？";
const damage = "すみません。聞き忘れていたのですが、今ヤリスの方でフロントガラスの飛び石とかヘッドライトの。傷とか。割れはないでしょうか？";
const loaner = "ご来店いただいて代車にお乗りいただいてお帰りいただいてって形でも大丈夫ですか";

function open(scenario, mode) {
  const run = session(scenario, async (request) => {
    if (mode === "error") throw Error("offline");
    if (mode === "selection" && request.text === damage) {
      const answerTarget = run.run("inspectionLastQuestionClause(" + JSON.stringify(damage) + ")");
      return {
        id: "inspection_confirmed_booking_time_customer",
        kind: "question", topic: "work", evidence: answerTarget, answerTarget
      };
    }
    return { id: "rule" };
  });
  run.run(app.slice(app.indexOf("function addMessage("), app.indexOf("function renderConversation(")));
  run.run("renderConversation = () => {}; startSpeechInputAfterCustomer = () => {}; interactionDelayMs = () => 0; finishRoleplay = () => { state.ended = true; };");
  if (mode === "off") run.run("window.ROLEPLAY_INTENT_ASSIST.enabled = () => false");
  return run;
}

function audio(run, id) {
  assert.equal(run.run("state.transcript.at(-1).audioId"), id, run.run("state.transcript.at(-1).text"));
  assert.equal(run.run("audioIndex.get(" + JSON.stringify(id) + ").text"), run.run("state.transcript.at(-1).text"));
  assert.ok(fs.existsSync(run.run("audioPath(" + JSON.stringify(id) + ")")), id);
  assert.equal(run.run("Boolean(state.transcript.at(-1).emergencyAudio)"), false);
}

for (const mode of ["off", "held", "error", "selection"]) {
  const start = open(pickup, mode);
  start.run("state.scriptStep = 3");
  await start.say("本日ご連絡させていただいたのがヤリスの車検のご案内でした9月の30日に木曜日迎えるのですがご都合の方いかがだったでしょうか");
  audio(start, "inspection_asked_availability_customer");
  assert.equal(start.run("state.scriptedPartialReplies.inspectionPickupDate"), undefined);

  const admission = open(pickup, mode);
  admission.run('state.scriptStep = 5; state.inspectionMileageAsked = true; state.inspectionMileageVariant = "120000"');
  await admission.say("かしこまりました。ありがとうございます。8月1日以降で作業可能だったのですが、よろしければ9月の17日。いかがでしょうか。");
  audio(admission, "inspection_appointment_time_missing_retry");
  await admission.say(appointment);
  audio(admission, "inspection_pickup_request_customer");
  assert.equal(admission.run("state.inspectionAppointmentCandidate.day"), "17");
  assert.equal(admission.run("state.inspectionAppointmentCandidate.hour"), "10");
  assert.equal(admission.run("state.inspectionPickupPhase"), "reason");
  assert.equal(admission.run("state.inspectionLoanerRequested"), false);
  assert.equal(admission.run("state.proposedAppointment"), null);

  const flexible = open(pickup, mode);
  flexible.run('state.scriptStep = 5; state.inspectionMileageAsked = true; state.inspectionMileageVariant = "120000"');
  await flexible.say("土日でしたら8月の22日の土曜日はいかがですか？");
  audio(flexible, "inspection_appointment_time_missing_retry");
  await flexible.say("はい。9時30分から開いております。");
  audio(flexible, "inspection_appointment_single_time_customer");
  assert.equal(flexible.run("state.inspectionAppointmentCandidate.minute"), 30);
  assert.equal(flexible.run("state.proposedAppointment"), null);
  flexible.run('state.inspectionPickupActive = true; state.inspectionPickupPhase = "proposal"; state.inspectionPickupReason = "competitor"');
  await flexible.say("はい。8月22日なんですが。少し早めに9時20分ごろお伺いしてもよろしかったですか？");
  audio(flexible, "inspection_pickup_location_customer");
  assert.equal(flexible.run("state.inspectionPickupOutcome"), "pickup");
  assert.equal(flexible.run("state.inspectionLoanerRequested"), false);
  assert.equal(flexible.run("state.inspectionAppointmentCandidate.minute"), 20);
  assert.equal(flexible.run("state.proposedAppointment"), null);
  await flexible.say("それでは、8月22日土曜日、朝9時20分にご自宅にお伺いさせていただきます。");
  audio(flexible, "inspection_pickup_confirmed_customer");
  assert.equal(flexible.run("state.proposedAppointment.minute"), 20);

  const waiting = open(pickup, mode);
  waiting.run('state.scriptStep = 10; state.inspectionMileageAsked = true; state.inspectionMileageVariant = "120000"; state.inspectionPickupOutcome = "visit"; state.inspectionPickupPhase = "resolved"; state.proposedAppointment = {month:"9",day:"17",hour:"10",minute:0}');
  await waiting.say(loaner);
  assert.match(waiting.run("state.transcript.at(-1).text"), /お願いします|大丈夫ですよ/);
  assert.equal(waiting.run("state.inspectionWaitingMethod"), "loaner");
  await waiting.say("では最後の確認です。5月の17日10時にご来店でヤリスをお預かりします。翌日18日17時めどにお車をお引き渡ししますので、ご来店をお願いいたします。");
  assert.equal(waiting.run("state.proposedAppointment.month"), "9");
  assert.ok(waiting.run('scoreScriptedRoleplay().improve.some(text => /最終確認の日時が一致していません/.test(text))'));

  for (const id of [pickup, phone]) {
    const condition = open(id, mode);
    condition.run("state.scriptStep = 7");
    await condition.say(damage);
    audio(condition, "inspection_confirmed_booking_time_customer");
    assert.ok(condition.run('scoreScriptedRoleplay().judgements.some(text => /損傷確認: ○/.test(text))'));
    assert.equal(condition.run("state.proposedAppointment"), null);
    await condition.say(damage + "走行距離は何キロでしょうか？");
    assert.match(condition.run("state.transcript.at(-1).text"), /キロ/);
  }

  const distance = open(service, mode);
  distance.run('state.currentState = "VISIT_PROPOSAL"; state.currentObjection = "distance"; state.pickupRequested = true; state.pickupReason = "drivingConfidence"; state.serviceTimeExplained = true;');
  await distance.say("お伺いすることはできるんですが。ご来店していただければ、何かございましたら工場の方からご説明もできますので、ご来店いただいた方が安心できるかと思うんですが。いかがでしょうか？");
  audio(distance, "objectionDistance03");
  await distance.say("今週ですと、土曜日の10時空いておりますが、いかがでしょうか？");
  audio(distance, "objectionDistance03");
  assert.equal(distance.run("state.appointmentDateConfirmed"), false);
  assert.equal(distance.run("state.appointmentTimeConfirmed"), false);
  assert.equal(distance.run("state.additionalServiceAnswered"), false);
  await distance.say("ご家族と一緒にご来店いただくことは可能でしょうか？");
  audio(distance, "nearbyOrFamilyAgreement");
  await distance.say("今週ですと、土曜日の10時空いておりますが、いかがでしょうか？");
  audio(distance, "appointmentSingleTime");
  await distance.say("受付等もございますので、15分ぐらい前にご来店いただければ助かります。");
  audio(distance, "acceptedPickup");
  assert.equal(distance.run("mergedProgressAchievements().explained_visit_early_arrival"), true);
  assert.equal(distance.run("state.ended"), false);
  await distance.say("それでは、お待ちしておりますので、よろしくお願いします。ありがとうございます。");
  audio(distance, "closing02");
  assert.equal(distance.run("state.ended"), true);
}

const controls = open(pickup, "off");
controls.run('state.scriptedPartialReplies.inspectionPickupDate = {text:"8月22日"}');
await controls.say("お店の営業時間は9時30分からです。");
assert.equal(controls.run("state.inspectionAppointmentCandidate"), null);
assert.equal(controls.run('asksInspectionGlassDamage("ガラスを交換しました。割れはありませんか？")'), false);
assert.equal(controls.run('inspectionAppointmentDateCandidates("9月30日木曜日10時はいかがですか？").length'), 1);
assert.equal(controls.run('inspectionAppointmentDateCandidates("ヤリスの車検の件です。9月30日車検回り指なんですが、ご都合いかがでしょうか？").length'), 0);

const preferredSlot = "8月1日から作業できるんですが、ご都合のいい時とかございますか？";
for (const id of [pickup, phone]) {
  const availability = open(id, "off");
  await availability.say(preferredSlot);
  assert.ok(availability.run('scoreScriptedRoleplay().judgements.includes("都合確認: ○")'));
  assert.equal(availability.run("state.proposedAppointment"), null);
  assert.equal(availability.run('hasInspectionAvailabilityRequest("ご都合の良い時間帯はございますでしょうか？")'), true);
  assert.equal(availability.run('hasInspectionAvailabilityRequest("ご都合の良い時間帯がございます。")'), false);
  assert.equal(availability.run('hasInspectionAvailabilityRequest("8月22日9時半はいかがですか？")'), false);
}

const pickupScoring = open(pickup, "off");
const noPickupJudgements = pickupScoring.run("scoreScriptedRoleplay().judgements");
assert.equal(noPickupJudgements.filter(text => text.endsWith("対象外（引取相談なし）")).length, 5);
assert.ok(!noPickupJudgements.some(text => text.includes("店内待ち提案済み")));
pickupScoring.run('state.inspectionPickupActive = true; state.inspectionPickupPhase = "proposal"; state.inspectionPickupReason = "competitor";');
await pickupScoring.say("8月22日9時20分にご自宅へお車を取りに伺います。");
const acceptedPickupJudgements = pickupScoring.run("scoreScriptedRoleplay().judgements");
assert.ok(acceptedPickupJudgements.includes("待ち方確認: 対象外（引取納車）"));
assert.ok(!acceptedPickupJudgements.some(text => text.includes("引取相談なし")));

console.log("11月25〜26日履歴: 車検と12カ月点検の返答・日時、都合確認の採点、対象外理由 OK");
