import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
for(const id of ['employeeCode','startButton','themeToggle'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
assert.ok(html.indexOf('id="scenarioList"')<html.indexOf('id="employeeCode"'));
assert.ok(html.indexOf('id="employeeCode"')<html.indexOf('id="startButton"'));
assert.ok(html.indexOf('id="startButton"')<html.indexOf('id="audioEnabled"'));
for(const initial of [null,'industrial','standard','bad']){
 let enabled,stored=initial,click;const attrs={};const button={setAttribute(k,v){attrs[k]=v},addEventListener(k,f){click=f}};
 vm.runInNewContext(fs.readFileSync('theme-toggle.js','utf8'),{document:{getElementById:()=>button,documentElement:{classList:{toggle(k,v){assert.equal(k,'industrial-theme');enabled=v}}}},localStorage:{getItem:()=>stored,setItem:(k,v)=>{stored=v}}});
 assert.equal(enabled,initial==='industrial');click();assert.equal(enabled,initial!=='industrial');assert.equal(attrs['aria-pressed'],String(enabled));click();assert.equal(enabled,initial==='industrial');
}
console.log('配置・ID一意性・初期通常表示・切替・復元 OK');
