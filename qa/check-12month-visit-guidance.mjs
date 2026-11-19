import assert from "node:assert/strict";
import fs from "node:fs";
import { session } from "./check-inspection-llm-selection.mjs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const arrival = "受付のため、ご予約時刻の15分前にお越しください。";
const lockNut = "ロックナットを使っている場合は、取り外し用のキーかアダプターをお持ちください。";
const appointment = "11月28日10時はいかがでしょうか。";
const arrivalStatus = "15分前の来店案内";
const lockNutStatus = "ロックナット用具の持参案内";

function visitSession(llmEnabled = false) {
  const roleplay = session("service-12month-visit-promotion", async () => ({ id: "rule" }));
  roleplay.run(source.slice(source.indexOf("function addMessage("), source.indexOf("function renderConversation(")));
  roleplay.run(`
    renderConversation = () => {};
    window.ROLEPLAY_INTENT_ASSIST.enabled = () => ${llmEnabled};
    interactionDelayMs = () => 0;
    playAudio = (_src, _text, _showMissingMessage, onFinished) => onFinished?.();
    startSpeechInputAfterCustomer = () => state.micResumed = true;
    state.currentState = "APPOINTMENT_CONFIRMATION";
    state.serviceTimeExplained = true;
    state.additionalServiceAnswered = true;
    state.serviceRequestAsked = true;
    state.vehicleConcernAsked = true;
    state.analyses = [Object.fromEntries(scenario.scoring.filter(m => !m.requiresVisitBooking).map(m => [m.key, true]))];
  `);
  return roleplay;
}

function checkCustomerAudio(roleplay, id, text) {
  assert.equal(roleplay.run("state.transcript.at(-1).audioId"), id);
  assert.equal(roleplay.run("state.transcript.at(-1).text"), text);
  const audioFile = roleplay.run(`audioPath(${JSON.stringify(id)})`);
  assert.ok(fs.existsSync(new URL("../" + audioFile, import.meta.url)), audioFile);
}

const progress = 'serviceProgressStatus({ state: "VISIT_GUIDANCE" }, mergedProgressAchievements())';
const chainedGuidance =
  "ロックナットを使っている場合はアダプターをお持ちいただき、予約の15分前に受付へお越しください。";
for (const instructions of [[arrival, lockNut], [lockNut, arrival], [arrival + lockNut], [chainedGuidance]]) {
  const roleplay = visitSession(instructions[0] === lockNut);
  await roleplay.say(appointment);
  checkCustomerAudio(roleplay, "appointmentSingleTime", "では、その時間でお願いします。");
  assert.equal(roleplay.run("state.currentState"), "VISIT_GUIDANCE");
  assert.equal(roleplay.run("state.ended"), false);
  assert.equal(roleplay.run("state.micResumed"), true);
  assert.equal(roleplay.run(progress), "active");
  const time = roleplay.run("state.appointmentTime");
  for (const instruction of instructions) {
    await roleplay.say(instruction);
    assert.equal(roleplay.run("state.appointmentTime"), time);
    if (instructions.length === 2 && instruction === instructions[0]) {
      checkCustomerAudio(roleplay, "acceptedPickup", "はい、お願いします。");
      assert.equal(roleplay.run("state.ended"), false);
      assert.equal(roleplay.run(progress), "active");
      assert.equal(roleplay.run("scoreRoleplay().score"), 95);
    }
  }
  checkCustomerAudio(roleplay, "closing02", "よろしくお願いします。");
  assert.equal(roleplay.run("state.ended"), true);
  assert.equal(roleplay.run(progress), "done");
  assert.equal(roleplay.run("scoreRoleplay().score"), 100);
  assert.deepEqual([...roleplay.run("scoreRoleplay().judgements.slice(0, 2)")], [
    arrivalStatus + "：確認済み",
    lockNutStatus + "：確認済み"
  ]);
}

const omitted = visitSession();
await omitted.say(appointment);
for (const text of [
  "当日は10分前にご来店ください。ロックナットキーは不要です。",
  "15分前に来店する必要はありません。工具をお持ちください。",
  "ご来店の15分前にお電話をいただき、ご来店ください。",
  "ロックナットキーがあります。予約時刻どおりにお越しください。",
  "ロックナットキーは私が持ってきています。"
]) {
  await omitted.say(text);
  assert.equal(omitted.run("state.ended"), false);
  assert.equal(omitted.run("scoreRoleplay().score"), 91);
}
await omitted.say("当日は、ろっくなっときーをおもちください。");
await omitted.say("本日はありがとうございました。");
assert.equal(omitted.run("state.ended"), true);
const omittedResult = omitted.run("scoreRoleplay()");
assert.equal(omittedResult.score, 95);
assert.match(omittedResult.recommendedTalk, /15分前/);
assert.doesNotMatch(omittedResult.recommendedTalk, /ロックナット/);
assert.equal(omittedResult.judgements[0], arrivalStatus + "：未確認");
assert.equal(omittedResult.judgements[1], lockNutStatus + "：確認済み");

const finishedByButton = visitSession();
await finishedByButton.say(appointment);
await finishedByButton.say("当日はじゅうごふんまえにごらいてんください。");
finishedByButton.run("finishRoleplay()");
assert.equal(finishedByButton.run("state.ended"), true);
assert.equal(finishedByButton.run("scoreRoleplay().score"), 95);
assert.match(finishedByButton.run("scoreRoleplay().recommendedTalk"), /アダプター/);

const combinedBooking = visitSession();
await combinedBooking.say("11月28日10時と11時ではいかがでしょうか。ご予約の十五分前のご来店をお願いします。" + lockNut);
assert.equal(combinedBooking.run("state.ended"), true);
assert.match(combinedBooking.run("state.appointmentTime"), /^(?:10|11)時$/);
assert.equal(combinedBooking.run("scoreRoleplay().score"), 100);

const unbooked = visitSession();
await unbooked.say(arrival + lockNut);
assert.equal(unbooked.run("state.currentState"), "APPOINTMENT_CONFIRMATION");
assert.equal(unbooked.run("state.ended"), false);
assert.equal(unbooked.run("scoreRoleplay().score"), 100);
assert.doesNotMatch(unbooked.run("scoreRoleplay().judgements.join()"), /15分前の来店|ロックナット/);
await unbooked.say("承知しました。ご自宅までお車を取りに伺います。");
assert.equal(unbooked.run("state.ended"), true);
assert.equal(unbooked.run(progress), "na");
assert.doesNotMatch(unbooked.run("scoreRoleplay().judgements.join()"), /15分前の来店|ロックナット/);

console.log("12カ月点検: 来店前案内の進行・音声・個別採点・引取と未確定時の対象外 OK");
