import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const storeSource = fs.readFileSync(new URL("../results-store.js", import.meta.url), "utf8");
const historyPageSource = fs.readFileSync(new URL("../history.html", import.meta.url), "utf8");
const historySource = fs.readFileSync(new URL("../history.js", import.meta.url), "utf8");
const rulesSource = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

const start = appSource.indexOf("function normalizeEmployeeCode(");
const end = appSource.indexOf("function queueHistoryRecord(", start);
assert.notEqual(start, -1, "社員コード正規化関数が見つかりません");
assert.notEqual(end, -1, "社員コード検証関数を読み込めません");

const context = {};
vm.createContext(context);
vm.runInContext(`
  ${appSource.slice(start, end)}
  this.normalizeEmployeeCode = normalizeEmployeeCode;
  this.isValidEmployeeCode = isValidEmployeeCode;
`, context);

assert.equal(context.normalizeEmployeeCode("１２３４５６"), "123456");
assert.equal(context.normalizeEmployeeCode("12a34-56"), "123456");
assert.equal(context.isValidEmployeeCode("123456"), true);
assert.equal(context.isValidEmployeeCode("１２３４５６"), true);
assert.equal(context.isValidEmployeeCode("12345"), false);
assert.equal(context.isValidEmployeeCode("1234567"), false);

assert.match(indexSource, /id="employeeCode"[^>]+pattern="\[0-9\]\{6\}"/s);
assert.match(indexSource, /id="employeeCode"[^>]+maxlength="6"/s);
assert.match(indexSource, /results-store\.js/);
assert.match(indexSource, /history\.html/);
assert.match(historyPageSource, /id="employeeFilter"[^>]+maxlength="6"/s);
assert.match(historySource, /replace\(\/\\D\/g, ""\)\.slice\(0, 6\)/);
assert.match(appSource, /if \(!state\.resultSaved && isValidEmployeeCode\(state\.employeeCode\)\)/);
assert.match(appSource, /state\.resultSaved = true/);
assert.match(appSource, /queueHistoryRecord\("recordStart"/);
assert.match(appSource, /queueHistoryRecord\("saveResult"/);
assert.match(storeSource, /collection\(db, "roleplayActivity"\)/);
assert.match(storeSource, /collection\(db, "roleplayResults"\)/);
assert.match(storeSource, /employeeCode: cleanText\(payload\.employeeCode, 6\)/);
assert.match(storeSource, /serverTimestamp\(\)/);
assert.match(historySource, /ADMIN_EMAIL = "fuchiyama\.akinobu@gmail\.com"/);
assert.match(historySource, /const HISTORY_LIMIT = 500/);
assert.match(historySource, /snapshot\.docs\.slice\(HISTORY_LIMIT\)/);
assert.match(historySource, /writeBatch\(db\)/);
assert.match(historySource, /batch\.delete\(doc\(db, collectionName, item\.id\)\)/);
assert.match(historySource, /exportCsv/);
assert.match(rulesSource, /employeeCode\.matches\('\^\[0-9\]\{6\}\$'\)/);
assert.match(rulesSource, /match \/roleplayResults\/\{documentId\}/);
assert.match(rulesSource, /allow read, delete: if isAdmin\(\)/);
assert.match(rulesSource, /allow update: if false/);

console.log("社員コード・実施履歴テスト: OK");
