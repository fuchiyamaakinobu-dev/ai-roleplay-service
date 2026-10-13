import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function session(resolver = null) {
  const node = () => ({ value: '', disabled: false, textContent: '', setAttribute() {} });
  const context = vm.createContext({ window: {}, document: { querySelector: node }, console });
  for (const file of ['scenario.js', 'audio-db.js']) vm.runInContext(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
  vm.runInContext(source.slice(0, source.indexOf('els.startButton.addEventListener')), context);
  context.window.ROLEPLAY_INTENT_ASSIST = resolver;
  vm.runInContext(`state.started=true;state.currentState='INSPECTION_REQUEST_RECEIVED';
    stopSpeechInput=()=>{};stopCustomerPlayback=()=>{};clearStaffInput=()=>{};renderProgress=()=>{};
    addMessage=(role,text,options={})=>state.transcript.push({role,text,audioId:options.audioId});`, context);
  return { run: s => vm.runInContext(s, context), say: text => {
    context.input = text;
    return vm.runInContext('els.staffInput.value=input;handleReply({preventDefault(){}})', context);
  } };
}
let calls = 0;
const assistant = { enabled: () => true, resolve: async () => { calls++; return { asksService: true }; } };
const assisted = session(assistant);
await assisted.say('一緒に済ませておきたい整備はありますか？');
assert.equal(assisted.run('state.transcript.at(-1).audioId'), 'additionalServiceRequest');
assert.equal(assisted.run('state.transcript.at(-1).text'), 'オイル交換もお願いします。');
assert.equal(assisted.run('state.serviceRequestAsked'), false, 'LLM evidence must not award credit');
assert.equal(assisted.run('state.vehicleConcernAsked'), false);
assert.equal(assisted.run('state.analyses[0].asked_service_request'), false);
assert.equal(assisted.run('state.customerReplyPending'), false);
await assisted.say('走っている時に、いつもと違う音がしたりしませんか？');
assert.equal(assisted.run('state.transcript.at(-1).audioId'), 'additionalServiceNone');
assert.equal(assisted.run('state.transcript.at(-1).text'), 'そのほかは大丈夫です。');
for (const id of ['additionalServiceRequest','additionalServiceNone']) {
  const file = assisted.run(`audioIndex.get('${id}').file`);
  assert.equal(assisted.run(`audioIndex.get('${id}').status`), 'ready');
  assert.ok(fs.statSync(new URL('../audio/' + file, import.meta.url)).size > 1000);
}

const recognized = session(assistant);
const before = calls;
recognized.say('点検以外のご用命や、お車で気になる点はございませんか？');
assert.equal(calls, before, 'Known expressions need no API call');
assert.equal(recognized.run('state.serviceRequestAsked && state.vehicleConcernAsked'), true);

const legacy = session(); legacy.say('一緒に済ませておきたい整備はありますか？');
for (const resolver of [{ enabled: () => false, resolve: assistant.resolve },
  { enabled: () => true, resolve: async () => null },
  { enabled: () => true, resolve: async () => { throw new Error('failure'); } }]) {
  const failed = session(resolver); await failed.say('一緒に済ませておきたい整備はありますか？');
  assert.equal(failed.run('state.currentState'), legacy.run('state.currentState'));
  assert.equal(failed.run('state.serviceRequestAsked'), false);
  assert.equal(failed.run('state.customerReplyPending'), false);
}

for (const invalidate of ['state.transcript=[];state.started=false', 'state.ended=true', 'scenario={...scenario,id:"other"}']) {
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const s = session({ enabled: () => true, resolve: () => deferred });
  const pending = s.say('一緒に済ませておきたい整備はありますか？');
  assert.equal(s.run('state.customerReplyPending'), true);
  s.say('二重送信です');
  assert.equal(s.run('state.transcript.length'), 1);
  s.run(invalidate);
  const count = s.run('state.transcript.length');
  release({ asksService: true }); await pending;
  assert.equal(s.run('state.transcript.length'), count, 'Late reply must not reach ended/reset session');
}
const later = session(assistant); later.run('state.currentState="VISIT_PROPOSAL"');
const previous = calls; later.say('一緒に済ませておきたい整備はありますか？');
assert.equal(calls, previous, 'Later stages are outside initial integration scope');
console.log('LLM返答連携: 既存MP3・採点分離・API節約・失敗復帰・二重送信防止・終了/切替後の返答破棄 OK');
