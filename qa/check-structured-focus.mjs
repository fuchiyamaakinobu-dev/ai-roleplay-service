import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validateSelection} from '../lab/selection-core.mjs';
const cases=[
 ['書類をご持参ください。今のお車で気になっている症状はありますか？','今のお車で気になっている症状はありますか？','書類をご持参ください。','work','inspection_extra'],
 ['代車は用意できます。今の走行距離を教えていただけますか？','今の走行距離を教えていただけますか？','代車は用意できます。','mileage','inspection_mileage'],
 ['荷物を降ろしてください。確認のお電話はこの携帯でよろしいですか？','確認のお電話はこの携帯でよろしいですか？','荷物を降ろしてください。','contact','inspection_contact']
];
for(const [text,answerTarget,condition,topic,action] of cases){
let request;const s=session('vehicle-inspection-phone-followup',async req=>{request=req;const c=req.candidates.find(c=>c.action===action);assert.ok(c,text);return validateSelection({kind:'question',topic,evidence:answerTarget,answerTarget,conditions:[condition],id:c.id},req)});
await s.say(text);assert.ok(request);assert.equal(s.run('state.transcript.at(-1).audioId'),request.candidates.find(c=>c.action===action).id);
assert.equal(s.run('state.proposedAppointment'),null);
const base={kind:'question',topic,evidence:answerTarget,answerTarget,conditions:[condition],id:'rule'};
assert.throws(()=>validateSelection({...base,answerTarget:'捏造した質問'},request));
assert.throws(()=>validateSelection({...base,conditions:['架空の日時']},request));
}
console.log('共通文脈: 3複合発話の最後の質問、原文引用検証、予約不変 OK');
