import assert from "node:assert/strict";
import fs from "node:fs";
import { session } from "./check-inspection-llm-selection.mjs";
import { validateSelection } from "../lab/selection-core.mjs";

const source = fs.readFileSync("app.js", "utf8");
const pickup = "vehicle-inspection-pickup-delivery";
const phone = "vehicle-inspection-phone-followup";
const splitSchedule = "かしこまりましたありがとうございますでは9月の17日にお車お預かりして9月の18日夕方にお車をお渡しする形ではいかがでしょうか";
const arrival = "ありがとうございます代車にお乗りいただければと思いますので佐藤様は9月の17日の日当日本日にご来店いただくこと可能でしょうか";
const availableTime = "10時から空いております";
const damage = "ガラスに飛び石やヘッドライトの曇りなどはございませんか";
const deadline = "本日ご連絡させていただいたのが社長様のヤリスの車検の件でした9月の30日に満曜日を迎えるのですがご都合の方いかがでしょうか";

function open(id, mode) {
  const run = session(id, async (request) => {
    if (mode === "error") throw Error("offline");
    if (mode !== "selection" || request.text !== damage) return { id: "rule" };
    return validateSelection({
      id: "inspection_confirmed_booking_time_customer",
      kind: "question",
      topic: "work",
      evidence: damage,
      answerTarget: damage,
      conditions: []
    }, request);
  });
  run.run(source.slice(source.indexOf("function addMessage("), source.indexOf("function renderConversation(")));
  run.run("renderConversation = () => {}; startSpeechInputAfterCustomer = () => {}; interactionDelayMs = () => 0;");
  if (mode === "off") run.run("window.ROLEPLAY_INTENT_ASSIST.enabled = () => false");
  return run;
}

function reply(run, id) {
  assert.equal(run.run("state.transcript.at(-1).audioId"), id);
  assert.equal(run.run(`audioIndex.get(${JSON.stringify(id)}).text`), run.run("state.transcript.at(-1).text"));
  assert.ok(fs.existsSync(run.run(`audioPath(${JSON.stringify(id)})`)), id);
  assert.equal(run.run("Boolean(state.transcript.at(-1).emergencyAudio)"), false);
}

for (const mode of ["off", "held", "error", "selection"]) {
  const schedule = open(pickup, mode);
  schedule.run('state.scriptStep = 5; state.inspectionMileageAsked = true; state.inspectionMileageVariant = "120000"');
  await schedule.say(splitSchedule);
  reply(schedule, "inspection_appointment_time_missing_retry");
  assert.equal(schedule.run("state.scriptedPartialReplies.inspectionPickupDate.text"), "9月17日");
  await schedule.say(availableTime);
  reply(schedule, "inspection_appointment_single_time_customer");
  assert.equal(schedule.run("state.inspectionAppointmentCandidate.day"), "17");
  assert.equal(schedule.run("state.inspectionAppointmentCandidate.hour"), "10");
  assert.equal(schedule.run("state.proposedAppointment"), null);
  await schedule.say(arrival);
  reply(schedule, "inspection_pickup_request_customer");
  assert.equal(schedule.run("state.inspectionAppointmentCandidate.hour"), "10");
  assert.equal(schedule.run("state.inspectionPickupPhase"), "reason");
  assert.equal(schedule.run("state.inspectionLoanerRequested"), false);

  const visitBeforeTime = open(pickup, mode);
  visitBeforeTime.run('state.scriptStep = 5; state.inspectionMileageAsked = true; state.inspectionMileageVariant = "120000"');
  await visitBeforeTime.say(splitSchedule);
  reply(visitBeforeTime, "inspection_appointment_time_missing_retry");
  await visitBeforeTime.say(arrival);
  reply(visitBeforeTime, "inspection_pickup_request_customer");
  assert.equal(visitBeforeTime.run("state.inspectionPickupPhase"), "reason");
  assert.equal(visitBeforeTime.run("state.proposedAppointment"), null);

  const opening = open(pickup, mode);
  opening.run("state.scriptStep = 0");
  await opening.say("佐藤様のお宅でしょうか");
  await opening.say("トヨタモビリティ帯広本別店の担当者と申します。日頃は大変お世話になっております。");
  await opening.say(deadline);
  reply(opening, "inspection_asked_availability_customer");
  assert.equal(opening.run("state.scriptedPartialReplies.inspectionPickupDate"), undefined);

  for (const id of [pickup, phone]) {
    const condition = open(id, mode);
    condition.run(`
      state.scriptStep = 7;
      state.transcript.push({role:"customer",text:"オイル交換もお願いしたいです。",audioId:"inspection_asked_vehicle_concerns_customer"});
    `);
    await condition.say(damage);
    reply(condition, "inspection_confirmed_booking_time_customer");
    assert.equal(condition.run(`asksInspectionGlassDamage(${JSON.stringify(damage)})`), true);
    assert.ok(condition.run('scoreScriptedRoleplay().judgements.some(text => /損傷確認: ○/.test(text))'));
    assert.equal(condition.run("state.proposedAppointment"), null);
    assert.equal(condition.run("hasInspectionOilChangeRequest()"), true);
  }
}

const controls = open(pickup, "off");
const run = (fn, text) => controls.run(`${fn}(${JSON.stringify(text)})`);
assert.equal(run("inspectionAppointmentProposalMatch", "9月18日の17時にお車をお渡しします"), null);
const full = run("inspectionAppointmentProposalMatch", "9月17日の10時にお預かりして9月18日の17時にお渡しします");
assert.equal(full.day, "17");
assert.equal(full.hour, "10");
assert.equal(run("inspectionAppointmentProposalMatch", "9月17日10時か9月18日17時はいかがですか"), null);
assert.equal(controls.run('inspectionAppointmentDateCandidates("9月17日に車検して17時にお渡しします")[0].day'), "17");
assert.equal(run("asksInspectionGlassDamage", "ガラスに飛び石対策は必要ですか？"), false);
assert.equal(run("asksInspectionGlassDamage", "ガラスに飛び石の跡があります。"), false);
await controls.say(availableTime);
assert.equal(controls.run("state.inspectionAppointmentCandidate"), null);
controls.run('state.scriptedPartialReplies.inspectionPickupDate = { text:"9月17日" }');
await controls.say("10時からは空いておりません");
assert.equal(controls.run("state.inspectionAppointmentCandidate"), null);
await controls.say("お返しは翌日の17時です。");
assert.equal(controls.run("state.inspectionAppointmentCandidate"), null);

console.log("11月22日履歴: 入庫日と返却日、時刻の回答と保持、来店可否、満了日・ガラス確認 OK");
