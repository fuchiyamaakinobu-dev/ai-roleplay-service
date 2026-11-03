import assert from 'node:assert/strict';
import {session} from './check-inspection-llm-selection.mjs';
const s=session('vehicle-inspection-pickup-delivery',async()=>null);
const put=lines=>s.run('state.transcript='+JSON.stringify(lines.map(text=>({role:'staff',text}))));
put([]);const base=s.run('scoreScriptedRoleplay().score');assert.match(s.run('scoreScriptedRoleplay().improve.join(" ")'),/追加アドバイス（減点なし）/);
for(const lines of [['自賠責保険証明書をお持ちください。契約内容を確認します。'],['自動車保険の保険証券をお持ちください。'],['任意保険の補償内容を確認します。'],['任意保険の証券は持参しなくて大丈夫です。補償内容を確認します。']]){put(lines);assert.equal(s.run('inspectionVoluntaryInsuranceGuidance()'),false);}
put(['任意保険の保険証券もお持ちください。','当日、補償内容を確認させていただきます。']);assert.equal(s.run('inspectionVoluntaryInsuranceGuidance()'),true);assert.doesNotMatch(s.run('scoreScriptedRoleplay().improve.join(" ")'),/追加アドバイス/);
s.run('state.analyses=scenario.scoring.map(m=>({[m.key]:true}));state.proposedAppointment={month:"9",day:"30",hour:"10",minute:0}');assert.equal(s.run('scoreScriptedRoleplay().score'),100);
s.run('state.analyses=state.analyses.filter(a=>!a.confirmed_identity)');const bonus=s.run('scoreScriptedRoleplay().score');put([]);assert.equal(bonus-s.run('scoreScriptedRoleplay().score'),2);
console.log('任意保険：両条件・自賠責除外・未説明アドバイス・2点加点・100点上限 OK');
