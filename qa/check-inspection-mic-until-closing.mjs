import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(
  source,
  /let speechSessionActive = false;/,
  "ロープレ中の音声入力セッションが認識エンジンと別管理されていません"
);
assert.match(
  source,
  /function stopSpeechInput\(options = \{\}\)[\s\S]*?preserveSession[\s\S]*?scheduleSpeechSessionRecovery/,
  "AIお客様の発話待ちに入っても音声入力セッションを維持できません"
);
assert.match(
  source,
  /function scheduleSpeechSessionRecovery[\s\S]*?state\.customerReplyPending \|\| activeCustomerAudio[\s\S]*?beginAutomaticSpeechInput/,
  "AI音声の再生中を避けて音声入力を自動復帰する監視がありません"
);
assert.match(
  source,
  /function scheduleSpeechStartWatchdog[\s\S]*?!speechRecognitionHasStarted[\s\S]*?speechRecognitionRunning[\s\S]*?speechRecognition\.abort\(\)[\s\S]*?scheduleSpeechSessionRecovery/,
  "開始イベントが返らず固まった音声認識を検知・再接続できません"
);
assert.match(
  source,
  /speechRecognition\.addEventListener\("start"[\s\S]*?speechRecognitionRunning = true;[\s\S]*?updateMicButton\(true\)/,
  "実際の認識開始前に入力中表示へ切り替わる可能性があります"
);
assert.match(
  source,
  /function updateMicButtonPaused\(\)[\s\S]*?is-paused[\s\S]*?音声入力の自動再開待ち/,
  "AI音声中と認識中を画面上で区別できません"
);
assert.match(
  source,
  /function handleReply[\s\S]*?stopSpeechInput\(\{ preserveSession: scenario\.id === "vehicle-inspection-phone-followup" \}\)/,
  "スタッフ発話の送信時に車検ロープレの音声入力セッションが終了します"
);
assert.match(
  source,
  /function finishRoleplay\(options = \{\}\) \{\s*stopSpeechInput\(\)/,
  "終話時に音声入力セッションを終了できません"
);
assert.match(
  source,
  /isInspectionFinalClosingThanks\(text\)[\s\S]*?state\.ended = true;[\s\S]*?inspection_closed_politely_customer/,
  "スタッフの最終『ありがとうございました』でのみ車検ロープレを終話する経路がありません"
);
assert.match(
  source,
  /const asksGeneralInspectionAvailability = hasInspectionAvailabilityRequest\(decisionText\)[\s\S]*?!hasInspectionAppointmentProposalEvidence\(text\);/,
  "具体的な日時提案が一般的な都合確認へ誤分類され、同じ質問を繰り返す可能性があります"
);

console.log("車検誘致・最終挨拶までの音声入力継続テスト: OK");
