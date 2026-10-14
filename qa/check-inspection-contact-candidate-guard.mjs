import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const text='それから、ええトランクの中等に荷物が入っているようでしたら、降ろした状態絡みの状態でご来店ください。';
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
 for(const key of ['explained_documents','explained_lock_and_arrival','confirmed_reminder_contact']) {
  const s=session(id,async()=>null);
  s.run(`state.scriptStep=scenario.steps.findIndex(s=>s.key===${JSON.stringify(key)});state.proposedAppointment={month:9,day:1,hour:9,minute:30,period:''};`);
  await s.say(text); assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_explained_lock_and_arrival_customer');
 }
 const s=session(id,async()=>({id:'inspection_confirmed_reminder_contact_customer'}));
 s.run('state.proposedAppointment={month:9,day:1,hour:9,minute:30,period:""};');
 s.run('state.transcript.push({role:"staff",text:"確認の連絡はこの携帯でよろしいですか？"},{role:"customer",text:"この携帯にお願いします。"})');
 await s.say(text);assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_explained_lock_and_arrival_customer');
 assert.equal(s.run('applyInspectionLlmSelection("荷物を降ろしてご来店ください。",{id:"inspection_confirmed_reminder_contact_customer"})'),false);
 assert.equal(s.run('inspectionLlmCandidates("荷物を降ろしておいていただけますか？").some(c=>c.action==="inspection_contact")'),false);
 assert.equal(s.run('inspectionLlmCandidates("確認の連絡はこの携帯でよろしいですか？").some(c=>c.action==="inspection_contact")'),true);
 assert.equal(s.run('inspectionLlmCandidates("荷物を降ろしてご来店ください。確認の連絡はこの携帯でよろしいですか？").some(c=>c.action==="inspection_contact")'),true);
}

