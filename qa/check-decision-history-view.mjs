import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const node=tag=>({tag,children:[],append(...v){this.children.push(...v)},prepend(...v){this.children.unshift(...v)}});
const source=fs.readFileSync('history.js','utf8');const c=vm.createContext({document:{createElement:node}});
vm.runInContext(source.slice(source.indexOf('function addText('),source.indexOf('function render()')),c);
const result=vm.runInContext(`detailsCell({transcript:[{role:'customer',text:'実際の返答',audioId:'actual',decision:{answerTarget:'最後の質問',selectedId:'chosen',adoptedId:'actual',candidates:[{id:'chosen',text:'候補A'},{id:'unused',text:'候補B'}]}},{role:'customer',text:'過去の返答'}]})`,c);
const flat=n=>[n.textContent||'',...(n.children||[]).map(flat)].join(' ');
assert.match(flat(result),/LLM選択・未採用：候補A/);assert.match(flat(result),/未採用：候補B/);assert.match(flat(result),/採用：実際の返答/);assert.match(flat(result),/候補の保存記録がありません/);
console.log('保存履歴: 選択後不採用・未採用・採用・旧履歴欠損の区別 OK');
