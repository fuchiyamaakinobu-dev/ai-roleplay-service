import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const explanation='待っている間ですね。もし何かああ、整備のことで追加があったりとか、ええ、アドバイスがあったりしますと、工場の方から詳しくお伝えできるといったことができますので、ぜひご利用していただきたいなと思います。';
for(const reason of ['driving','distance','work']) {
 const s=session('vehicle-inspection-pickup-delivery',async()=>null);
 s.run(`state.variantSeed=2;state.inspectionPickupActive=true;state.inspectionPickupPhase="proposal";state.inspectionPickupReason=${JSON.stringify(reason)};state.scriptStep=scenario.steps.findIndex(x=>x.key==="proposed_appointment");state.inspectionAppointmentCandidate={month:"9",day:"10",hour:"9",minute:30};`);
 const before=s.run('JSON.stringify(state.inspectionAppointmentCandidate)');
 await s.say(explanation);
 assert.equal(s.run('state.transcript.at(-1).text'),s.run(`inspectionPickupReasons.find(x=>x.key===${JSON.stringify(reason)}).text`));
 assert.equal(s.run('state.inspectionPickupPhase'),'proposal');
 assert.equal(s.run('state.proposedAppointment'),null);
 assert.equal(s.run('JSON.stringify(state.inspectionAppointmentCandidate)'),before);
 if(reason==='driving') {
  await s.say('ご家族と一緒に来ることは可能ですか？');
  assert.equal(s.run('state.inspectionPickupOutcome'),'visit');
 }
}
console.log('10月25日: 整備説明で予約質問へ戻らない・引取理由/候補保持・家族提案で来店へ進行 OK');

