import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';
const phrases = [
  'ありがとうございます。それでは。8月1日から作業できますが。佐藤様、いつ頃よろしかったでしょうか？',
  'ありがとうございます。いつごろがよろしいですか？',
  'お世話になっております。いつならいいですか？',
  'ありがとうございます。佐藤様の日程のご希望はいつでしょうか？',
];
for (const text of phrases) {
  const s = session('vehicle-inspection-pickup-delivery', async () => null);
  await s.say(text);
  assert.equal(s.run('state.transcript.at(-1).text'), '土日がいいです。', text);
  assert.equal(s.run('state.transcript.at(-1).audioId'), 'inspection_day_preference_answer');
  assert.ok(fs.existsSync(new URL('../' + s.run('audioPath("inspection_day_preference_answer")'), import.meta.url)));
  assert.equal(s.run('state.proposedAppointment'), null);
}
const s = session('vehicle-inspection-pickup-delivery', async () => null);
for (const text of ['いつ頃終わりますか？', 'いつから作業できますか？', 'ありがとうございます。', 'いつ頃がよろしいか確認します。']) {
  assert.equal(s.run(`asksOpenInspectionDatePreference(${JSON.stringify(text)})`), false, text);
}
await s.say('ありがとうございます。9月12日の午前10時はいかがでしょうか？');
assert.notEqual(s.run('state.transcript.at(-1).text'), 'こちらこそ。');
assert.notEqual(s.run('state.transcript.at(-1).text'), '土日がいいです。');
console.log('末尾の日程希望質問・登録MP3・具体日時との区別 OK');
