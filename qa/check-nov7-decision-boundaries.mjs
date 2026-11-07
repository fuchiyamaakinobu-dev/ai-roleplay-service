import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const source=fs.readFileSync('app.js','utf8');
function real(select=async()=>null){
 const s=session('vehicle-inspection-pickup-delivery',select);
 s.run(source.slice(source.indexOf('function addMessage('),source.indexOf('function renderConversation(')));
 s.run('state.scriptStep=7;renderConversation=()=>{};startSpeechInputAfterCustomer=()=>{};interactionDelayMs=()=>0;');
 return s;
}
const s=real();
await s.say('走行距離も後ほど伺います。佐藤様のお電話でよろしいでしょうか？');
assert.equal(s.run('state.transcript.at(-1).text'),'そうです。');
assert.equal(s.run('state.inspectionMileageAsked'),false);
assert.equal(s.run('state.inspectionDurationQuestionAsked'),false);
await s.say('今、お電話よろしいでしょうか。');
assert.equal(s.run('state.inspectionReminderContactAnswered'),false);
assert.equal(s.run('state.transcript.at(-1).decision.after.contact'),false);
await s.say('オイル交換は必要ございませんか？');
assert.match(s.run('state.transcript.at(-1).text'),/オイル交換/);
for(const [variant,expected] of [['over60000',/6万/],['120000',/12万/]]){
 const high=real();high.run(`state.inspectionMileageVariant='${variant}'`);
 await high.say('今の走行距離ですが、何キロぐらい走られてますでしょう。');
 assert.match(high.run('state.transcript.at(-1).text'),expected);
}
const visit=real();visit.run('state.inspectionPickupActive=true;state.inspectionPickupPhase="proposal";state.inspectionPickupReason="competitor";');
await visit.say('当社でも取りに伺うことはできます。作業途中でご説明できますので、お休みの日にこちらの方でお待ちいただくことはできませんか？');
assert.doesNotMatch(visit.run('state.transcript.at(-1).text'),/ほかのお店では/);
assert.equal(visit.run('inspectionPickupReasonQuestion("お仕事でご都合が悪いですか？")'),true);
const unknown='オドメーターの数字を教えていただけます？';
const analyzed=real(async()=>({id:'rule',kind:'question',topic:'mileage',answerTarget:unknown,evidence:unknown,conditions:[]}));
await analyzed.say(unknown);
assert.match(analyzed.run('state.transcript.at(-1).text'),/3万/);
assert.equal(analyzed.run('inspectionSemanticContext'),null);
const unrecognized=real();
await unrecognized.say('今日は晴れるのでしょうか？');
assert.equal(unrecognized.run('state.transcript.at(-1).emergencyAudio.reason'),'answer_target_unresolved');
assert.equal(unrecognized.run('state.scriptStep'),7);
// Candidate state changes are committed only with the accepted response, never
// while playback is pending or when a replacement/emergency reply is committed.
const pending=real();pending.run('var pendingCommit;addMessage=(r,t,o)=>{if(r==="staff")state.transcript.push({role:r,text:t});else pendingCommit=o.onReplyAccepted;};');
await pending.say('確認の連絡先はこの携帯でよろしいでしょうか？');
assert.equal(pending.run('state.inspectionReminderContactAnswered'),false);
pending.run('pendingCommit({audioId:"inspection_thanked_customer_retry",text:"はい。"})');
assert.equal(pending.run('state.inspectionReminderContactAnswered'),false);
pending.run('pendingCommit({audioId:"inspection_confirmed_reminder_contact_customer",text:"この携帯にお願いします。"})');
assert.equal(pending.run('state.inspectionReminderContactAnswered'),true);
// Run actual finishRoleplay serialization and actual store normalization, with
// only UI, scoring and the remote Firestore transport replaced.
unrecognized.run(`state.employeeCode='000000';state.resultSaved=false;var savedPayload;
 window.ROLEPLAY_RESULTS={saveResult:p=>savedPayload=p};renderResults=()=>{};
 scoreRoleplay=()=>({score:0,good:[],improve:[],judgements:[]});finishRoleplay();`);
const payload=unrecognized.run('savedPayload');
assert.equal(payload.transcript.at(-1).emergencyAudio.reason,'answer_target_unresolved');
assert.equal(payload.transcript.at(-1).release,'20261107-5');
payload.transcript.at(-1).emergencyAudio.staffText='08012345678への確認ですか？';
payload.transcript.at(-1).decision.evidence='08012345678への確認ですか？';
let stored;
const c=vm.createContext({window:{dispatchEvent(){}},CustomEvent:class{},console,
 initializeApp:()=>({}),getFirestore:()=>({}),serverTimestamp:()=>0,
 collection:()=>({}),addDoc:async(_,data)=>{stored=data;}});
const store=fs.readFileSync('results-store.js','utf8');
vm.runInContext(store.slice(store.indexOf('const firebaseConfig')),c);
await c.window.ROLEPLAY_RESULTS.saveResult(payload);
assert.ok(stored);
assert.equal(stored.transcript.at(-1).emergencyAudio.reason,'answer_target_unresolved');
assert.match(stored.transcript.at(-1).emergencyAudio.answerTarget,/晴れる/);
assert.equal(stored.transcript.at(-1).release,'20261107-5');
assert.equal(stored.transcript.at(-1).decision.before.step,7);
assert.equal(stored.transcript.at(-1).decision.after.step,7);
assert.ok(!JSON.stringify(stored).includes('08012345678'));
console.log('本人/通話/距離状態隔離・多走行・来店理由誤認・分析保留引継ぎ・未解決工程保持・採用後更新・終了保存→整形→電話番号マスク OK');
