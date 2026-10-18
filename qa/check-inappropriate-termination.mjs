import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session} from './check-inspection-llm-selection.mjs';
for(const id of ['service-12month-visit-promotion','vehicle-inspection-phone-followup','vehicle-inspection-pickup-delivery'])for(const enabled of [true,false]){
 const s=session(id,async()=>{throw Error('LLM must not be called');});
 s.run(`window.ROLEPLAY_INTENT_ASSIST.enabled=()=>${enabled};state.employeeCode='999999';renderResults=result=>state.testResult=result;queueHistoryRecord=(type,data)=>{state.testSaves=(state.testSaves||0)+1;state.testSaved=data;};`);
 await s.say('じゃあよそで入れてください');
 assert.equal(s.run('state.ended'),true);
 assert.equal(s.run('state.transcript.at(-1).role'),'system');
 assert.equal(s.run('state.transcript.at(-1).audioId'),'roleplay_terminated_inappropriate_speech');
 assert.equal(s.run('state.testSaves'),1);
 assert.equal(s.run('state.testSaved.score'),s.run('state.testResult.score'));
 assert.equal(s.run('state.testSaved.transcript.at(-2).text'),'じゃあよそで入れてください');
 const count=s.run('state.transcript.length');await s.say('9月30日10時はいかがですか');
 assert.equal(s.run('state.transcript.length'),count);assert.equal(s.run('state.testSaves'),1);
 assert.ok(fs.existsSync(new URL('../'+s.run('audioPath("roleplay_terminated_inappropriate_speech")'),import.meta.url)));
}
console.log('不適切発言: 3シナリオ・LLM ON/OFF・終了案内・採点保存・追加入力停止 OK');
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const p=session('vehicle-inspection-pickup-delivery',async()=>null);
for(const name of ['addMessage','commitMessage']){const start=source.indexOf('function '+name+'(');p.run(source.slice(start,source.indexOf('\nfunction ',start+1)));}
p.run(`renderConversation=()=>{};renderResults=()=>{};els.audioEnabled.checked=true;state.employeeCode='999999';queueHistoryRecord=()=>{};playAudio=src=>{state.testPlayed=src;};stopCustomerPlayback=()=>{state.testPlayed=null;};`);
await p.say('じゃあよそで入れてください');
assert.equal(p.run('state.testPlayed'),'audio/roleplay_terminated_inappropriate_speech.mp3');
assert.equal(p.run('state.ended'),true);
assert.equal(p.run('state.resultSaved'),true);
console.log('実メッセージ経路: 終了音声を採点処理が停止しないことを確認 OK');
