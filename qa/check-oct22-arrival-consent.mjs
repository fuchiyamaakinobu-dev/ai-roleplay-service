import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const create=()=>{const s=session('vehicle-inspection-pickup-delivery',async()=>null);s.run('state.inspectionMileageVariant="120000";state.variantSeed=1');return s;};
const s=create();
await s.say('佐藤様のヤリス、今の距離数は何キロか教えていただけますか？');
assert.equal(s.run('state.transcript.at(-1).text'),'12万キロ走っています。');
await s.say('12万キロですね。結構乗りなりましたね。それでしたら。さしていただいてお預かりしてという形になるので、一日お預かりしたいんですが、よろしいですか？');
assert.equal(s.run('state.transcript.at(-1).text'),'はい。');
assert.equal(s.run('state.inspectionPickupActive'),false);
await s.say('ありがとうございます。それでは佐藤様、ええ。退社ご用意させていただきまして。で、一時までにご来店していただきたいんですが、よろしいですか？');
assert.equal(s.run('state.transcript.at(-1).text'),'できれば、車を取りに来てもらえませんか？');
assert.equal(s.run('state.inspectionPickupActive'),true);
assert.equal(s.run('state.proposedAppointment'),null);
await s.say('はい。ありがとうございます。あ、それではあの、もう少し。ええ、ちょっと聞きたいことありますので、このお電話、よろしいですか？');
assert.equal(s.run('state.transcript.at(-1).text'),'大丈夫ですよ。');
assert.equal(s.run('state.inspectionPickupActive'),true);
for(const text of ['当日はご来店ください。一日お預かりしたいんですが、よろしいですか？','一時までにご来店いただきたいのですが、気になるところはございますか？']) {
 const t=create();await t.say('今の走行距離は何キロですか？');await t.say(text);
 assert.equal(t.run('state.inspectionPickupActive'),false,text);
}
console.log('10月22日: 預かり了承・来店質問で引取希望・通話継続了承・最後の質問優先 OK');
