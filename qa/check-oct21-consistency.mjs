import assert from 'node:assert/strict';import fs from 'node:fs';import {session} from './check-inspection-llm-selection.mjs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');const start=source.indexOf('function addMessage(');const realAdd=source.slice(start,source.indexOf('\nfunction ',start+1));
const s=session('vehicle-inspection-pickup-delivery',async()=>null);s.run(realAdd);s.run("interactionDelayMs=()=>0;commitMessage=(role,text,options)=>state.transcript.push({role,text,audioId:options.audioId});");
for(const [variant,id] of [['30000','inspection_current_mileage_customer'],['over60000','inspection_current_mileage_over60000_customer'],['120000','inspection_current_mileage_120000_customer']]){s.run(`state.inspectionMileageVariant='${variant}';addMessage('customer','今、3万キロくらいです。',{audioId:'inspection_current_mileage_customer'});`);assert.equal(s.run('state.transcript.at(-1).audioId'),id);}
s.run("state.transcript.push({role:'staff',text:'後日、一日で作業が終わりますが、会社の方は必要でしょうか？'});addMessage('customer','この携帯にお願いします。',{audioId:'inspection_confirmed_reminder_contact_customer'});");assert.notEqual(s.run('state.transcript.at(-1).audioId'),'inspection_confirmed_reminder_contact_customer');
s.run("state.proposedAppointment={month:'9',day:'30',hour:'10',minute:30};state.inspectionPickupOutcome='visit';");
for(const t of ['ありがとうございます。では、佐藤様のヤリス9月の30日10時半ご来店で車検のご予約入れさせていただきますので、よろしくお願いします。','分かりました。では最終確認です。佐藤様のヤリス9月の30日10時半本別店ご来店で一時間半の車検させていただきますのでよろしくお願いします。'])assert.equal(s.run(`hasConfirmedInspectionAppointmentRecap(${JSON.stringify(t)})`),true,t);
assert.equal(s.run("hasConfirmedInspectionAppointmentRecap('佐藤様9月30日11時半ご来店で車検のご予約入れさせていただきます。')"),false);
console.log('10月21日: 距離3設定の音声一致・電話回答の話題保護・実発話の復唱と誤時刻検出 OK');
