# 日付だけの予約提案と日時確定優先テスト

実施日: 2026-08-26

## 対象

- 未確認項目が残る段階での日付だけの予約提案
- 後工程へ進んだ後の完全な予約日時提案
- 早い段階で確認済みのオイル交換希望

## 期待結果

- 「8月30日はいかがでしょうか」には「何時が空いていますか？」と返答する
- 作業時間など過去工程へ進まず、日時調整を継続する
- 「8月30日10時はいかがでしょうか」では予約確定を優先する
- 確認済みの「オイル交換もお願いしたいです。」を繰り返さない

## 自動確認

- `node --check app.js`: 成功
- `node qa/check-inspection-minimum-appointment-completion.mjs`: 成功
- `node qa/check-inspection-booking-step-skip.mjs`: 成功
- `node qa/check-inspection-booking-invitation-reply.mjs`: 成功
- `qa/*.mjs` 全40件: 成功（失敗0件）
