# スタッフ発話途中の音声入力継続テスト

実施日: 2026-08-26

## 対象

- Web Speech APIがスタッフ発話途中の区切りを最終認識結果として返した場合
- 未完了文を検出した後のAI相づちとマイク状態

## 期待結果

- 未完了文ではAIお客様が「はい」と発話しない
- 音声認識を中断せず、スタッフの続きの発話を同じ入力へ追加する
- 完成文は従来どおり自動送信する

## 自動確認

- `node --check app.js`: 成功
- `node qa/check-speech-incomplete-continuation.mjs`: 成功
- `node qa/check-12month-trailing-service-question.mjs`: 成功
- `qa/*.mjs` 全40件: 成功（失敗0件）
