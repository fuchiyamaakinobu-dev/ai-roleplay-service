import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c=vm.createContext({window:{},document:{querySelector:()=>({value:'',textContent:'',setAttribute(){}})},console});
for(const f of ['scenario.js','audio-db.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');vm.runInContext(app.slice(0,app.indexOf('els.startButton.addEventListener')),c);
const run=t=>vm.runInContext(t,c);
run(`scenario=window.VEHICLE_INSPECTION_PICKUP_SCENARIO;state.started=true;interactionDelayMs=()=>0;commitMessage=(role,text,options)=>state.transcript.push({role,text,audioId:options.audioId});`);
function check(text,expected,history=[]){c.lines=[...history,text];run('state.transcript=lines.map(text=>({role:"staff",text}));addMessage("customer","はい。",{audioId:"inspection_thanked_customer_retry"})');assert.equal(run('state.transcript.at(-1).text'),expected,text);assert.ok(fs.existsSync(new URL('../'+run('audioPath(state.transcript.at(-1).audioId)'),import.meta.url)));}
check('佐藤様のお客ですか？','そうです。');
check('一日もしくは2日お預かりしますが、いかがでしょうか。','大丈夫ですよ。');
check('専用の工具がございましたらご用意ください。','分かりました。');
check('代車を持ってご自宅に伺いますね。','分かりました。');
check('作業は当日17時に完了する予定です。','分かりました。');
check('最終確認です。9月30日10時半でよろしくお願いします。','お願いします。');
check('町車検が可能ですがいかがですか？','どれくらい時間がかかるのですか？');
check('町車検が可能ですがいかがですか？','お願いします。',['作業は90分です。']);
check('ワンデー車検はいかがですか？','どれくらい時間がかかるのですか？');
check('ワンデー車検はいかがですか？','大丈夫ですよ。',['当日17時に完了する予定です。']);
check('8月25日の10時ではいかがですか？','どれくらい時間がかかるのですか？');
check('8月25日の10時ではいかがですか？','大丈夫ですよ。',['作業は90分です。']);
check('ありがとうございます。','こちらこそ。');
check('で、今こちらの方まで。','はい。');
run(`state.transcript=[];state.proposedAppointment=null;renderProgress=()=>{};state.variantSeed=1;`);
c.text='ご来店できない理由はございますか？';run('state.transcript.push({role:"staff",text});handleInspectionBookingOutcome(text)');assert.match(run('state.transcript.at(-1).text'),/遠い/);
console.log('本番addMessage経由: 本人確認・疑問形・所要時間・準備・代車・返却・お礼・発話途中・引取理由 OK');

run('state.transcript=[];state.proposedAppointment=null;state.inspectionPickupActive=false;state.inspectionPickupPhase=null;state.inspectionPickupOutcome=null;');
c.text='工場で直接整備結果をご説明しますので、ご来店いただければと思うのですがいかがですか？';
for(let i=0;i<3;i++){run('state.transcript.push({role:"staff",text});handleInspectionBookingOutcome(text)');assert.equal(run('state.transcript.at(-1).audioId'),i<2?'inspection_pickup_request_customer':'inspection_pickup_visit_agreement');}
assert.equal(run('state.inspectionPickupOutcome'),'visit');
console.log('来店促進: 初期引取希望 → 3回目の促進で来店了承・状態更新 OK');
