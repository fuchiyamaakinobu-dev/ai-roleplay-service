import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';
import {judgeWithGroq} from '../lab/intent-core.mjs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const add=source.slice(source.indexOf('function addMessage('),source.indexOf('\nfunction ',source.indexOf('function addMessage(')+1));
for(const id of ['vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery']){
const s=session(id,async()=>({id:'rule'}));s.run(add);s.run("interactionDelayMs=()=>0;commitMessage=(role,text,options)=>state.transcript.push({role,text,audioId:options.audioId});");
for(const [text,expected] of [
['車検に代車もご用意いたしますが、いかがですか？','お願いします。'],
['はい。オイル交換などは今回交換の方させていただいてもよろしいですか？','お願いします。'],
['はい。ホイールナットを回す工具があれば持ってきてください。','分かりました。'],
['9時30分とお話したんですが、15分前に来ていただけると助かります。','分かりました。']]){
assert.ok(s.run(`inspectionAllSpeechCandidates(${JSON.stringify(text)}).some(c=>c.text===${JSON.stringify(expected)})`),text);
}
const explanation='6万キロでしたら一日車検というのができまして、朝お預かりして夕方お返しできるというのができますが。';
assert.ok(s.run(`inspectionAllSpeechCandidates(${JSON.stringify(explanation)}).some(c=>c.text==='ええ。')`));
assert.equal(s.run('inspectionSpeechAnalysisCandidates("代車をご用意します。走行距離は何キロですか？").length'),0);
for(const text of ['ホイールナットを回す工具があれば持ってきてください。','15分前に来ていただけると助かります。']){
s.run(`state.transcript.push({role:'staff',text:${JSON.stringify(text)}});addMessage('customer','はい。',{});`);
assert.equal(s.run('state.transcript.at(-1).text'),'分かりました。');
}
}
const limited=await judgeWithGroq('test',{apiKey:'test',fetchImpl:async()=>new Response('',{status:429,headers:{'Retry-After':'7'}})});
assert.equal(limited.retryAfterSeconds,7);
console.log('10月20日発話: 代車提案・オイル承諾・工具/早着依頼・説明語尾・別質問保護・429待機時間 OK');
