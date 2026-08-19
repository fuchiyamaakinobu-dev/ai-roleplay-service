import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const lexiconStart = source.indexOf("const lexicon =");
const precisionEnd = source.indexOf("function confirmsUnchangedServiceTime(", lexiconStart);
const unchangedStart = precisionEnd;
const unchangedEnd = source.indexOf("function isServiceTimeRequirementSatisfied(", unchangedStart);
const analysisStart = source.indexOf("function normalizeFullWidthDigits(");
const analysisEnd = source.indexOf("function collectEvidence(", analysisStart);

assert.notEqual(lexiconStart, -1, "12カ月点検の判定辞書が見つかりません");
assert.notEqual(precisionEnd, -1, "精密判定ヘルパーを切り出せません");
assert.notEqual(unchangedEnd, -1, "時間変更なし判定を切り出せません");
assert.notEqual(analysisStart, -1, "スタッフ発話解析の開始位置が見つかりません");
assert.notEqual(analysisEnd, -1, "スタッフ発話解析を切り出せません");

const context = {
  state: { analyses: [] },
  isActivePickupRequest() {
    return false;
  },
  collectEvidence() {
    return [];
  },
  decide() {
    return "continue";
  },
  confidenceFor() {
    return 1;
  }
};
vm.createContext(context);
vm.runInContext(`
  ${source.slice(lexiconStart, precisionEnd)}
  ${source.slice(unchangedStart, unchangedEnd)}
  ${source.slice(analysisStart, analysisEnd)}
  this.analyzeStaff = analyzeStaff;
  this.extractScheduleTimeOptions = extractScheduleTimeOptions;
  this.hasScheduleDateExpression = hasScheduleDateExpression;
`, context);

const analyze = (text) => context.analyzeStaff(text);

assert.equal(analyze("点検は1時間程度です。").explained_service_time, true);
assert.equal(analyze("点検は60分ほどです。").explained_service_time, true);
assert.equal(analyze("作業時間は確認します。").explained_service_time, false);
assert.equal(analyze("作業時間はまだ分かりません。").explained_service_time, false);
assert.equal(analyze("1時間では終わりません。").explained_service_time, false);
assert.equal(analyze("作業には1時間半かかります。").explained_service_time, false);

assert.equal(analyze("土日も営業していますので、いかがでしょうか？").proposed_weekend, true);
assert.equal(analyze("土日にご来店できませんか？").proposed_weekend, true);
assert.equal(analyze("土日は営業していません。").proposed_weekend, false);
assert.equal(analyze("夕方4時はいかがでしょうか？").proposed_time, true);
assert.equal(analyze("夕方は対応できません。").proposed_time, false);
assert.equal(
  analyze("お仕事がお休みの時に、ご来店いただくことは可能でしたでしょうか？").proposed_day_off_visit,
  true
);
assert.equal(analyze("店舗は本日休みです。").proposed_day_off_visit, false);
assert.equal(analyze("休みの日も来店は難しいです。").proposed_day_off_visit, false);
assert.equal(analyze("近い店舗をご案内できます。").proposed_other_store, true);
assert.equal(analyze("近い店舗はありません。").proposed_other_store, false);
assert.equal(analyze("ご家族と一緒に来店できます。").proposed_family_visit, true);
assert.equal(analyze("ご家族と一緒の来店は難しいです。").proposed_family_visit, false);
assert.equal(analyze("必ずお店に来てください。").pressured_customer, true);
assert.equal(analyze("来店か引取か、ご都合に合わせて選べます。").pressured_customer, false);
assert.equal(analyze("車の引き取りはできません。").refused_pickup, true);
assert.equal(analyze("車を取りに行けません。").refused_pickup, true);
assert.equal(analyze("その時間帯は対応できません。").refused_pickup, false);
assert.equal(
  analyze("ご来店いただければ、お車を見ながら点検内容を詳しくご説明できます。").explained_visit_benefit,
  true
);

assert.equal(analyze("引取をご希望される理由を教えていただけますか？").asked_reason, true);
assert.equal(analyze("畑がお忙しいのですね。").asked_reason, true);
assert.equal(analyze("お仕事で来店が難しいのですね。").asked_reason, true);
assert.equal(analyze("ご自宅から距離があり、ご来店がご負担なのですね。").asked_reason, true);
assert.equal(analyze("運転にご不安があり、ご来店が難しいのですね。").asked_reason, true);
assert.equal(analyze("平日のご来店は難しいですね。").asked_reason, false);
assert.equal(analyze("ご来店は可能です。").asked_reason, false);
assert.equal(analyze("後ほどご連絡します。").acknowledged_request, false);
assert.equal(analyze("ご連絡ありがとうございます。点検ですね。").acknowledged_request, true);
assert.equal(analyze("ご連絡ありがとうございます。点検ですね。").next_action_confirmed, false);
assert.equal(analyze("8月20日の10時はいかがでしょうか？").next_action_confirmed, true);
assert.equal(analyze("8月20日の10時は空いていません。").has_concrete_schedule, false);
assert.equal(analyze("8月20日の10時は空いていません。").next_action_confirmed, false);

assert.deepEqual([...context.extractScheduleTimeOptions("作業時間は1時間です")], []);
assert.deepEqual([...context.extractScheduleTimeOptions("8月20日の10時です")], ["10時"]);
assert.equal(context.hasScheduleDateExpression("作業に1日かかります"), false);
assert.equal(context.hasScheduleDateExpression("来月の2日はいかがですか"), true);

console.log("12カ月点検・判定精度テスト: OK");
