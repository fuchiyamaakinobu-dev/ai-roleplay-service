import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const text='ありがとうございます。佐藤様、それでは3万キロでしたら町車検と言って来店していただいて。ええ、待っている間に車検ができるという。さあ、90分車検がございますが、ご利用いただいたらよろしいかと思いますが。';
for (const mode of ['rule','off','failure']) {
  const s=session('vehicle-inspection-pickup-delivery', async()=>{if(mode==='failure')throw Error('offline');return {id:'rule'};});
  if(mode==='off')s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
  s.run("state.inspectionPickupOutcome='visit';state.inspectionPickupPhase='resolved';state.inspectionMileageVariant='30000';state.inspectionMileageAsked=true;");
  assert.equal(s.run(`looksLikeCompleteJapaneseSentence(${JSON.stringify(text)})`),true);
  await s.say(text);
  assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_duration_accepted_wait_in_store',mode);
  assert.equal(s.run('state.inspectionWaitingMethod'),'store');
  assert.equal(s.run('state.proposedAppointment'),null);
  for(const fragment of ['90分車検がございますが。','ご利用いただければと思いますが。','90分車検でお待ちいただければと思いますが、それから。'])
    assert.equal(s.run(`looksLikeCompleteJapaneseSentence(${JSON.stringify(fragment)})`),false,fragment);
  for(const guard of ["state.inspectionMileageVariant='120000'","state.inspectionMileageVariant='30000';state.inspectionPickupActive=true;state.inspectionPickupPhase='proposal';state.inspectionPickupOutcome=null"]){
    s.run(guard);
    assert.equal(s.run(`inspectionStoreWaitingCandidate(${JSON.stringify(text)})`),null,guard);
  }
}
console.log('Oct29: completed proposal, partial speech, fallback, waiting memory and pickup guards OK');
