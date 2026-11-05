import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const phrases = [
  'ありがとうございます。それでは。8月1日から作業できますが。佐藤様、いつ頃よろしかったでしょうか？',
  'ありがとうございます。いつごろよろしいでしょうか？',
  'ありがとうございます。いつ頃がご希望でしょうか？',
  'ありがとうございます。ご希望の日を教えていただけますか？'
];
let count = 0;
for (const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']) {
  for (const step of [2,4,9]) for (const text of phrases) for (const mode of ['select','hold','off','error']) {
    let called = false;
    const s = session(id, async req => {
      called = true;
      assert.ok(req.candidates.some(c => c.action === 'inspection_weekday'));
      assert.ok(req.candidates.every(c => c.action === 'inspection_weekday'));
      if (mode === 'error') throw new Error('simulated timeout');
      if (mode === 'hold') return null;
      return {id:req.candidates[0].id,kind:'question',topic:'weekday',
        answerTarget:s.run(`inspectionLastQuestionClause(${JSON.stringify(text)})`),evidence:text};
    });
    s.run(`state.scriptStep=${step}`);
    if (mode === 'off') s.run('window.ROLEPLAY_INTENT_ASSIST.enabled=()=>false');
    await s.say(text);
    assert.equal(called, mode !== 'off');
    assert.equal(s.run('state.transcript.at(-1).text'), '土日がいいです。', `${id}/${step}/${mode}/${text}`);
    assert.equal(s.run('state.proposedAppointment'), null);
    count++;
  }
}
const s = session('vehicle-inspection-phone-followup',async () => null);
const text = '走行距離を教えてください。気になる症状はありますか？';
const candidates = s.run(`inspectionAllSpeechCandidates(${JSON.stringify(text)})`);
assert.ok(candidates.every(c => c.id === 'inspection_vehicle_condition_no_concerns'));
assert.equal(s.run(`applyInspectionLlmSelection(${JSON.stringify(text)},${JSON.stringify({id:candidates[0].id,kind:'question',answerTarget:'走行距離を教えてください。',evidence:text})})`), false);
await s.say('ありがとうございます。今日は晴れるのでしょうか？');
const guarded = s.run('guardInspectionFinalQuestionReply("こちらこそ。",{audioId:"inspection_thanked_customer_customer"})');
assert.equal(guarded.text, 'はい。');
assert.equal(guarded.options.emergencyAudio.reason, 'answer_target_unresolved');
assert.match(guarded.options.emergencyAudio.answerTarget, /今日は晴れる/);
console.log(`共通回答対象: ${count}条件（2シナリオ×3工程×4表現×LLM選択/保留/OFF/通信失敗）・前半候補排除・非常記録 OK`);
