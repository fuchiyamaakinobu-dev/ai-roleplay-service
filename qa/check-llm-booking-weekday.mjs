import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
import {validSelection,validateSelection} from '../lab/selection-core.mjs';
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']){
 let calls=0;
 const s=session(id,async req=>{calls++;assert.ok(validSelection(req));const action=calls===1?'inspection_booking_intent':'inspection_weekday';return validateSelection({kind:'question',topic:calls===1?'booking_intent':'weekday',evidence:req.text,id:req.candidates.find(c=>c.action===action).id},req);});
 s.run("state.transcript.push({role:'customer',text:'案内のはがきが来ていましたよ。',audioId:'inspection_explained_inspection_notice_customer'});");
 await s.say('今回のお車の検査も私どもにお任せくださいますか？');
 assert.equal(calls,1);assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_asked_availability_customer');
 await s.say('お仕事の日とお休みの日、どちらがお越しになりやすいですか？');
 assert.equal(calls,2);assert.equal(s.run('state.transcript.at(-1).audioId'),'inspection_day_preference_answer');
 assert.equal(s.run('state.proposedAppointment'),null);
 assert.equal(s.run('inspectionLlmCandidates("平日か土日、どちらがいいですか？").some(c=>c.action==="inspection_weekday")'),false);
 s.run('state.proposedAppointment={month:9,day:1,hour:10};');
 assert.equal(s.run('inspectionLlmCandidates("当社にお願いできますか？").some(c=>c.action==="inspection_booking_intent")'),false);
}
const input={text:'荷物を降ろしてください。',candidates:[{id:'weekday',action:'inspection_weekday'}]};
assert.equal(validateSelection({id:'weekday',kind:'request',topic:'other',evidence:input.text},input).id,'rule');
console.log('LLM拡張: 未知の言い換えを実際にselectへ送信・2シナリオ・意味検証・予約/重複保護 OK');
